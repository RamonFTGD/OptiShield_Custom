import { createRequire } from 'module'
import { spawn } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { unlink } from 'fs/promises'
import { randomBytes } from 'crypto'
const require = createRequire(import.meta.url)
const { sendInteractiveMessage } = require('gifted-btns')

export const meta = {
  name: 'pindl',
  commands: ['pin', 'pindl', 'pinterest', 'pin_image', 'pin_video', 'pin_audio'],
  priority: 5,
  premium: true,
  class: 'Descargadores',
}

function isPinterestUrl(url = '') {
  return /pinterest\.com|pin\.it/i.test(url)
}

function isDirectUrl(url = '') {
  return /\.(jpg|jpeg|png|webp|gif|mp4|webm)(\?|$)/i.test(url)
}

function isUrl(text = '') { return /^https?:\/\//i.test(text) }

function progressBar(step, total = 4) {
  const filled = Math.round((step / total) * 10)
  return `[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}] ${Math.round((step / total) * 100)}%`
}

async function updateLog(sock, jid, logKey, text) {
  try { await sock.sendMessage(jid, { text, edit: logKey }) } catch { }
}

async function extractAudio(videoUrl) {
  return new Promise((resolve, reject) => {
    const outPath = join(tmpdir(), `pin_audio_${randomBytes(6).toString('hex')}.mp3`)
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
  const { command, text, args } = ctx
  const jid    = msg.key.remoteJid

  // ── Comando oculto: pin_image <url directa> ──
  if (command === 'pin_image') {
    const url = text.trim()
    if (!url) return true
    const { key: logKey } = await sock.sendMessage(jid, {
      text: `📥 Enviando imagen...\n\n${progressBar(3)}`
    }, { quoted: msg })
    try {
      await sock.sendMessage(jid, {
        image: { url },
        caption: `✅ *Imagen de Pinterest*\n\n_Descargado con OptiShield_`
      }, { quoted: msg })
      await updateLog(sock, jid, logKey, `${progressBar(4)}\n\n✅ ¡Listo!`)
    } catch (err) {
      await updateLog(sock, jid, logKey, `❌ Error: ${err.message}`)
    }
    return true
  }

  // ── Comando oculto: pin_video <url directa> ──
  if (command === 'pin_video') {
    const url = text.trim()
    if (!url) return true
    const { key: logKey } = await sock.sendMessage(jid, {
      text: `📥 Enviando video...\n\n${progressBar(3)}`
    }, { quoted: msg })
    try {
      await sock.sendMessage(jid, {
        video: { url },
        caption: `✅ *Video de Pinterest*\n\n_Descargado con OptiShield_`
      }, { quoted: msg })
      await updateLog(sock, jid, logKey, `${progressBar(4)}\n\n✅ ¡Listo!`)
    } catch (err) {
      await updateLog(sock, jid, logKey, `❌ Error: ${err.message}`)
    }
    return true
  }

  // ── Comando oculto: pin_audio <url directa> ──
  if (command === 'pin_audio') {
    const url = text.trim()
    if (!url) return true
    const { key: logKey } = await sock.sendMessage(jid, {
      text: `🎵 Extrayendo audio...\n\n${progressBar(1)}`
    }, { quoted: msg })
    let audioPath = null
    try {
      await updateLog(sock, jid, logKey, `🎵 Convirtiendo con ffmpeg...\n\n${progressBar(2)}`)
      audioPath = await extractAudio(url)
      await updateLog(sock, jid, logKey, `📤 Enviando audio...\n\n${progressBar(3)}`)
      await sock.sendMessage(jid, {
        audio: { url: `${audioPath}` },
        mimetype: 'audio/mpeg',
        ptt: false,
      }, { quoted: msg })
      await updateLog(sock, jid, logKey, `${progressBar(4)}\n\n✅ ¡Audio listo!`)
    } catch (err) {
      await updateLog(sock, jid, logKey, `❌ Error: ${err.message}`)
    } finally {
      if (audioPath) unlink(audioPath).catch(() => {})
    }
    return true
  }

  // ── Comando normal: pin <url> ──
  const url = args.join(' ').trim()

  if (!url || !isUrl(url)) {
    await sock.sendMessage(jid, {
      text:
        `❌ Debes proporcionar una URL de Pinterest\n\n` +
        `📝 *Ejemplos:*\n` +
        `• \`.pin https://www.pinterest.com/pin/xxx\`\n` +
        `• \`.pin https://pin.it/abc123\`\n\n` +
        `💡 O usa los botones de *.pinsearch*`
    }, { quoted: msg })
    return true
  }

  // ── URL directa de imagen/video (viene del pinsearch) ──
  if (isDirectUrl(url)) {
    const isVideo = /\.(mp4|webm)(\?|$)/i.test(url)

    if (isVideo) {
      const { key: logKey } = await sock.sendMessage(jid, {
        text: `📌 Contenido detectado\n\n${progressBar(2)}\n\n🎬 Preparando opciones...`
      }, { quoted: msg })

      await sendInteractiveMessage(sock, jid, {
        title: '📌 Pinterest Video',
        text: `🎬 *Video de Pinterest*\n\n¿Cómo quieres el contenido?`,
        footer: 'OptiShield • Pinterest Downloader',
        interactiveButtons: [
          {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: '🎬 Descargar Video',
              id: `.pin_video ${url}`
            })
          },
          {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: '🎵 Solo Audio MP3',
              id: `.pin_audio ${url}`
            })
          }
        ]
      })

      await updateLog(sock, jid, logKey, `${progressBar(3)}\n\n✅ Selecciona una opción arriba`)
    } else {
      const { key: logKey } = await sock.sendMessage(jid, {
        text: `📌 Enviando imagen...\n\n${progressBar(3)}`
      }, { quoted: msg })
      try {
        await sock.sendMessage(jid, {
          image: { url },
          caption: `✅ *Imagen de Pinterest*\n\n_Descargado con OptiShield_`
        }, { quoted: msg })
        await updateLog(sock, jid, logKey, `${progressBar(4)}\n\n✅ ¡Listo!`)
      } catch (err) {
        await updateLog(sock, jid, logKey, `❌ Error: ${err.message}`)
      }
    }
    return true
  }

  // ── URL de Pinterest → usar API ──
  if (!isPinterestUrl(url)) {
    await sock.sendMessage(jid, {
      text: `❌ La URL debe ser de Pinterest\n\n` +
            `Formatos válidos:\n` +
            `• https://www.pinterest.com/pin/...\n` +
            `• https://pin.it/...`
    }, { quoted: msg })
    return true
  }

  const { key: logKey } = await sock.sendMessage(jid, {
    text: `⏳ Analizando link...\n\n${progressBar(0)}`
  }, { quoted: msg })

  try {
    await updateLog(sock, jid, logKey, `🔗 Obteniendo contenido...\n\n${progressBar(1)}`)

    const res = await global.OptiShield.callApi('pinterestdl', { url })

    if (res.error || !res?.result?.success) {
      await updateLog(sock, jid, logKey,
        `❌ ${res?.result?.error || res?.error || 'No se pudo descargar el contenido'}`
      )
      return true
    }

    const result   = res.result
    const fileUrl  = result.file
    const fileType = result.info?.type || 'image'
    const filename = result.info?.filename || 'pinterest'

    await updateLog(sock, jid, logKey,
      `📌 Contenido encontrado\n\n${progressBar(2)}\n\n🎬 Preparando...`
    )

    if (fileType === 'video') {
      await sendInteractiveMessage(sock, jid, {
        title: '📌 Pinterest Video',
        text: `🎬 *Video de Pinterest*\n📁 ${filename}\n\n¿Cómo quieres el contenido?`,
        footer: 'OptiShield • Pinterest Downloader',
        interactiveButtons: [
          {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: '🎬 Descargar Video',
              id: `.pin_video ${fileUrl}`
            })
          },
          {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: '🎵 Solo Audio MP3',
              id: `.pin_audio ${fileUrl}`
            })
          },
          {
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
              display_text: '🌐 Ver en Pinterest',
              url,
              merchant_url: url
            })
          }
        ]
      })
      await updateLog(sock, jid, logKey, `${progressBar(3)}\n\n✅ Selecciona una opción arriba`)
    } else {
      await sock.sendMessage(jid, {
        image: { url: fileUrl },
        caption: `✅ *Imagen de Pinterest*\n\n📁 ${filename}\n_Descargado con OptiShield_`
      }, { quoted: msg })
      await updateLog(sock, jid, logKey, `${progressBar(4)}\n\n✅ ¡Listo!`)
    }

  } catch (err) {
    console.error('❌ pindl error:', err)
    await updateLog(sock, jid, logKey, `❌ Error: ${err.message}`)
  }

  return true
}
