import https from 'https'
import http from 'http'
import { createRequire } from 'module'
import { spawn } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { unlink } from 'fs/promises'
import { randomBytes } from 'crypto'
import { generateWAMessageFromContent, prepareWAMessageMedia } from '@whiskeysockets/baileys'
const require = createRequire(import.meta.url)
const { sendInteractiveMessage } = require('gifted-btns')

export const meta = {
  name: 'Reddit',
  commands: ['reddit', 'rd', 'redditsearch', 'rdl', 'redditdl', 'rd_video', 'rd_audio'],
  priority: 3,
  premium: true,
  class: 'Descargadores',
}

async function updateLog(sock, chatId, logKey, text) {
  try { if (logKey) await sock.sendMessage(chatId, { text, edit: logKey }) } catch { }
}

function isRedditUrl(text) {
  return /reddit\.com\/r\//i.test(text) || /redd\.it\//i.test(text)
}

function progressBar(step, total = 4) {
  const filled = Math.round((step / total) * 10)
  return `[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}] ${Math.round((step / total) * 100)}%`
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

async function extractAudio(videoUrl) {
  return new Promise((resolve, reject) => {
    const outPath = join(tmpdir(), `rd_audio_${randomBytes(6).toString('hex')}.mp3`)
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

async function handleDownload(msg, sock, ctx, url) {
  const chatId = msg.key.remoteJid
  const apikey = ctx.info?.user?.apikey
  let logKey = null

  try {
    const { key } = await sock.sendMessage(chatId, {
      text: `⬇️ Analizando post de Reddit...\n\n${progressBar(0)}`
    }, { quoted: msg })
    logKey = key

    await updateLog(sock, chatId, logKey, `🔗 Obteniendo información...\n\n${progressBar(1)}`)

    const dl = await global.OptiShield.callApi('reddit-dl', { url, apikey })

    if (dl.error || !dl?.result) {
      await updateLog(sock, chatId, logKey, `❌ ${dl.error || 'No se pudo descargar este post.'}`)
      return
    }

    const result = dl.result
    const caption = `*${result.title}*\n👤 ${result.author} • ${result.subreddit}`

    await updateLog(sock, chatId, logKey,
      `📋 *${result.title.substring(0, 60)}*\n👤 ${result.author} • ${result.subreddit}\n\n${progressBar(2)}\n\n🎬 Preparando...`
    )

    if (result.type === 'video') {
      await sendInteractiveMessage(sock, chatId, {
        title: '🟠 Reddit Video',
        text:
          `🎬 *${result.title.substring(0, 100)}*\n\n` +
          `👤 ${result.author} • ${result.subreddit}\n\n` +
          `¿Cómo quieres el contenido?`,
        footer: 'OptiShield • Reddit Downloader',
        interactiveButtons: [
          {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: '🎬 Descargar Video',
              id: `.rd_video ${result.url}`
            })
          },
          {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: '🎵 Solo Audio MP3',
              id: `.rd_audio ${result.url}`
            })
          },
          {
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
              display_text: '🟠 Ver en Reddit',
              url,
              merchant_url: url
            })
          }
        ]
      })
      await updateLog(sock, chatId, logKey, `${progressBar(4)}\n\n✅ Selecciona una opción arriba`)

    } else if (result.type === 'image') {
      const imgBuf = await fetchBuffer(result.url)
      await updateLog(sock, chatId, logKey, `📤 Enviando imagen...\n\n${progressBar(3)}`)
      await sock.sendMessage(chatId, { image: imgBuf, caption: `🖼️ ${caption}` }, { quoted: msg })
      await updateLog(sock, chatId, logKey, `${progressBar(4)}\n\n✅ ¡Listo!`)

    } else if (result.type === 'gallery' && result.images?.length) {
      const images = result.images.slice(0, 10)
      await updateLog(sock, chatId, logKey, `🖼️ Galería: ${images.length} imágenes\n\n${progressBar(2)}`)

      if (images.length === 1) {
        const buf = await fetchBuffer(images[0])
        await sock.sendMessage(chatId, { image: buf, caption: `🖼️ ${caption}` }, { quoted: msg })
        await updateLog(sock, chatId, logKey, `${progressBar(4)}\n\n✅ ¡Listo!`)
      } else {
        await updateLog(sock, chatId, logKey, `⏫ Subiendo ${images.length} imágenes...\n\n${progressBar(3)}`)
        const medias = await Promise.all(
          images.map(async (u) => {
            const buf = await fetchBuffer(u)
            return { image: buf }
          })
        )
        medias[0].caption = `🖼️ ${caption}`
        await sock.sendAlbumMessage(chatId, medias, { quoted: msg, delay: 400 })
        medias.length = 0
        await updateLog(sock, chatId, logKey, `${progressBar(4)}\n\n✅ ¡${images.length} imágenes enviadas!`)
      }
    }

  } catch (err) {
    if (logKey) await updateLog(sock, chatId, logKey, `❌ ${err.message}`)
    else await sock.sendMessage(chatId, { text: `❌ ${err.message}` }, { quoted: msg })
  }
}

async function handleSearch(msg, sock, ctx, query) {
  const chatId = msg.key.remoteJid
  const apikey = ctx.info?.user?.apikey

  const statusMsg = await sock.sendMessage(chatId, {
    text: `🔍 Buscando en Reddit: *${query}*...`
  }, { quoted: msg })
  const edit = async (text) => { try { await sock.sendMessage(chatId, { text, edit: statusMsg.key }) } catch { } }

  let subreddit = null
  let q = query
  const rMatch = query.match(/r\/([a-zA-Z0-9_]+)/i)
  if (rMatch) { subreddit = rMatch[1]; q = query.replace(/r\/[a-zA-Z0-9_]+/i, '').trim() }

  const res = await global.OptiShield.callApi('reddit-search', {
    q: q || undefined,
    subreddit: subreddit || undefined,
    limit: '8',
    sort: 'relevance',
    apikey
  })

  if (res.error || !res?.result?.results?.length) {
    await edit('❌ Sin resultados en Reddit.')
    return
  }

  const results = res.result.results.slice(0, 8)

  let menuText = `🟠 *Búsqueda Reddit:* ${query}\n`
  menuText += `📊 *Resultados:* ${results.length}\n\n`

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const emoji = r.type === 'video' ? '🎬' : r.type === 'gallery' ? '🖼️' : r.type === 'image' ? '📷' : '📝'
    const titulo = r.title.substring(0, 55)
    menuText += `*${i + 1}.* ${emoji} ${titulo}${r.title.length > 55 ? '...' : ''}\n`
    menuText += `   👤 ${r.author} • ${r.subreddit} • ⬆️ ${r.score.toLocaleString()}\n\n`
  }

  menuText += `_Selecciona un post para descargarlo_`

  const rows = results.map((r, i) => {
    const emoji = r.type === 'video' ? '🎬' : r.type === 'gallery' ? '🖼️' : r.type === 'image' ? '📷' : '📝'
    const titulo = r.title.substring(0, 22)
    return {
      id: `.rdl ${r.url}`,
      title: `${emoji} ${titulo}${r.title.length > 22 ? '...' : ''}`,
      description: `👤 ${r.author} • ⬆️ ${r.score.toLocaleString()} • 💬 ${r.comments.toLocaleString()}`
    }
  })

  await edit('✅ Resultados listos...')

  await sendInteractiveMessage(sock, chatId, {
    title: '🟠 Reddit Search',
    text: menuText,
    footer: `OptiShield • ${results.length} posts`,
    interactiveButtons: [
      {
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: '🟠 Seleccionar post',
          sections: [{ title: '📋 Posts encontrados', rows }]
        })
      },
      {
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({
          display_text: '🟠 Ver en Reddit',
          url: subreddit
            ? `https://www.reddit.com/r/${subreddit}/search/?q=${encodeURIComponent(q)}`
            : `https://www.reddit.com/search/?q=${encodeURIComponent(query)}`
        })
      }
    ]
  })
}

export default async function (msg, sock, ctx) {
  const { text, command, info } = ctx
  const chatId = msg.key.remoteJid
  const apikey = info?.user?.apikey

  if (!apikey) {
    await sock.sendMessage(chatId, { text: '⚠️ APIKEY no disponible' }, { quoted: msg })
    return true
  }

  if (command === 'rd_video') {
    const url = text.trim()
    if (!url) return true
    const { key: logKey } = await sock.sendMessage(chatId, {
      text: `📥 Enviando video...\n\n${progressBar(2)}`
    }, { quoted: msg })
    try {
      const buf = await fetchBuffer(url)
      await updateLog(sock, chatId, logKey, `📤 Enviando...\n\n${progressBar(3)}`)
      await sock.sendMessage(chatId, { video: buf, mimetype: 'video/mp4', caption: '🎬 _Descargado con OptiShield_' }, { quoted: msg })
      await updateLog(sock, chatId, logKey, `${progressBar(4)}\n\n✅ ¡Listo!`)
    } catch (err) {
      await updateLog(sock, chatId, logKey, `❌ Error: ${err.message}`)
    }
    return true
  }

  if (command === 'rd_audio') {
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

  const query = text.trim()

  if (!query) {
    await sock.sendMessage(chatId, {
      text:
        `🟠 *Reddit Buscador & Descargador*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📝 *.reddit <búsqueda>* — Buscar posts\n` +
        `⬇️ *.rdl <url>* — Descargar video/imagen/galería\n\n` +
        `*Ejemplos:*\n` +
        `• \`.reddit memes r/dankmemes\`\n` +
        `• \`.rdl https://reddit.com/r/...\``
    }, { quoted: msg })
    return true
  }

  if (command === 'rdl' || command === 'redditdl' || isRedditUrl(query)) {
    await handleDownload(msg, sock, ctx, query)
  } else {
    await handleSearch(msg, sock, ctx, query)
  }

  return true
}
