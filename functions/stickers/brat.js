import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { randomUUID } from 'crypto'

export const meta = {
  name: 'brat',
  commands: ['brat'],
  priority: 4,
  premium: true,
  class: 'Fun'
}

export default async function (msg, sock, ctx) {
  const { info, isGroup, admins, text } = ctx
  const chatId = msg.key.remoteJid

  if (!text) {
    await sock.sendMessage(
      chatId,
      { text: '✍️ Escribe un texto para generar el BRAT' },
      { quoted: msg }
    )
    return true
  }

  const apikey = info?.user?.apikey
  if (!apikey) {
    await sock.sendMessage(
      chatId,
      { text: '⚠️ APIKEY no disponible' },
      { quoted: msg }
    )
    return true
  }

  const res = await global.OptiShield.callApi(
      'brat',
      { text, apikey }
    )

    if (res.error) {
      await sock.sendMessage(
        chatId,
        {
          text: `❌ ${res?.error || 'Error desconocido en la API'}`
        },
        { quoted: msg }
      )
      return true
    }

    const data = res

  if (data.status !== 'ok' || !data.result?.img) {
    await sock.sendMessage(
      chatId,
      { text: '❌ No se pudo generar el brat' },
      { quoted: msg }
    )
    return true
  }

  const id = randomUUID()
  const input = path.join('./tmp', `${id}.png`)
  const output = path.join('./tmp', `${id}.webp`)

  try {
    
    const buffer = Buffer.from(
      await (await fetch(data.result.img)).arrayBuffer()
    )
    fs.writeFileSync(input, buffer)

    
    await sharp(input)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .webp({ quality: 90 })
      .toFile(output)

    
    await sock.sendMessage(
      chatId,
      { sticker: fs.readFileSync(output) },
      { quoted: msg }
    )

  } catch (err) {
    console.error('❌ BRAT STICKER ERROR:', err)
    await sock.sendMessage(
      chatId,
      { text: '❌ Error al crear el sticker' },
      { quoted: msg }
    )
  } finally {
    try {
      fs.unlinkSync(input)
      fs.unlinkSync(output)
    } catch {}
  }

  return true
}
