import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { sendInteractiveMessage } = require('gifted-btns')

export const meta = {
  name: 'YoutubeSearch',
  commands: ['ytsearch', 'yts', 'buscaryt'],
  priority: 5,
  premium: true,
  class: 'Buscadores',
  description: 'Busca videos en YouTube con resultados interactivos',
}

export default async function (msg, sock, ctx) {
  const { chatId, prefix, args } = ctx
  const query = args.join(' ').trim()

  if (!query) {
    await sock.sendMessage(chatId, {
      text: `🔍 *YouTube Search*
${'─'.repeat(28)}
Busca videos y descarga MP3 o MP4.

◆ ${prefix}yts <búsqueda>

◆ ${prefix}yts Ghost Mary On A Cross

Selecciona 🎵 para MP3 o 🎬 para MP4
⚡ OptiShield`
    }, { quoted: msg })
    return true
  }

  const statusMsg = await sock.sendMessage(chatId, { text: `🔍 Buscando "${query}" en YouTube...` }, { quoted: msg })
  const edit = async (text) => { try { await sock.sendMessage(chatId, { text, edit: statusMsg.key }) } catch { } }

  try {
    const res = await global.OptiShield.callApi('youtubeSearch', { q: query })
    if (res.error || !res?.result?.results?.length) { await edit('❌ No se encontraron resultados.'); return true }

    const results = res.result.results.slice(0, 8)
    const firstVideoThumb = results[0]?.thumbnail || null
    const sections = []

    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      const titulo = r.title.length > 60 ? r.title.substring(0, 60) + '...' : r.title
      sections.push({
        title: `${i + 1}. ${titulo.substring(0, 24)}${titulo.length > 24 ? '...' : ''}`,
        rows: [
          { id: `.play ${r.url}`, title: `🎵 ${titulo.substring(0, 20)}${titulo.length > 20 ? '...' : ''}`, description: `MP3 • ${r.duration} • ${r.channel}` },
          { id: `.play2 ${r.url}`, title: `🎬 ${titulo.substring(0, 20)}${titulo.length > 20 ? '...' : ''}`, description: `MP4 • ${r.duration} • ${r.channel}` }
        ]
      })
    }

    let menuText = `🔎 Búsqueda: ${query}\n📊 Resultados: ${results.length}\n\n`
    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      const titulo = r.title.length > 50 ? r.title.substring(0, 50) + '...' : r.title
      menuText += `${i + 1}. ${titulo}\n   👤 ${r.channel} • ⏱️ ${r.duration}\n\n`
    }
    menuText += `Selecciona 🎵 para MP3 o 🎬 para MP4`

    await edit('✅ Resultados listos...')
    await sendInteractiveMessage(sock, chatId, {
      title: '🔍 YouTube Search',
      text: menuText,
      footer: `OptiShield • ${results.length} videos`,
      imageUrl: firstVideoThumb,
      interactiveButtons: [
        {
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '🎵 Seleccionar video',
            sections
          })
        },
        {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: '🔍 Buscar en YouTube',
            url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
          })
        }
      ]
    }, { quoted: msg })

  } catch (err) {
    console.error('❌ [ytsearch]', err.message)
    await edit(`❌ Error: ${err.message}`)
  }
  return true
}
