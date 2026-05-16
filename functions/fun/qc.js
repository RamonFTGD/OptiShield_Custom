import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { randomUUID } from 'crypto'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { sendInteractiveMessage } = require('gifted-btns')

export const meta = {
  name: 'qc',
  commands: ['qc', 'quoted'],
  priority: 4,
  premium: true,
  class: 'Fun'
}

async function getAvatar(sock, jid) {
  try { return await sock.profilePictureUrl(jid, 'image') }
  catch { return 'https://i.ibb.co/3Fh9V6p/avatar.png' }
}

async function getDirectPinterestUrl(url, apikey) {
  try {
    if (!url.includes('i.pin') && !url.includes('pinterest')) return url
    const res = await global.OptiShield.callApi('pinterestdl', { url, apikey })
    return res?.result?.file || url
  } catch { return url }
}

export default async function (msg, sock, ctx) {
  const { info } = ctx
  const chatId = msg.key.remoteJid

  const fullText =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    ''

  const isProcess = fullText.match(/^\.?(qc|quoted)\s+PROCESS\s+/i)

  if (isProcess) {
    const processText = fullText.replace(/^\.?(qc|quoted)\s+PROCESS\s+/i, '')
    const parts = processText.split(' | ')

    if (parts.length !== 4) {
      await sock.sendMessage(chatId, { text: '❌ Formato inválido' }, { quoted: msg })
      return true
    }

    const [text, username, avatar, apiType] = parts

    await sock.sendMessage(chatId, { text: '⏳ Generando quoted...' }, { quoted: msg })

    try {
      const params = { message: text, username, avatar }

      if (apiType === 'quoted-instagram') {
        params.image = info?.bot?.menu_image || 'https://i.imgur.com/8jfJiqv.jpeg'
        if (params.image.includes('i.pin') || params.image.includes('pinterest')) {
          const pinRes = await global.OptiShield.callApi('pinterestdl', { url: params.image, apikey })
          if (pinRes?.result?.file) params.image = pinRes.result.file
        }
      }

      const res = await global.OptiShield.callApi(apiType, params)

      if (res.error || !res.result?.imagen) {
        await sock.sendMessage(chatId, { text: `❌ ${res?.error || 'No se pudo generar la quoted'}` }, { quoted: msg })
        return true
      }

      const id = randomUUID()
      const input  = path.join('./tmp', `${id}.png`)
      const output = path.join('./tmp', `${id}.webp`)

      try {
        const buffer = Buffer.from(await (await fetch(res.result.imagen)).arrayBuffer())
        fs.writeFileSync(input, buffer)
        await sharp(input)
          .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
          .webp({ quality: 90 })
          .toFile(output)
        await sock.sendMessage(chatId, { image: fs.readFileSync(output) }, { quoted: msg })
      } catch (err) {
        console.error('❌ STICKER ERROR:', err)
        await sock.sendMessage(chatId, { text: '❌ Error al crear el sticker' }, { quoted: msg })
      } finally {
        try { if (fs.existsSync(input)) fs.unlinkSync(input) } catch { }
        try { if (fs.existsSync(output)) fs.unlinkSync(output) } catch { }
      }

    } catch (err) {
      console.error('❌ QCPROCESS ERROR:', err)
      await sock.sendMessage(chatId, { text: '❌ Error: ' + err.message }, { quoted: msg })
    }

    return true
  }

  const text = fullText.replace(/^\.?(qc|quoted)\s*/i, '')

  if (!text) {
    await sock.sendMessage(chatId, {
      text: '✍️ Escribe un texto para generar la quoted\n\nEjemplo: `.qc Hola mundo`'
    }, { quoted: msg })
    return true
  }

  const apikey = info?.user?.apikey
  if (!apikey) {
    await sock.sendMessage(chatId, { text: '⚠️ APIKEY no disponible' }, { quoted: msg })
    return true
  }

  const username = msg.pushName || 'Usuario'
  const userJid  = msg.key.participant || msg.key.remoteJid
  const avatar   = await getAvatar(sock, userJid)

  const quotedTypes = [
    { name: 'WhatsApp',  api: 'quoted-whatsapp',  emoji: '💬' },
    { name: 'Instagram', api: 'quoted-instagram',  emoji: '📸' },
    { name: 'Facebook',  api: 'quoted-facebook',   emoji: '👥' },
    { name: 'Telegram',  api: 'quoted-telegram',   emoji: '✈️' },
    { name: 'TikTok',    api: 'quoted-tiktok',     emoji: '🎵' },
    { name: 'YouTube',   api: 'quoted-youtube',    emoji: '▶️' },
    { name: 'Discord',   api: 'quoted-discord',    emoji: '💬' },
  ]

  await sendInteractiveMessage(sock, chatId, {
    title: '📝 Quoted Generator',
    text:
      `📝 *GENERADOR DE QUOTED*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `👤 *Usuario:* ${username}\n` +
      `✍️ *Mensaje:* ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}\n\n` +
      `_Selecciona el estilo de quoted:_`,
    footer: 'OptiShield • Quoted Generator',
    interactiveButtons: quotedTypes.map(type => ({
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({
        display_text: `${type.emoji} ${type.name}`,
        id: `.qc PROCESS ${text} | ${username} | ${avatar} | ${type.api}`
      })
    }))
  })

  return true
}
