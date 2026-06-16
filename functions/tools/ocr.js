import { reply, editLog, getQuoted, downloadMedia, fetchBuffer } from '../../lib/utils.js'

export const meta = {
  name: 'OCR',
  commands: ['ocr', 'leer', 'read'],
  priority: 4,
  premium: true,
  class: 'Herramientas',
  description: 'Extrae texto de imágenes usando IA'
}

export default async function (msg, sock, ctx) {
  const { chatId } = ctx
  const quoted = getQuoted(msg)
  const urlInText = ctx.text.match(/https?:\/\/[^\s]+/)?.[0]

  if (!quoted && !urlInText) {
    await reply(sock, chatId,
      `👁️ *OCR — Reconocimiento de texto*
${'─'.repeat(28)}
Extrae texto de imágenes usando IA avanzada.
Excelente para texto borroso o de baja calidad.

◆ Responde a una imagen con .ocr
◆ O usa: .ocr <url-de-imagen>

◆ *(responde a una imagen)*

Soporta: imágenes, capturas, fotos de documentos
⚡ OptiShield OCR`,
      msg)
    return true
  }

  const { key: logKey } = await sock.sendMessage(chatId, { text: '👁️ Analizando imagen...' }, { quoted: msg })

  try {
    let imageUrl = urlInText
    if (!imageUrl && quoted) {
      await editLog(sock, chatId, logKey, '📥 Descargando imagen...')
      const buffer = await downloadMedia(quoted.message, 'image')
      await editLog(sock, chatId, logKey, '📤 Subiendo imagen...')
      const uploadRes = await global.OptiShield.uploadFile(buffer)
      imageUrl = uploadRes.archivo
    }

    if (!imageUrl) {
      await sock.sendMessage(chatId, { text: '❌ No se pudo obtener la imagen', edit: logKey })
      return true
    }

    const res = await global.OptiShield.callApi('ocr', { url: imageUrl })

    if (res.error) {
      await sock.sendMessage(chatId, { text: `❌ ${res.error}`, edit: logKey })
      return true
    }

    const text = res.result?.text || res.result?.ocr || ''
    if (!text) {
      await sock.sendMessage(chatId, { text: '❌ No se encontró texto en la imagen', edit: logKey })
      return true
    }

    const finalText = `👁️ *Texto extraído*\n${'━'.repeat(28)}\n\n${text.slice(0, 4000)}\n\n${'━'.repeat(28)}\n⚡ OptiShield OCR`
    await sock.sendMessage(chatId, { text: finalText, edit: logKey })

  } catch (err) {
    console.error('❌ OCR error:', err)
    await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}`, edit: logKey })
  }

  return true
}
