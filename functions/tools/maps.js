import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { sendInteractiveMessage } = require('gifted-btns')

export const meta = {
  name: 'places-search',
  commands: ['places', 'mapa'],
  priority: 3,
  premium: true,
  class: 'Herramientas',
}

const searchCache = new Map()

function buildBodyText(p) {
  const lines = []
  lines.push(`*${p.nombre || 'Lugar'}*`)
  if (p.categoria && p.categoria !== 'administrative' && p.categoria !== 'place') lines.push(`🏷️ ${p.categoria}`)
  const dir = p.direccion || {}
  const dirParts = [
    dir.calle && dir.numero ? `${dir.calle} #${dir.numero}` : dir.calle,
    dir.colonia, dir.ciudad, dir.estado, dir.pais
  ].filter(Boolean)
  if (dirParts.length) lines.push(`📍 ${dirParts.join(', ')}`)
  const c = p.contacto || {}, d = p.detalles || {}, h = p.horarios || {}
  if (c.telefono)           lines.push(`📞 ${c.telefono}`)
  if (c.website)            lines.push(`🌐 ${c.website}`)
  if (c.instagram)          lines.push(`📸 ${c.instagram}`)
  if (c.facebook)           lines.push(`👤 ${c.facebook}`)
  if (h.texto)              lines.push(`🕐 ${h.texto}`)
  if (d.cocina)             lines.push(`🍽️ ${d.cocina}`)
  if (d.accesible === true) lines.push(`♿ Accesible`)
  if (d.wifi === true)      lines.push(`📶 WiFi`)
  if (p.importancia)        lines.push(`⭐ ${(p.importancia * 10).toFixed(1)}/10`)
  return lines.join('\n')
}

export default async function (msg, sock, ctx) {
  const jid = msg.key.remoteJid

  let selectedId = null
  try {

    const paramsStr = msg?.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson
    if (paramsStr) selectedId = JSON.parse(paramsStr)?.id
    

    if (!selectedId && ctx.args?.[0]?.startsWith('__place_')) selectedId = ctx.args[0]
  } catch {}

  if (selectedId && selectedId.startsWith('__place_')) {
    const parts = selectedId.split('_')
    const searchId = parts[2]
    const index = parseInt(parts[3])

    const results = searchCache.get(searchId)
    if (!results || !results[index]) {
      await sock.sendMessage(jid, { text: '⏰ Esta búsqueda expiró. Haz la búsqueda de nuevo.' }, { quoted: msg })
      return true
    }

    const p = results[index]
    const mapsUrl = p.coordenadas?.google_maps || `https://www.google.com/maps?q=${p.coordenadas?.lat},${p.coordenadas?.lon}`
    const osmUrl = p.coordenadas?.osm || 'https://www.openstreetmap.org'

    await sendInteractiveMessage(sock, jid, {
      title: p.nombre || 'Lugar',
      text: buildBodyText(p),
      footer: 'OptiShield • OpenStreetMap',
      interactiveButtons: [
        { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '🗺️ Google Maps', url: mapsUrl, merchant_url: mapsUrl }) },
        { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '🌍 OpenStreetMap', url: osmUrl, merchant_url: osmUrl }) }
      ]
    }, { quoted: msg })
    return true
  }

  const query  = ctx.args.join(' ')
  const apikey = ctx.info?.user?.apikey

  if (!query) {
    await sock.sendMessage(jid, {
      text: '❌ Debes escribir algo.\nEjemplo: `.lugar Tubo Gomez Manzanillo Colima`'
    }, { quoted: msg })
    return true
  }

  if (!apikey) {
    await sock.sendMessage(jid, { text: '❌ No tienes API Key válida.' }, { quoted: msg })
    return true
  }

  const statusMsg = await sock.sendMessage(jid, {
    text: `🔎 Buscando *"${query}"* en el mapa...`
  }, { quoted: msg })
  const edit = async (text) => { try { await sock.sendMessage(jid, { text, edit: statusMsg.key }) } catch {} }

  try {
    const res = await global.OptiShield.callApi('places-search', { apikey, query, limit: 10 })

    if (res.error) { await edit(`❌ Error: ${res.error}`); return true }

    const results = res?.result?.results
    if (!Array.isArray(results) || !results.length) {
      await edit(`❌ Sin resultados para *"${query}"*`)
      return true
    }

    const searchId = Date.now().toString(36) + Math.random().toString(36).substring(2)
    searchCache.set(searchId, results)
    setTimeout(() => searchCache.delete(searchId), 300000)

    let menuText = `📍 *Búsqueda:* ${query}\n📊 *Resultados:* ${results.length}\n\n`

    const rows = results.map((p, i) => {
      const dir = p.direccion || {}
      const ciudad = dir.ciudad || dir.estado || ''
      menuText += `*${i + 1}.* ${p.nombre || `Lugar ${i + 1}`}\n`
      if (ciudad) menuText += `   📍 ${ciudad}\n`
      if (p.categoria && p.categoria !== 'administrative') menuText += `   🏷️ ${p.categoria}\n`
      menuText += '\n'
      
      return {
        id: `__place_${searchId}_${i}`,
        title: `📍 ${(p.nombre || `Lugar ${i + 1}`).substring(0, 24)}`,
        description: ciudad ? `${ciudad}${p.categoria ? ` • ${p.categoria}` : ''}` : (p.categoria || '')
      }
    })

    menuText += `_Selecciona un lugar para ver detalles y opciones_`

    await sendInteractiveMessage(sock, jid, {
      title: '🗺️ Búsqueda de Lugares',
      text: menuText,
      footer: 'OptiShield • OpenStreetMap',
      interactiveButtons: [
        {
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '📍 Seleccionar lugar',
            sections: [{ title: '🗺️ Lugares encontrados', rows }]
          })
        }
      ]
    }, { quoted: msg })

  } catch (err) {
    console.error('❌ places-search error:', err)
    await edit(`❌ Error al procesar la solicitud.`)
  }

  return true
}
