import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

export const meta = {
  name: 'qr',
  commands: ['qr', 'qrcode', 'generarqr'],
  priority: 4,
  premium: true,
  class: 'Herramientas',
}

const TMP = path.resolve('./tmp')
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true })

async function downloadFromUrl(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Error al descargar: ${response.statusText}`)
  return Buffer.from(await response.arrayBuffer())
}

export default async function (msg, sock, ctx) {
  const chatId = msg.key.remoteJid
  const { info } = ctx

  const args = ctx.args.join(' ').trim()

  if (!args) {
    await sock.sendMessage(chatId, {
      text:
        '📷 *QR Generator*\n\n' +
        'Genera un código QR desde cualquier texto o URL.\n\n' +
        '*Ejemplos:*\n' +
        '• *.qr https://optishield.uk*\n' +
        '• *.qr Hola mundo*\n' +
        '• *.qr +521234567890*\n\n' +
        '💡 Puedes escanear el QR con cualquier app de cámara.'
    }, { quoted: msg })
    return true
  }

  const id       = randomUUID()
  const tmpPath  = path.join(TMP, `${id}.png`)

  try {
    await sock.sendMessage(chatId, { react: { text: '⚙️', key: msg.key } })

    const apiResponse = await global.OptiShield.callApi('qr-generator', {
      text: args,
      size: 400
    })

    const result = apiResponse?.result

    if (!result?.ok) {
      throw new Error(result?.error || 'No se pudo generar el QR')
    }

    const buffer = await downloadFromUrl(result.url)
    fs.writeFileSync(tmpPath, buffer)

    const sharp = (await import('sharp')).default
    const thumbnail = await sharp(buffer)
      .resize(72, 72, { fit: 'cover' })
      .jpeg({ quality: 60 })
      .toBuffer()

    const caption =
      `📷 *Código QR generado*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📝 *Contenido:* ${result.text.length > 60 ? result.text.slice(0, 60) + '...' : result.text}\n` +
      `📐 *Tamaño:* ${result.size}x${result.size}px`

    await sock.sendMessage(chatId, {
      image: fs.readFileSync(tmpPath),
      caption,
      mimetype: 'image/png',
      jpegThumbnail: thumbnail.toString('base64')
    }, { quoted: msg })

    await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } })

  } catch (err) {
    console.error('❌ QR ERROR:', err)
    await sock.sendMessage(chatId, {
      text: `❌ Error al generar el QR: ${err.message}`
    }, { quoted: msg })
    await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } })
  } finally {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath) } catch {}
  }

  return true
}
