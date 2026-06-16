import { reply, editLog, ProgressBar } from '../../lib/utils.js'

export const meta = {
  name: 'GoogleImages',
  commands: ['images', 'imagenes', 'googleimg', 'img'],
  priority: 4,
  premium: true,
  class: 'Buscadores',
  description: 'Busca imágenes en Google'
}

export default async function (msg, sock, ctx) {
  const { chatId, text } = ctx

  if (!text) {
    await reply(sock, chatId,
      '🖼️ *Buscador de Imágenes Google*\n\n' +
      'Busca imágenes en Google y las envía.\n\n' +
      '📝 *.images <búsqueda>*\n\n' +
      '✨ *Ejemplos:*\n' +
      '• .images paisajes 4k\n' +
      '• .images gato siamés\n' +
      '• .img anime wallpaper',
      msg)
    return true
  }

  const { key: logKey } = await sock.sendMessage(chatId, { text: `🔍 Buscando imágenes de "${text}"...` }, { quoted: msg })

  try {
    const res = await global.OptiShield.callApi('googleImages', { q: text })

    if (res.error) {
      await sock.sendMessage(chatId, { text: `❌ ${res.error}`, edit: logKey })
      return true
    }

    const images = res.result?.images || res.result?.results || []
    if (!images.length) {
      await sock.sendMessage(chatId, { text: `❌ No se encontraron imágenes para "${text}"`, edit: logKey })
      return true
    }

    const validImages = images
      .filter(img => typeof (img.url || img.archivo || img) === 'string')
      .slice(0, 6)

    if (!validImages.length) {
      await sock.sendMessage(chatId, { text: '❌ No hay imágenes válidas para mostrar', edit: logKey })
      return true
    }

    await editLog(sock, chatId, logKey, `🖼️ Enviando ${validImages.length} imágenes...\n\n${ProgressBar(3)}`)

    for (let i = 0; i < validImages.length; i++) {
      const imgUrl = validImages[i].url || validImages[i].archivo || validImages[i]
      await sock.sendMessage(chatId, {
        image: { url: imgUrl },
        caption: i === 0
          ? `🖼️ *${text}*\n📊 ${validImages.length} resultados\n\n⚡ OptiShield`
          : `🖼️ ${i + 1}/${validImages.length}`
      }, { quoted: msg })
      await new Promise(r => setTimeout(r, 300))
    }

    await sock.sendMessage(chatId, { text: `✅ ${validImages.length} imágenes enviadas\n\n${ProgressBar(4)}`, edit: logKey })

  } catch (err) {
    console.error('❌ GoogleImages error:', err)
    await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}`, edit: logKey })
  }

  return true
}
