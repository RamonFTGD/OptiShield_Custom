export const meta = {
  name: 'lyrics',
  commands: ['lyrics', 'letra', 'lyric'],
  priority: 4,
  premium: true,
  class: 'Herramientas',
  description: 'Obtiene la letra de canciones desde YouTube',
}

export default async function (msg, sock, ctx) {
  const chatId = msg.key.remoteJid
  const fullText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
  const match = fullText.match(/^\.?(lyrics|letra|lyric)\s+(.+)/i)

  if (!match) {
    await sock.sendMessage(chatId, {
      text:
        `📝 *Letras de canciones*
${'─'.repeat(28)}
Obtén la letra de cualquier canción.

◆ ${'.lyrics <nombre canción>'}
◆ ${'.lyrics <URL de YouTube>'}

◆ .lyrics Bohemian Rhapsody
◆ .lyrics https://youtube.com/watch?v=...

⚡ OptiShield`
    }, { quoted: msg })
    return true
  }

  const query = match[2].trim()
  if (!query) {
    await sock.sendMessage(chatId, { text: '❌ Escribe el nombre de una canción.' }, { quoted: msg })
    return true
  }

  await sock.sendMessage(chatId, { react: { text: '🎵', key: msg.key } })
  await sock.sendMessage(chatId, { text: '⏳ Buscando letra...' }, { quoted: msg })

  try {
    const isUrl = query.includes('youtube.com') || query.includes('youtu.be')
    const params = isUrl ? { url: query } : { query }
    const apiResponse = await global.OptiShield.callApi("yt-lyrics", params)

    if (apiResponse.result?.error) {
      await sock.sendMessage(chatId, { text: `❌ Sin subtítulos para ese video.` }, { quoted: msg })
      await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } })
      return true
    }

    if (!apiResponse.result?.success || !apiResponse.result?.lyrics) {
      throw new Error('No se pudieron obtener los subtítulos')
    }

    const result = apiResponse.result
    let caption = `🎵 *Letra de la canción*\n${'━'.repeat(28)}\n\n`
    caption += `📌 ${result.songTitle || 'Desconocido'}\n`
    caption += `🎤 ${result.videoChannel || 'Desconocido'}\n`
    caption += `⏱️ ${result.videoDuration || 'N/A'} • ⚡ ${result.ping}ms\n\n`
    if (result.videoUrl) caption += `🔗 ${result.videoUrl}\n\n`
    caption += `${'━'.repeat(28)}\n\n${result.lyrics}\n\n⚡ OptiShield`

    if (result.videoThumbnail) {
      await sock.sendMessage(chatId, { image: { url: result.videoThumbnail }, caption }, { quoted: msg })
    } else {
      await sock.sendMessage(chatId, { text: caption }, { quoted: msg })
    }
    await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } })

  } catch (err) {
    console.error('❌ LYRICS ERROR:', err)
    await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } })
    await sock.sendMessage(chatId, { text: `❌ Error: ${err.message || 'No se pudo obtener la letra'}` }, { quoted: msg })
  }
  return true
}
