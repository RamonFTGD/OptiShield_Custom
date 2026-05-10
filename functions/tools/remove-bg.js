import { downloadContentFromMessage } from '@whiskeysockets/baileys'
import https from 'https'
import http from 'http'

export const meta = {
  name: 'remove-bg',
  commands: ['removebg', 'rembg', 'sinfonfo', 'quitarfondo'],
  priority: 4,
  premium: true,
  class: 'Editores',
}

async function updateLog(sock, chatId, logKey, text) {
  try { if (logKey) await sock.sendMessage(chatId, { text, edit: logKey }) } catch { }
}

async function downloadMedia(message, type) {
  const stream = await downloadContentFromMessage(message, type)
  let buffer = Buffer.alloc(0)
  for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
  return buffer
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, { timeout: 30_000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return fetchBuffer(res.headers.location).then(resolve).catch(reject)
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

function getQuoted(msg) {
  const m = msg.message
  if (!m) return null
  const type    = Object.keys(m)[0]
  const content = m[type]
  if (!content?.contextInfo?.quotedMessage) return null
  const qType = Object.keys(content.contextInfo.quotedMessage)[0]
  return { type: qType, message: content.contextInfo.quotedMessage[qType] }
}

async function uploadToTmpApi(imageBuffer, apikey) {
  
  return 
}

export default async function (msg, sock, ctx) {
  const { text, info } = ctx
  const chatId = msg.key.remoteJid
  const apikey = info?.user?.apikey

  if (!apikey) {
    await sock.sendMessage(chatId, { text: '⚠️ APIKEY no disponible' }, { quoted: msg })
    return true
  }

  const urlInText  = text.match(/https?:\/\/\S+/)?.[0]
  const quoted     = getQuoted(msg)
  const directType = msg.message ? Object.keys(msg.message)[0] : null

  const hasQuotedImage = quoted?.type === 'imageMessage'
  const hasDirectImage = directType === 'imageMessage'

  if (!urlInText && !hasQuotedImage && !hasDirectImage) {
    await sock.sendMessage(chatId, {
      text: '❌ Envía o responde a una imagen con el comando.\n\n*.removebg* — responde a una imagen\n*.removebg https://...* — con una URL'
    }, { quoted: msg })
    return true
  }

  let logKey = null

  try {
    const { key } = await sock.sendMessage(chatId, { text: '🖼️ Eliminando fondo...' }, { quoted: msg })
    logKey = key

    let imageUrl = urlInText

    if (!imageUrl) {
      await updateLog(sock, chatId, logKey, '📥 Descargando imagen...')

      const imgMessage = hasQuotedImage ? quoted.message : msg.message[directType]
      const buf        = await downloadMedia(imgMessage, 'image')

      await updateLog(sock, chatId, logKey, '📤 Subiendo imagen...')
      imageUrl = await (await global.OptiShield.uploadFile(buf)).archivo
    }

    await updateLog(sock, chatId, logKey, '✂️ Procesando imagen...')

    const dl = await global.OptiShield.callApi('removebg', { link: imageUrl, apikey })

    if (dl.error || !dl?.result?.image) {
      await updateLog(sock, chatId, logKey, `❌ ${dl.error || 'No se pudo eliminar el fondo.'}`)
      return true
    }

    await updateLog(sock, chatId, logKey, '📤 Enviando resultado...')

    const imgBuffer = await fetchBuffer(dl.result.image)

    await sock.sendMessage(chatId, {
      image:    imgBuffer,
      caption:  '✅ Fondo eliminado',
      mimetype: 'image/png',
    }, { quoted: msg })

    await updateLog(sock, chatId, logKey, '✅ ¡Listo!')

  } catch (err) {
    if (logKey) await updateLog(sock, chatId, logKey, `❌ ${err.message}`)
    else await sock.sendMessage(chatId, { text: `❌ ${err.message}` }, { quoted: msg })
  }

  return true
}
