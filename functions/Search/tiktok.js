import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { sendInteractiveMessage } = require('gifted-btns')

export const meta = {
  name: 'TikTokSearch',
  commands: ['tiktoksearch', 'tks', 'buscartiktok', 'ttk'],
  priority: 5,
  premium: true,
  class: 'Buscadores',
}

function formatNum(num) {
  if (!num && num !== 0) return '?'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return String(num)
}

export default async function (msg, sock, ctx) {
  const jid    = msg.key.remoteJid
  const query  = ctx.args.join(' ')
  const apikey = ctx?.info?.user?.apikey

  if (!query) {
    await sock.sendMessage(jid, { text: '❌ Debes escribir algo.\nEjemplo: `.tks Gojo edits`' })
    return true
  }

  const statusMsg = await sock.sendMessage(jid, {
    text: `🎵 Buscando en TikTok: *${query}*...`
  }, { quoted: msg })
  const edit = async (text) => { try { await sock.sendMessage(jid, { text, edit: statusMsg.key }) } catch { } }

  try {
    const res = await global.OptiShield.callApi('tiktoksearch', { query, apikey })

    if (res.error) { await edit(`❌ ${res.error}`); return true }
    if (!res?.result?.success || !res?.result?.videos?.length) { await edit('❌ Sin resultados.'); return true }

    const results = res.result.videos.slice(0, 10)

    let menuText = `🎵 *Búsqueda TikTok:* ${query}\n`
    menuText += `📊 *Resultados:* ${results.length}\n\n`

    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      const titulo = (r.title || 'Sin título').substring(0, 50)
      menuText += `*${i + 1}.* ${titulo}${r.title?.length > 50 ? '...' : ''}\n`
      menuText += `   👤 @${r.author?.unique_id || '?'} • ❤️ ${formatNum(r.stats?.likes)} • ⏱️ ${r.duration}s\n\n`
    }

    menuText += `_Selecciona un video para descargarlo_`

    const rows = results.map((r, i) => {
      const titulo   = (r.title || 'Sin título').substring(0, 22)
      const videoUrl = `https://www.tiktok.com/@${r.author?.unique_id}/video/${r.video_id}`
      return {
        id: `.tiktok ${videoUrl}`,
        title: `🎵 ${titulo}${(r.title?.length || 0) > 22 ? '...' : ''}`,
        description: `👤 @${r.author?.unique_id || '?'} • ❤️ ${formatNum(r.stats?.likes)} • ⏱️ ${r.duration}s`
      }
    })

    await edit('✅ Resultados listos...')

    await sendInteractiveMessage(sock, jid, {
      title: '🎵 TikTok Search',
      text: menuText,
      footer: `OptiShield • ${results.length} videos`,
      interactiveButtons: [
        {
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '🎵 Seleccionar video',
            sections: [{ title: '🎵 Videos encontrados', rows }]
          })
        },
        {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: '🎵 Ver en TikTok',
            url: `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`
          })
        }
      ]
    })

  } catch (err) {
    console.error('❌ tiktok search error:', err)
    await edit(`❌ Error: ${err.message}`)
  }

  return true
}
