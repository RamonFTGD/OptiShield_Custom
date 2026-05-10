import sharp from 'sharp'
import { downloadContentFromMessage } from '@whiskeysockets/baileys'

export const meta = {
  name: 'toimg',
  commands: ['toimg', 'img', 'topng'],
  priority: 4,
  class: 'Herramientas',
}

export default async function (msg, sock) {
  const chatId = msg.key.remoteJid
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage

  if (!quoted) {
    await sock.sendMessage(chatId, { text: '❌ Responde a una imagen o sticker' }, { quoted: msg })
    return true
  }

  const type = Object.keys(quoted)[0]
  if (!['imageMessage', 'stickerMessage', 'videoMessage'].includes(type)) {
    await sock.sendMessage(chatId, { text: '❌ Solo funciona con imágenes, stickers o videos (primer frame)' }, { quoted: msg })
    return true
  }

  try {
    await sock.sendMessage(chatId, { text: '⏳ Convirtiendo a imagen...' }, { quoted: msg })

    const stream = await downloadContentFromMessage(quoted[type], type.replace('Message', ''))
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    const output = await sharp(buffer, { failOnError: false })
      .png({ quality: 100 })
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .toBuffer()

    if (!output?.length) throw new Error('Imagen vacía o no generada')

    await sock.sendMessage(chatId, {
      image: output,
      caption: '🖼️ *Convertido a imagen PNG*\n\n✅ Alta calidad'
    }, { quoted: msg })

  } catch (e) {
    console.error('❌ Error convirtiendo imagen:', e)
    await sock.sendMessage(chatId, { text: '❌ Error al convertir. El archivo puede estar corrupto.' }, { quoted: msg })
  }

  return true
}
