import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { sendInteractiveMessage } = require('gifted-btns')

export const meta = {
  name: 'bandcamp-search',
  commands: ['bcsearch', 'bcbuscar', 'searchbc'],
  priority: 5,
  premium: true,
  class: 'Buscadores',
}

export default async function (msg, sock, ctx) {
  const jid = msg.key.remoteJid
  const query = ctx.args.join(' ')
  const apikey = ctx?.info?.user?.apikey
  const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg })

  if (!apikey) return reply('▸ API Key no disponible.')
  if (!query) return reply('▸ Debes escribir algo. Ejemplo: .bcsearch Carpenter Brut')

  const statusMsg = await reply(`Buscando "${query}" en Bandcamp...`)
  const edit = async (text) => { try { await sock.sendMessage(jid, { text, edit: statusMsg.key }) } catch { } }

  try {
    const res = await global.OptiShield.callApi('bandcamp-search', { q: query, limit: '8', apikey })

    if (res.error || !res?.result?.results?.length) {
      await edit('▸ Sin resultados en Bandcamp.')
      return true
    }

    const results = res.result.results.slice(0, 8)

    let menuText = `Resultados para: ${query}\n\n`
    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      const artist = r.artist?.replace(/^by\s*/i, '').trim() || 'Desconocido'
      const titulo = r.title?.length > 50 ? r.title.substring(0, 50) + '...' : r.title
      menuText += `${i + 1}. ${titulo}\n   ${artist} • ${r.price || 'Free'}\n\n`
    }

    menuText += `Selecciona una opción para descargar.`

    const rows = results.map((r) => {
      const artist = r.artist?.replace(/^by\s*/i, '').trim() || 'Desconocido'
      const titulo = r.title?.length > 25 ? r.title.substring(0, 25) + '...' : r.title
      return {
        id: `.bc ${r.url?.replace(/&amp;/g, '&')}`,
        title: `⬇️ ${titulo}`,
        description: `${artist} • ${r.price || 'Free'}`
      }
    })

    await edit('Resultados listos.')

    await sendInteractiveMessage(sock, jid, {
      title: 'Bandcamp Search',
      text: menuText,
      footer: `OptiShield • ${results.length} tracks`,
      interactiveButtons: [
        {
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: 'Seleccionar track',
            sections: [{ title: 'Tracks encontrados', rows }]
          })
        },
        {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: '🔍 Ver en Bandcamp',
            url: `https://bandcamp.com/search?q=${encodeURIComponent(query)}`
          })
        }
      ]
    })

  } catch (err) {
    console.error('[bcsearch] Error:', err.message)
    await edit(`▸ Error: ${err.message}`)
  }

  return true
}
