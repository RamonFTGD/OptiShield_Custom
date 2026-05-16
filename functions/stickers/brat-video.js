import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { randomUUID } from 'crypto'

export const meta = {
  name: 'bratvideo',
  commands: ['bratvideo'],
  priority: 4,
  premium: true,
  class: 'Fun'
}

export default async function (msg, sock, ctx) {
  const { info, text } = ctx
  const chatId = msg.key.remoteJid

  if (!text?.trim()) {
    await sock.sendMessage(
      chatId,
      { text: '✍️ Escribe un texto para generar el bratvideo\n\nEjemplo: .brat Hello World' },
      { quoted: msg }
    )
    return true
  }

  try {

    await sock.sendMessage(
      chatId,
      { text: '⏳ Generando bratvideo animado...' },
      { quoted: msg }
    )

    const res = await global.OptiShield.callApi('bratvideo', { text })

    if (res.error) {
      await sock.sendMessage(chatId, { text: res.error }, { quoted: msg })
    }

    const id = randomUUID()
    const tmpDir = './tmp'
    
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true })
    }

    const mp4 = path.join(tmpDir, `${id}.mp4`)
    const webp = path.join(tmpDir, `${id}.webp`)

    const buffer = Buffer.from(
      await (await fetch(res.result.video)).arrayBuffer()
    )
    fs.writeFileSync(mp4, buffer)

    await new Promise((resolve, reject) => {
      exec(
        `ffmpeg -y -i "${mp4}" -t 5 ` +
        `-vf "scale=512:512:force_original_aspect_ratio=decrease,fps=20" ` +
        `-c:v libwebp -lossless 0 -compression_level 6 -q:v 80 ` +
        `-loop 0 -an "${webp}"`,
        { timeout: 30000 },
        err => err ? reject(err) : resolve()
      )
    })

    await sock.sendMessage(
      chatId,
      { 
        sticker: fs.readFileSync(webp),
        mimetype: 'image/webp'
      },
      { quoted: msg }
    )

    fs.unlinkSync(mp4)
    fs.unlinkSync(webp)

  } catch (err) {
    console.error('❌ BRATVIDEO ERROR:', err)
    await sock.sendMessage(
      chatId,
      { text: `❌ Error: ${err.message || 'No se pudo crear el bratvideo'}` },
      { quoted: msg }
    )
  }

  return true
}
