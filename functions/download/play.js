import https from 'https'
import http from 'http'
import net from 'net'
import { execSync } from 'child_process'
import sharp from 'sharp'
import { SocksProxyAgent } from 'socks-proxy-agent'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

export const meta = {
  name: 'play',
  commands: ['play', 'ytmp3', 'ytdl', 'mp3'],
  priority: 3,
  premium: true,
  class: 'Descargadores',
}

const SOCKS_PROXIES = ['socks5://127.0.0.1:9050']

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
  'Accept-Encoding': 'identity',
  'Referer': 'https://www.youtube.com/',
  'Origin': 'https://www.youtube.com',
}

// --- HELPERS ---
function getApiKey() {
  try {
    const searchDirs = [process.cwd(), path.dirname(fileURLToPath(import.meta.url))]
    for (const dir of searchDirs) {
      try {
        const jsonPath = path.join(dir, 'optishield.json')
        if (fs.existsSync(jsonPath)) {
          const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
          if (data.apikey) return data.apikey
        }
      } catch {}
    }
    return null
  } catch { return null }
}

function isUrl(text = '') { return /^https?:\/\//i.test(text) }

function parseDuration(durationStr) {
  try {
    const parts = durationStr.split(':').map(Number)
    if (parts.length === 2) return parts[0] * 60 + parts[1]
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
    return 0
  } catch { return 0 }
}

function progressBar(step, total = 6) {
  const filled = Math.round((step / total) * 10)
  const empty = 10 - filled
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${Math.round((step / total) * 100)}%`
}

async function updateLog(sock, chatId, logKey, text) {
  try { if (logKey) await sock.sendMessage(chatId, { text, edit: logKey }) } catch {}
}

const AUDIO_LIMIT = 1.5 * 1024 * 1024 * 1024
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function reloadTor() {
  const tryControlPort = () => new Promise((resolve) => {
    const s = net.connect(9051, '127.0.0.1', () => { s.write('AUTHENTICATE ""\r\n') })
    let authed = false
    s.on('data', (d) => {
      const r = d.toString().trim()
      if (!authed) { if (r.startsWith('250')) { authed = true; s.write('SIGNAL NEWNYM\r\n') } else { s.destroy(); resolve(false) } }
      else { s.destroy(); resolve(r.startsWith('250')) }
    })
    s.on('error', () => resolve(false))
    s.setTimeout(3000, () => { s.destroy(); resolve(false) })
  })
  const tryExec = () => { try { execSync('kill -HUP $(pidof tor) 2>/dev/null || systemctl reload tor 2>/dev/null || systemctl restart tor 2>/dev/null || true', { timeout: 5000 }); return true } catch { return false } }
  if (await tryControlPort()) return true
  return tryExec()
}

function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, options, resolve)
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('CONN_TIMEOUT')))
  })
}

async function followRedirects(url, options = {}, maxHops = 10) {
  let currentUrl = url
  for (let i = 0; i < maxHops; i++) {
    const res = await httpRequest(currentUrl, options)
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      res.resume()
      let nextUrl = res.headers.location
      if (nextUrl.startsWith('/')) { const parsed = new URL(currentUrl); nextUrl = `${parsed.origin}${nextUrl}` }
      else if (!nextUrl.startsWith('http')) { const parsed = new URL(currentUrl); nextUrl = `${parsed.origin}/${nextUrl}` }
      currentUrl = nextUrl; continue
    }
    return res
  }
  throw new Error('Demasiados redirects')
}

function drainStream(res, maxBytes) {
  return new Promise((resolve, reject) => {
    if (res.statusCode === 429) { res.resume(); return reject(new Error('RATE_LIMITED')) }
    if (res.statusCode === 403) { res.resume(); return reject(new Error('FORBIDDEN')) }
    if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP_${res.statusCode}`)) }
    const chunks = []; let totalSize = 0; let lastDataTime = Date.now()
    const watchdog = setInterval(() => { if (Date.now() - lastDataTime > 45_000) { clearInterval(watchdog); res.destroy(new Error('DOWNLOAD_STALLED')) } }, 5_000)
    res.on('data', (chunk) => { lastDataTime = Date.now(); totalSize += chunk.length; if (totalSize > maxBytes) { clearInterval(watchdog); res.destroy(); return reject(new Error('SIZE_EXCEEDED')) } chunks.push(chunk) })
    res.on('end', () => { clearInterval(watchdog); resolve(Buffer.concat(chunks)) })
    res.on('error', (err) => { clearInterval(watchdog); reject(err) })
  })
}

function createProxyAgent(proxyUrl) { try { return new SocksProxyAgent(proxyUrl) } catch { return null } }

async function fetchBuffer(url, maxBytes) {
  const allErrors = []
  async function attempt(agent, label, timeout) {
    const options = { timeout, headers: { ...BROWSER_HEADERS } }
    if (agent) options.agent = agent
    try { const res = await followRedirects(url, options); return await drainStream(res, maxBytes) }
    catch (err) { allErrors.push(`[${label}] ${err.message || String(err)}`); return null }
  }
  console.log(`📥 [play] Directo: ${url.substring(0, 60)}...`)
  const directResult = await attempt(null, 'Directo', 60000)
  if (directResult) { console.log(`✅ [play] Directo OK`); return directResult }
  await sleep(2000)
  for (const proxyUrl of SOCKS_PROXIES) {
    for (let attemptNum = 0; attemptNum < 2; attemptNum++) {
      const agent = createProxyAgent(proxyUrl); if (!agent) continue
      if (attemptNum === 1) { console.log(`🔄 [play] Reload Tor...`); await reloadTor(); await sleep(5000) }
      console.log(`🔄 [play] Proxy ${proxyUrl} (intento ${attemptNum + 1})`)
      const proxyResult = await attempt(agent, `Proxy ${attemptNum + 1}`, 120000)
      try { agent.destroy() } catch {}
      if (proxyResult) { console.log(`✅ [play] Proxy OK`); return proxyResult }
      if (attemptNum === 0) await sleep(2000)
    }
  }
  throw new Error(`No se pudo descargar:\n${allErrors.length > 0 ? allErrors.map(e => `  • ${e}`).join('\n') : '  • Sin detalles'}`)
}

async function fetchThumbnail(url) {
  if (!url) return null
  async function tryFetch(options) {
    const res = await followRedirects(url, { timeout: 10000, headers: { ...BROWSER_HEADERS }, ...options })
    if (res.statusCode !== 200) { res.resume(); return null }
    return new Promise((resolve) => { const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve(Buffer.concat(chunks))); res.on('error', () => resolve(null)) })
  }
  try {
    let raw = await tryFetch({})
    if (!raw) { for (const proxyUrl of SOCKS_PROXIES) { const agent = createProxyAgent(proxyUrl); if (!agent) continue; raw = await tryFetch({ agent }); try { agent.destroy() } catch {}; if (raw) break } }
    if (!raw) return null
    return await sharp(raw).resize(320, 180, { fit: 'cover', position: 'centre' }).jpeg({ quality: 70, progressive: false }).toBuffer()
  } catch { return null }
}

// --- MAIN ---
export default async function (msg, sock, ctx) {
  const chatId = msg.key.remoteJid
  const query = ctx.args.join(' ').trim()
  const apikey = getApiKey()

  if (!apikey) { await sock.sendMessage(chatId, { text: '⚠️ APIKEY no configurada en optishield.json' }, { quoted: msg }); return true }
  if (!query) { await sock.sendMessage(chatId, { text: '❌ Debes enviar un link o texto\n\nEjemplo: .play Canción' }, { quoted: msg }); return true }

  let videoUrl = '', videoTitle = '', videoChannel = '', logKey = null
  const buildSearch = (step) => `🔍 Buscando audio...\n\n${progressBar(step)}`
  const buildProgress = (title, channel, duration, step) => `🎵 *${title}*\n${channel ? `👤 ${channel}\n` : ''}${duration ? `⏱️ ${duration}\n` : ''}\n${progressBar(step)}`

  try {
    const { key } = await sock.sendMessage(chatId, { text: buildSearch(0) }, { quoted: msg }); logKey = key

    if (!isUrl(query)) {
      await updateLog(sock, chatId, logKey, buildSearch(1))
      const search = await global.OptiShield.callApi('youtubeSearch', { q: query, apikey })
      if (search.error || !search?.result?.results?.length) { await updateLog(sock, chatId, logKey, '❌ No se encontraron resultados'); return true }
      const first = search.result.results[0]; videoUrl = first.url; videoTitle = first.title; videoChannel = first.channel
    } else { videoUrl = query }

    await updateLog(sock, chatId, logKey, buildProgress(videoTitle || 'Obteniendo info...', videoChannel, null, 2))

    const dl = await global.OptiShield.callApi('youtubedl', { url: videoUrl, video: 0, apikey })
    if (dl.error) { await updateLog(sock, chatId, logKey, dl.error); return true }

    const data = dl.result.data
    videoTitle = videoTitle || data.title || 'YouTube'; videoChannel = videoChannel || data.channel || ''
    
    await updateLog(sock, chatId, logKey, buildProgress(videoTitle, videoChannel, data.durationFormatted, 4))

    const safeTitle = videoTitle.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\\/:*?"<>|]/g, '').replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim().substring(0, 100) || 'OptiShield Audio'
    const thumbBuffer = await fetchThumbnail(data.thumbnail)
    const downloadUrl = data.available?.audio?.[0]?.download_url

    if (!downloadUrl) { await updateLog(sock, chatId, logKey, '❌ Sin audio disponible'); return true }

    await updateLog(sock, chatId, logKey, buildProgress(videoTitle, videoChannel, data.durationFormatted, 5) + '\n\n⏳ Descargando audio...')
    const rawBuffer = await fetchBuffer(downloadUrl, AUDIO_LIMIT)

    await sock.sendMessage(chatId, {
      audio: rawBuffer,
      mimetype: 'audio/mpeg',
      fileName: `${safeTitle}.mp3`,
      ...(thumbBuffer ? { jpegThumbnail: thumbBuffer } : {}),
    }, { quoted: msg })

    await updateLog(sock, chatId, logKey, buildProgress(videoTitle, videoChannel, data.durationFormatted, 6) + '\n\n✅ Completado')

  } catch (err) {
    console.error('❌ [play]', err)
    const errorMsg = err.message?.includes('RATE_LIMITED') ? '⚠️ Servidor saturado, intenta en unos minutos' : `❌ ${err.message}`
    if (logKey) await updateLog(sock, chatId, logKey, errorMsg)
    else await sock.sendMessage(chatId, { text: errorMsg }, { quoted: msg })
  }
  return true
}
