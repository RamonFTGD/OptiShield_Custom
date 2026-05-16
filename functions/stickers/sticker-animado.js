import { execFile } from 'child_process'

export const meta = {
  name: 'stickerAnimado',
  commands: ['sa', 'stickeranime', 'sanime', 'stickergif'],
  priority: 4,
  premium: true,
  class: 'Herramientas'
}

async function mp4ToAnimatedWebp(sourceUrl) {
  try {
    const res = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' },
      signal: AbortSignal.timeout(25000)
    })
    if (!res.ok) return null

    const inputBuffer = Buffer.from(await res.arrayBuffer())
    if (!inputBuffer || inputBuffer.length < 500) return null

    return await new Promise((resolve) => {
      const proc = execFile('ffmpeg', [
        '-y',
        '-i', 'pipe:0',
        '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
        '-vcodec', 'libwebp_anim',
        '-lossless', '0',
        '-quality', '80',
        '-loop', '0',
        '-preset', 'default',
        '-an', '-vsync', '0',
        '-f', 'webp',
        'pipe:1'
      ], { encoding: 'buffer', timeout: 40000 }, (err, stdout) => {
        if (err || !stdout?.length) return resolve(null)
        resolve(stdout)
      })

      proc.stdin.write(inputBuffer)
      proc.stdin.end()
    })
  } catch (err) {
    console.error(`❌ mp4ToAnimatedWebp falló: ${err.message}`)
    return null
  }
}

function getUserPhone(mensaje) {
  const jid =
    mensaje?.key?.participant ||
    mensaje?.key?.participantAlt    ||
    mensaje?.key?.remoteJid  ||
    mensaje?.key?.remoteJidAlt

  if (!jid || jid.endsWith('@g.us')) return null
  return jid
}

export default async function (mensaje, sock, ctx) {
  const { chatId } = ctx

  const phone = getUserPhone(mensaje)
  if (!phone) return true

  const fullText =
    mensaje.message?.conversation ||
    mensaje.message?.extendedTextMessage?.text || ''

  const query = fullText.trim().split(/\s+/).slice(1).join(' ').trim()

  if (!query) {
    await sock.sendMessage(chatId, {
      text: '🎭 *Sticker Animado*\n\n💡 Uso: *.sa <búsqueda>*\n\nEjemplos:\n• .sa beso anime\n• .sa gato gracioso'
    }, { quoted: mensaje })
    return true
  }

  await sock.sendMessage(chatId, {
    text: `🔍 Buscando sticker animado de *"${query}"*...\n⏳ Espera un momento`
  }, { quoted: mensaje })

  try {
    const result = await global.OptiShield.callApi('gifSearch', { query })
    const gifs = result?.result?.gifs || []

    if (!gifs.length) {
      await sock.sendMessage(chatId, {
        text: `❌ No encontré resultados para *"${query}"*\n\n💡 Prueba con otra búsqueda`
      }, { quoted: mensaje })
      return true
    }

    const elegido = gifs[Math.floor(Math.random() * gifs.length)]
    const mp4Url = elegido?.url

    if (!mp4Url) {
      await sock.sendMessage(chatId, { text: '❌ Error al obtener el GIF' }, { quoted: mensaje })
      return true
    }

    const webpBuf = await mp4ToAnimatedWebp(mp4Url)

    if (!webpBuf) {
      await sock.sendMessage(chatId, {
        text: '❌ No se pudo convertir el GIF a sticker\n\n💡 Intenta de nuevo'
      }, { quoted: mensaje })
      return true
    }

    await sock.sendMessage(chatId, { sticker: webpBuf, isAnimated: true }, { quoted: mensaje })

  } catch (err) {
    console.error(`❌ Error en stickerAnimado:`, err.message)
    await sock.sendMessage(chatId, {
      text: `❌ Error al crear el sticker: ${err.message}`
    }, { quoted: mensaje })
  }

  return true
}
