import fs from 'fs'
import path from 'path'
import { downloadContentFromMessage } from '@whiskeysockets/baileys'
import { addExif } from '../../lib/sticker.js'

export const meta = {
  name: 'take-sticker',
  commands: ['take', 'wm'],
  priority: 4,
  class: 'Herramientas',
}

const PACK_ID = 'optishield-ofc'
const PACK_AUTHOR = '✧ Ramón Luna ✧'
const PACK_CATEGORIES = ['☠️']

async function stampExif(webpBuffer, name) {
  try {
    return await addExif(
      webpBuffer,
      name,
      PACK_AUTHOR,
      PACK_CATEGORIES,
      {},
      PACK_ID
    )
  } catch (err) {
    console.warn('⚠️ Error al agregar EXIF al sticker:', err.message)
    return webpBuffer
  }
}

const TMP = path.resolve('./tmp')
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true })

async function downloadMedia(message, type) {
  const stream = await downloadContentFromMessage(message, type)
  let buffer = Buffer.alloc(0)
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk])
  }
  return buffer
}

function getQuoted(msg) {
  const m = msg.message
  if (!m) return null
  const type = Object.keys(m)[0]
  const content = m[type]
  if (!content?.contextInfo?.quotedMessage) return null
  const qType = Object.keys(content.contextInfo.quotedMessage)[0]
  return {
    type: qType,
    message: content.contextInfo.quotedMessage[qType],
  }
}

/* ───────── PLUGIN ───────── */
export default async function (msg, sock, ctx) {
  const chatId = msg.key.remoteJid
  const args = ctx.args.join(' ').trim()
  const customName = args || 'OptiShield'

  let stickerMessage = null

  // Intentar obtener sticker del mensaje respondido
  const quoted = getQuoted(msg)
  if (quoted && quoted.type === 'stickerMessage') {
    stickerMessage = quoted.message
  } else {
    // Intentar obtener sticker del mensaje directo
    const type = Object.keys(msg.message || {})[0]
    if (type === 'stickerMessage') {
      stickerMessage = msg.message[type]
    }
  }

  if (!stickerMessage) {
    await sock.sendMessage(
      chatId,
      {
        text:
          '╔════════════════════════╗\n' +
          '║   🛡️  O P T I S H I E L D      ║\n' +
          '║         Sticker Take            ║\n' +
          '╠════════════════════════╣\n' +
          '║  ❌ No se detectó sticker       ║\n' +
          '╠════════════════════════╣\n' +
          '║  • Responde a un sticker        ║\n' +
          '║  • *.take <nombre>*             ║\n' +
          '║  • *.take* (usa nombre por       ║\n' +
          '║    defecto)                     ║\n' +
          '╚════════════════════════╝',
      },
      { quoted: msg }
    )
    return true
  }

  try {
    await sock.sendMessage(
      chatId,
      {
        text:
          '╔════════════════════════╗\n' +
          '║   🛡️  O P T I S H I E L D      ║\n' +
          '║       ⏳ Procesando sticker...   ║\n' +
          '╚════════════════════════╝',
      },
      { quoted: msg }
    )

    const buffer = await downloadMedia(stickerMessage, 'sticker')
    const finalSticker = await stampExif(buffer, customName)

    await sock.sendMessage(chatId, { sticker: finalSticker }, { quoted: msg })

    console.log(
      `🛡️ Sticker tomado — Name: ${customName} | Author: ${PACK_AUTHOR} | ID: ${PACK_ID}`
    )
  } catch (err) {
    console.error('❌ TAKE ERROR:', err)
    await sock.sendMessage(
      chatId,
      { text: '❌ Error al procesar el sticker: ' + err.message },
      { quoted: msg }
    )
  }

  return true
}
