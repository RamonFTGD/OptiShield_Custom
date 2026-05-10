import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { sendInteractiveMessage } = require('gifted-btns')

export const meta = {
  name: 'FacebookSearch',
  commands: ['facebooksearch', 'fbsearch', 'fbsh'],
  priority: 5,
  premium: true,
  class: 'Buscadores',
}

export default async function (msg, sock, ctx) {
  const jid    = msg.key.remoteJid
  const query  = ctx.args.join(' ')
  const apikey = ctx.apikey

  if (!query) {
    await sock.sendMessage(jid, { text: '❌ *Debes escribir algo.*\n\nEjemplo: `.fbsh gatos`' }, { quoted: msg })
    return true
  }

  const statusMsg = await sock.sendMessage(jid, { text: `🔎 *Buscando "${query}" en Facebook...*` }, { quoted: msg })
  const edit = async (text) => { try { await sock.sendMessage(jid, { text, edit: statusMsg.key }) } catch {} }

  try {
    const res = await global.OptiShield.callApi('facebook-search', { apikey, query, limit: 10 })
    if (res.error) { await edit(`❌ *Error: ${res.error}*`); return true }

    const results = res?.result
    if (!Array.isArray(results) || !results.length) {
      await edit(`❌ *Sin resultados para "${query}"*`)
      return true
    }

    const valid = results.filter(r => r.url && r.title)

    if (!valid.length) {
      await edit(`❌ *No se encontraron videos con información para "${query}"*`)
      return true
    }

    // Preparamos las filas de la lista nativa de WhatsApp
    const rows = valid.map((r, i) => {
      const cleanTitle = (r.title || `Resultado ${i + 1}`).replace(/\n+/g, ' ').trim()
      
      // Título corto para la lista (Máx ~24 caracteres recomendado por WhatsApp)
      const shortTitle = cleanTitle.substring(0, 18) + (cleanTitle.length > 18 ? '...' : '')
      
      // Descripción: Canal + Stats (Máx ~72 caracteres)
      let description = ''
      if (r.channel) description += r.channel
      if (r.stats && r.channel) description += ` | ${r.stats}`
      else if (r.stats) description += r.stats
      description = description.substring(0, 72) + (description.length > 72 ? '...' : '')

      return {
        id: `.fb ${r.url}`,
        title: `🎬 ${i + 1}. ${shortTitle}`,
        description: description
      }
    })

    // Actualizamos el estado y enviamos la lista interactiva (1 solo mensaje)
    await edit(`✅ *${valid.length} resultados encontrados.*`)

    await sendInteractiveMessage(sock, jid, {
      title: '📘 Resultados de Facebook',
      text: `Se encontraron *${valid.length} videos* para: _"${query}"_\n\n👇 *Desliza la lista y selecciona_ el video que quieres descargar.`,
      footer: `OptiShield • Buscador FB`,
      interactiveButtons: [
        {
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '🎬 Seleccionar Video',
            sections: [{ 
              title: `Mostrando ${valid.length} resultados`, 
              rows 
            }]
          })
        },
        {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: '🔍 Ver más en Facebook',
            url: `https://www.facebook.com/search/videos/?q=${encodeURIComponent(query)}`
          })
        }
      ]
    })

  } catch (err) {
    console.error('❌ facebook-search error:', err)
    await edit(`❌ *Error: ${err.message}*`)
  }

  return true
}
