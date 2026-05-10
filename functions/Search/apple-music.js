import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { sendInteractiveMessage } = require('gifted-btns')

export const meta = {
  name: 'Apple-music-search',
  commands: ['amsearch', 'applemusic', 'am'],
  priority: 5,
  premium: true,
  class: 'Buscadores',
}

export default async function (msg, sock, ctx) {
  const jid = msg.key.remoteJid
  const query = ctx.args.join(' ')
  const apikey = ctx?.info?.user?.apikey
  const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg })

  if (!query) return reply('▸ Debes escribir algo. Ejemplo: .amsearch Blinding Lights')

  const statusMsg = await reply(`Buscando "${query}" en Apple Music...`)
  const edit = async (text) => { try { await sock.sendMessage(jid, { text, edit: statusMsg.key }) } catch { } }

  try {
    const res = await global.OptiShield.callApi('apple-music-search', { query, limit: '8', apikey })

    if (res.error || !res?.result?.results?.length) {
      await edit('▸ Sin resultados en Apple Music.')
      return true
    }

    const results = res.result.results.slice(0, 8)

    let menuText = `Resultados para: ${query}\n\n`
    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      const titulo = r.title?.length > 50 ? r.title.substring(0, 50) + '...' : r.title
      menuText += `${i + 1}. ${titulo}\n`
      menuText += `   ${r.artist || '—'} • ${r.duration || '—'}${r.explicit ? ' (E)' : ''}\n\n`
    }

    menuText += `Selecciona una canción para escuchar el preview.`

    const rows = results.map((r) => {
      const titulo = r.title?.length > 25 ? r.title.substring(0, 25) + '...' : r.title
      return {
        id: `.amdl id:${r.id}`,
        title: `${titulo}`,
        description: `${r.artist || '—'} • ${r.duration || '—'}${r.explicit ? ' (Explicit)' : ''}`
      }
    })

    await edit('Resultados listos.')

    await sendInteractiveMessage(sock, jid, {
      title: 'Apple Music',
      text: menuText,
      footer: `OptiShield • ${results.length} canciones`,
      interactiveButtons: [
        {
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: 'Seleccionar canción',
            sections: [{ title: 'Canciones encontradas', rows }]
          })
        },
        {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: '🍎 Ver en Apple Music',
            url: `https://music.apple.com/search?term=${encodeURIComponent(query)}`
          })
        }
      ]
    })

  } catch (err) {
    console.error('[amsearch] Error:', err.message)
    await edit(`▸ Error: ${err.message}`)
  }

  return true
}
