import { createRequire } from 'module'
import { spawn } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { unlink } from 'fs/promises'
import { randomBytes } from 'crypto'
const require = createRequire(import.meta.url)
const { sendInteractiveMessage } = require('gifted-btns')

export const meta = {
  name: 'facebookdl',
  commands: ['fb', 'facebook', 'fbdl', 'fb_video', 'fb_audio'],  // ← comandos ocultos para botones
  priority: 3,
  premium: true,
  class: 'Descargadores',
}

function isFacebookUrl(url = '') {
  return /facebook\.com|fb\.watch|fb\.gg|fb\.me|m\.facebook\.com/i.test(url)
}

function isUrl(text = '') { return /^https?:\/\//i.test(text) }

function parseDuration(str = '') {
  try {
    const parts = String(str).split(':').map(Number)
    if (parts.length === 2) return parts[0] * 60 + parts[1]
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
    return parseInt(str) || 0
  } catch { return 0 }
}

function progressBar(step, total = 4) {
  const filled = Math.round((step / total) * 10)
  return `[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}] ${Math.round((step / total) * 100)}%`
}

async function updateLog(sock, chatId, logKey, text) {
  try { await sock.sendMessage(chatId, { text, edit: logKey }) } catch { }
}

async function extractAudio(videoUrl) {
  return new Promise((resolve, reject) => {
    const outPath = join(tmpdir(), `fb_audio_${randomBytes(6).toString('hex')}.mp3`)
    const ff = spawn('ffmpeg', [
      '-y', '-i', videoUrl,
      '-vn', '-acodec', 'libmp3lame',
      '-b:a', '192k', '-ar', '44100',
      outPath
    ])
    let err = ''
    ff.stderr.on('data', d => { err += d })
    ff.on('close', code => {
      if (code !== 0) return reject(new Error(`ffmpeg falló: ${err.slice(-200)}`))
      resolve(outPath)
    })
    ff.on('error', reject)
  })
}

export default async function (msg, sock, ctx) {
  const { text, info, command } = ctx
  const chatId = msg.key.remoteJid
  const apikey = info?.user?.apikey
  let logKey = null

  // ── Comando oculto: fb_video <url> ──
  if (command === 'fb_video') {
    const videoUrl = text.trim()
    if (!videoUrl) return true
    const { key } = await sock.sendMessage(chatId, { text: `📥 Descargando video...\n\n${progressBar(2)}` }, { quoted: msg })
    logKey = key
    try {
      await updateLog(sock, chatId, logKey, `📥 Enviando video...\n\n${progressBar(3)}`)
      await sock.sendMessage(chatId, {
        video: { url: videoUrl },
        mimetype: 'video/mp4',
        caption: '✅ _Descargado con OptiShield_'
      }, { quoted: msg })
      await updateLog(sock, chatId, logKey, `${progressBar(4)}\n\n✅ ¡Listo!`)
    } catch (err) {
      await updateLog(sock, chatId, logKey, `❌ Error: ${err.message}`)
    }
    return true
  }

  if (command === 'fb_audio') {
    const videoUrl = text.trim()
    if (!videoUrl) return true
    const { key } = await sock.sendMessage(chatId, { text: `🎵 Extrayendo audio...\n\n${progressBar(1)}` }, { quoted: msg })
    logKey = key
    let audioPath = null
    try {
      await updateLog(sock, chatId, logKey, `🎵 Convirtiendo con ffmpeg...\n\n${progressBar(2)}`)
      audioPath = await extractAudio(videoUrl)
      await updateLog(sock, chatId, logKey, `📤 Enviando audio...\n\n${progressBar(3)}`)
      await sock.sendMessage(chatId, {
        audio: { url: `${audioPath}` },
        mimetype: 'audio/mpeg',
        ptt: false,
      }, { quoted: msg })
      await updateLog(sock, chatId, logKey, `${progressBar(4)}\n\n✅ ¡Audio listo!`)
    } catch (err) {
      await updateLog(sock, chatId, logKey, `❌ Error extrayendo audio: ${err.message}`)
    } finally {
      if (audioPath) unlink(audioPath).catch(() => {})
    }
    return true
  }

  if (!isUrl(text)) {
    await sock.sendMessage(chatId, {
      text: '❌ Debes enviar un link de Facebook\n\n📝 Ejemplo:\n`.fb https://www.facebook.com/xxx/videos/xxx`'
    }, { quoted: msg })
    return true
  }

  if (!isFacebookUrl(text)) {
    await sock.sendMessage(chatId, { text: '❌ El link debe ser de Facebook' }, { quoted: msg })
    return true
  }

  try {
    const { key } = await sock.sendMessage(chatId, {
      text: `⏳ Analizando link...\n\n${progressBar(0)}`
    }, { quoted: msg })
    logKey = key

    await updateLog(sock, chatId, logKey, `🔗 Obteniendo información...\n\n${progressBar(1)}`)

    const res = await global.OptiShield.callApi('facebookdl', { url: text })
    const resultData = res?.result?.data || res?.data

    if (!resultData || res?.result?.success === false) {
      await updateLog(sock, chatId, logKey,
        `❌ ${resultData?.message || res?.result?.error || 'No se pudo obtener el video'}\n\n💡 Verifica que el video no sea privado`
      )
      return true
    }

    const { url, title = 'Facebook Video', duration } = resultData
    if (!url) {
      await updateLog(sock, chatId, logKey, '❌ No se obtuvo el link de descarga')
      return true
    }

    await updateLog(sock, chatId, logKey,
      `📹 *${title}*\n${duration ? `⏱️ ${duration}\n` : ''}\n${progressBar(2)}\n\n🎬 Preparando opciones...`
    )

    await sendInteractiveMessage(sock, chatId, {
      title: '📘 Facebook Video',
      text: `📹 *${title}*\n${duration ? `⏱️ Duración: ${duration}\n` : ''}\n\n¿Cómo quieres el contenido?`,
      footer: 'OptiShield • Facebook Downloader',
      interactiveButtons: [
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({
            display_text: '🎬 Descargar Video',
            id: `.fb_video ${url}`
          })
        },
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({
            display_text: '🎵 Solo Audio MP3',
            id: `.fb_audio ${url}`
          })
        },
        {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: '🌐 Ver en Facebook',
            url: text,
            merchant_url: text
          })
        }
      ]
    })

    await updateLog(sock, chatId, logKey,
      `📹 *${title}*\n${duration ? `⏱️ ${duration}\n` : ''}\n${progressBar(4)}\n\n✅ Selecciona una opción arriba`
    )

  } catch (err) {
    console.error('❌ [FB Plugin] Error:', err.message)
    const errText = `❌ Error: ${err.message}`
    if (logKey) await updateLog(sock, chatId, logKey, errText)
    else await sock.sendMessage(chatId, { text: errText }, { quoted: msg })
  }

  return true
}
