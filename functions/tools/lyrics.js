export const meta = {
  name: 'lyrics',
  commands: ['lyrics', 'letra', 'lyric'],
  priority: 4,
  premium: true,
  class: 'Herramientas'
}

export default async function (msg, sock, ctx) {
  const chatId = msg.key.remoteJid
  const { info } = ctx
  
  const fullText =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    ''
  

  const match = fullText.match(/^\.?(lyrics|letra|lyric)\s+(.+)/i)
  
  if (!match) {
    await sock.sendMessage(
      chatId,
      { 
        text: '📝 *Uso del comando:*\n\n' +
              '• .lyrics [nombre de canción]\n' +
              '• .lyrics [URL de YouTube]\n\n' +
              '✨ *Ejemplos:*\n' +
              '• .lyrics Maluma Bronceador\n' +
              '• .lyrics https://youtube.com/watch?v=...\n\n' +
              '💡 *Tip:* También puedes usar .letra o .lyric'
      },
      { quoted: msg }
    )
    return true
  }
  
  const query = match[2].trim()
  
  if (!query) {
    await sock.sendMessage(
      chatId,
      { text: '❌ Debes proporcionar el nombre de una canción o una URL de YouTube' },
      { quoted: msg }
    )
    return true
  }
  
  await sock.sendMessage(
    chatId,
    { react: { text: "🎵", key: msg.key } }
  )
  
  await sock.sendMessage(
    chatId,
    { text: '⏳ Buscando letra...' },
    { quoted: msg }
  )
  
  try {

    const isUrl = query.includes('youtube.com') || query.includes('youtu.be')
    
    const params = {}
    
    if (isUrl) {
      params.url = query
    } else {
      params.query = query
    }
    

    const apiResponse = await global.OptiShield.callApi("yt-lyrics", params)
    
    if (apiResponse.result?.error) {
      await sock.sendMessage(
        chatId,
        { 
          text: `❌ *No se encontraron subtítulos*\n\n` +
                `📹 Video ID: ${apiResponse.result.videoId || 'N/A'}\n` +
                `💡 Sugerencia: ${apiResponse.result.hint || 'Este video puede no tener subtítulos disponibles'}\n\n` +
                `⏱️ Tiempo: ${apiResponse.result.ping}ms`
        },
        { quoted: msg }
      )
      
      await sock.sendMessage(
        chatId,
        { react: { text: "❌", key: msg.key } }
      )
      
      return true
    }
    
    if (!apiResponse.result?.success || !apiResponse.result?.lyrics) {
      throw new Error('No se pudieron obtener los subtítulos')
    }
    
    const result = apiResponse.result
    
    let caption = `🎵 *LETRA DE LA CANCIÓN*\n\n`
    caption += `📌 *Título:* ${result.songTitle || 'Desconocido'}\n`
    caption += `🎤 *Canal:* ${result.videoChannel || 'Desconocido'}\n`
    caption += `⏱️ *Duración:* ${result.videoDuration || 'N/A'}\n`
    caption += `🔍 *Método:* ${result.method || 'Desconocido'}\n`
    caption += `⚡ *Tiempo:* ${result.ping}ms\n\n`
    caption += `━━━━━━━━━━━━━━━\n\n`
    

    caption += `📝 *Información:*\n`
    caption += `Se encontraron subtítulos para esta canción.\n\n`
    
    if (result.videoUrl) {
      caption += `🔗 *Ver en YouTube:*\n${result.videoUrl}\n\n`
    }
    
    if (result.spotify) {
      caption += `🟢 *Spotify:* ${result.spotify}\n`
    }
    caption += `${result.lyrics}\n\n`
    caption += `\n👤 *API OFICIAL:* https://optishield.uk/`
    

    if (result.videoThumbnail) {
      await sock.sendMessage(
        chatId,
        { 
          image: { url: result.videoThumbnail },
          caption: caption
        },
        { quoted: msg }
      )
    } else {
      await sock.sendMessage(
        chatId,
        { text: caption },
        { quoted: msg }
      )
    }
    
    await sock.sendMessage(
      chatId,
      { react: { text: "✅", key: msg.key } }
    )
    
  } catch (err) {
    console.error('❌ LYRICS ERROR:', err)
    
    await sock.sendMessage(
      chatId,
      { react: { text: "❌", key: msg.key } }
    )
    
    await sock.sendMessage(
      chatId,
      { text: `❌ Error: ${err.message || 'No se pudo obtener la letra'}` },
      { quoted: msg }
    )
  }
  
  return true
}
