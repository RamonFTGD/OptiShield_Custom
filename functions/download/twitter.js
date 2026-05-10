import { createRequire } from 'module'
import { spawn } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { unlink } from 'fs/promises'
import { randomBytes } from 'crypto'
const require = createRequire(import.meta.url)
const { sendInteractiveMessage } = require('gifted-btns')

export const meta = {
  name: 'twitter',
  commands: ['tw', 'twitter', 'xdl', 'twitterdl', 'tw_video', 'tw_audio'],
  priority: 3,
  premium: true,
  class: 'Descargadores',
}

function isUrl(text = '') { return /^https?:\/\//i.test(text) }

function isTweetUrl(url = '') {
  return url.includes('twitter.com') || url.includes('x.com') || url.includes('t.co')
}

function progressBar(step, total = 4) {
  const filled = Math.round((step / total) * 10)
  return `[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}] ${Math.round((step / total) * 100)}%`
}

async function fetchStream(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Error al descargar: ${res.status} ${res.statusText}`)
  const contentLength = Number(res.headers.get('content-length') || 0)
  const chunks = []
  let totalBytes = 0
  const reader = res.body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      totalBytes += value.length
    }
  } finally { reader.releaseLock() }
  const result = Buffer.allocUnsafe(contentLength > 0 ? contentLength : totalBytes)
  let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length }
  chunks.length = 0
  return result
}

async function updateLog(sock, chatId, logKey, newText) {
  try { await sock.sendMessage(chatId, { text: newText, edit: logKey }) }
  catch (e) { console.warn('⚠️ No se pudo editar mensaje:', e.message) }
}

async function extractAudio(videoUrl) {
  return new Promise((resolve, reject) => {
    const outPath = join(tmpdir(), `tw_audio_${randomBytes(6).toString('hex')}.mp3`)
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
  const { info, text, command } = ctx
  const chatId = msg.key.remoteJid
  const apikey = info?.user?.apikey

  if (!apikey) {
    await sock.sendMessage(chatId, { text: '⚠️ APIKEY no disponible' }, { quoted: msg })
    return true
  }

  // ── Comando oculto: tw_video <url> ──
  if (command === 'tw_video') {
    const url = text.trim()
    if (!url) return true
    const { key: logKey } = await sock.sendMessage(chatId, {
      text: `📥 Enviando video...\n\n${progressBar(2)}`
    }, { quoted: msg })
    let mediaBuffer = null
    try {
      mediaBuffer = await fetchStream(url)
      await updateLog(sock, chatId, logKey, `📤 Enviando...\n\n${progressBar(3)}`)
      await sock.sendMessage(chatId, { video: mediaBuffer, mimetype: 'video/mp4', caption: '🐦 _Descargado con OptiShield_' }, { quoted: msg })
      await updateLog(sock, chatId, logKey, `${progressBar(4)}\n\n✅ ¡Listo!`)
    } catch (err) {
      await updateLog(sock, chatId, logKey, `❌ Error: ${err.message}`)
    } finally { mediaBuffer = null }
    return true
  }

  // ── Comando oculto: tw_audio <url> ──
  if (command === 'tw_audio') {
    const url = text.trim()
    if (!url) return true
    const { key: logKey } = await sock.sendMessage(chatId, {
      text: `🎵 Extrayendo audio...\n\n${progressBar(1)}`
    }, { quoted: msg })
    let audioPath = null
    try {
      await updateLog(sock, chatId, logKey, `🎵 Convirtiendo con ffmpeg...\n\n${progressBar(2)}`)
      audioPath = await extractAudio(url)
      await updateLog(sock, chatId, logKey, `📤 Enviando audio...\n\n${progressBar(3)}`)
      await sock.sendMessage(chatId, { audio: { url: `${audioPath}` }, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg })
      await updateLog(sock, chatId, logKey, `${progressBar(4)}\n\n✅ ¡Audio listo!`)
    } catch (err) {
      await updateLog(sock, chatId, logKey, `❌ Error: ${err.message}`)
    } finally {
      if (audioPath) unlink(audioPath).catch(() => { })
    }
    return true
  }

  // ── Formato con separador: .xdl <url> | video  /  .xdl <url> | audio ──
  if (text.includes(' | ')) {
    const parts = text.split(' | ').map(p => p.trim())
    const url = parts[0]
    const action = parts[1]?.toLowerCase()

    if (!isUrl(url)) {
      await sock.sendMessage(chatId, { text: '❌ URL inválida en el separador' }, { quoted: msg })
      return true
    }

    if (action === 'audio') {
      const { key: logKey } = await sock.sendMessage(chatId, {
        text: `🎵 Extrayendo audio...\n\n${progressBar(1)}`
      }, { quoted: msg })
      let audioPath = null
      try {
        await updateLog(sock, chatId, logKey, `🎵 Convirtiendo con ffmpeg...\n\n${progressBar(2)}`)
        audioPath = await extractAudio(url)
        await updateLog(sock, chatId, logKey, `📤 Enviando audio...\n\n${progressBar(3)}`)
        await sock.sendMessage(chatId, { audio: { url: `${audioPath}` }, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg })
        await updateLog(sock, chatId, logKey, `${progressBar(4)}\n\n✅ ¡Audio listo!`)
      } catch (err) {
        await updateLog(sock, chatId, logKey, `❌ Error: ${err.message}`)
      } finally {
        if (audioPath) unlink(audioPath).catch(() => { })
      }
    } else {
      const { key: logKey } = await sock.sendMessage(chatId, {
        text: `📥 Enviando video...\n\n${progressBar(2)}`
      }, { quoted: msg })
      let mediaBuffer = null
      try {
        mediaBuffer = await fetchStream(url)
        await updateLog(sock, chatId, logKey, `📤 Enviando...\n\n${progressBar(3)}`)
        await sock.sendMessage(chatId, { video: mediaBuffer, mimetype: 'video/mp4', caption: '🐦 _Descargado con OptiShield_' }, { quoted: msg })
        await updateLog(sock, chatId, logKey, `${progressBar(4)}\n\n✅ ¡Listo!`)
      } catch (err) {
        await updateLog(sock, chatId, logKey, `❌ Error: ${err.message}`)
      } finally { mediaBuffer = null }
    }
    return true
  }

  // ── Comando normal: tw <url> ──
  const args = text.trim().split(/\s+/)

  if (!args.length || !args[0]) {
    await sock.sendMessage(chatId, {
      text:
        `❌ Debes enviar un link de Twitter/X\n\n` +
        `📌 *Uso:* \`.tw <url>\`\n\n` +
        `*Ejemplos:*\n` +
        `• \`.tw https://twitter.com/user/status/xxx\`\n` +
        `• \`.tw https://x.com/user/status/xxx\``
    }, { quoted: msg })
    return true
  }

  const url = args[0]

  if (!isUrl(url) || !isTweetUrl(url)) {
    await sock.sendMessage(chatId, {
      text:
        `❌ URL inválida\n\n` +
        `✅ *URLs válidas:*\n` +
        `• https://twitter.com/usuario/status/...\n` +
        `• https://x.com/usuario/status/...`
    }, { quoted: msg })
    return true
  }

  const { key: logKey } = await sock.sendMessage(chatId, {
    text: `⏳ Procesando tweet...\n\n${progressBar(0)}`
  }, { quoted: msg })

  let mediaBuffer = null

  try {
    await updateLog(sock, chatId, logKey, `🔍 Obteniendo contenido...\n\n${progressBar(1)}`)

    const dlData = await global.OptiShield.callApi('twitterdl', { url, apikey })
    const result = dlData?.result

    if (dlData?.error || !result?.success) {
      await updateLog(sock, chatId, logKey,
        `❌ ${dlData?.message || result?.message || 'No se pudo procesar el tweet'}\n\n` +
        `💡 Verifica que el tweet no sea privado`
      )
      return true
    }

    const { type, data } = result

    if (type === 'video') {
      const videoData = data.available?.video?.[0]
      if (!videoData?.download_url) { await updateLog(sock, chatId, logKey, '❌ No se encontró video disponible'); return true }

      await updateLog(sock, chatId, logKey,
        `✅ Video encontrado\n\n` +
        `👤 ${data.uploader || '—'} • ⏱️ ${data.durationFormatted || '0:00'}\n` +
        `📊 ${videoData.quality} • ${videoData.sizeFormatted}\n\n` +
        `${progressBar(2)}\n\n🎬 Preparando opciones...`
      )

      await sendInteractiveMessage(sock, chatId, {
        title: '𝕏 Twitter/X Video',
        text:
          `🐦 *${(data.title || 'Tweet').substring(0, 100)}*\n\n` +
          `👤 ${data.uploader || '—'} • ⏱️ ${data.durationFormatted || '0:00'}\n` +
          `📊 ${videoData.quality} • ${videoData.sizeFormatted}\n\n` +
          `¿Cómo quieres el contenido?`,
        footer: 'OptiShield • Twitter/X Downloader',
        interactiveButtons: [
          {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: '🎬 Descargar Video',
              id: `.tw_video ${videoData.download_url}`
            })
          },
          {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: '🎵 Solo Audio MP3',
              id: `.tw_audio ${videoData.download_url}`
            })
          },
          {
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
              display_text: '𝕏 Ver en Twitter/X',
              url,
              merchant_url: url
            })
          }
        ]
      })

      await updateLog(sock, chatId, logKey, `${progressBar(3)}\n\n✅ Selecciona una opción arriba`)

    } else if (type === 'images') {
      const images = data.images || []
      if (!images.length) { await updateLog(sock, chatId, logKey, '❌ No se encontraron imágenes'); return true }

      await updateLog(sock, chatId, logKey,
        `✅ ${images.length} imagen(es)\n👤 ${data.uploader || '—'}\n\n${progressBar(2)}\n\n📤 Enviando...`
      )

      const caption = `🐦 *${data.title || 'Tweet'}*\n👤 ${data.uploader || '—'}\n🖼️ ${images.length} imagen(es)`

      if (images.length === 1) {
        mediaBuffer = await fetchStream(images[0].url || images[0])
        await sock.sendMessage(chatId, { image: mediaBuffer, caption }, { quoted: msg })
      } else {
        const medias = await Promise.all(
          images.map(async (img) => {
            const buf = await fetchStream(img.url || img)
            return { image: buf }
          })
        )
        medias[0].caption = caption
        await sock.sendAlbumMessage(chatId, medias, { quoted: msg, delay: 400 })
        medias.length = 0
      }

      await updateLog(sock, chatId, logKey, `${progressBar(4)}\n\n✅ ${images.length} imagen(es) enviada(s)`)
    } else {
      await updateLog(sock, chatId, logKey, `⚠️ Tipo no reconocido: ${type}`)
    }

  } catch (e) {
    console.error('❌ twitterdl error:', e)
    await updateLog(sock, chatId, logKey, `⚠️ Error: ${e.message}`)
  } finally {
    mediaBuffer = null
  }

  return true
}
