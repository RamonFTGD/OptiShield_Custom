// ═══════════════════════════════════════════════════════════════════════════
//  OptiShield Utility Library — shared helpers for all plugins
// ═══════════════════════════════════════════════════════════════════════════

import { createRequire } from 'module'
import { spawn } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { unlink } from 'fs/promises'
import { randomBytes } from 'crypto'
import http from 'http'
import https from 'https'
import { downloadContentFromMessage } from '@whiskeysockets/baileys'
import fs from 'fs'

const require = createRequire(import.meta.url)

// ─── Progress Bar ──────────────────────────────────────────────────────────
export function ProgressBar(current, total = 4) {
  const pct = Math.round((current / total) * 100)
  const filled = Math.round((current / total) * 10)
  const track = '█'.repeat(filled) + '░'.repeat(10 - filled)
  return `${track} ${pct}%`
}

// ─── Edit log message ──────────────────────────────────────────────────────
export async function editLog(sock, jid, key, text) {
  try {
    if (key) await sock.sendMessage(jid, { text, edit: key })
  } catch { /* ignore */ }
}

// ─── Send a status message and return its key ──────────────────────────────
export async function sendStatus(sock, jid, text, quoted) {
  const { key } = await sock.sendMessage(jid, { text }, { quoted })
  return key
}

// ─── React to a message ────────────────────────────────────────────────────
export async function react(sock, jid, key, emoji) {
  try { await sock.sendMessage(jid, { react: { text: emoji, key } }) } catch {}
}

// ─── Short reply helper ────────────────────────────────────────────────────
export function reply(sock, jid, text, quoted) {
  return sock.sendMessage(jid, { text }, { quoted })
}

// ─── Download media from message ───────────────────────────────────────────
export async function downloadMedia(message, type) {
  const stream = await downloadContentFromMessage(message, type)
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

// ─── Download from URL ─────────────────────────────────────────────────────
export function fetchBuffer(url, maxBytes = 500 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { timeout: 60000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return fetchBuffer(res.headers.location, maxBytes).then(resolve).catch(reject)
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)) }
      const chunks = []
      let total = 0
      res.on('data', (chunk) => {
        total += chunk.length
        if (total > maxBytes) { res.destroy(); return reject(new Error('FILE_TOO_LARGE')) }
        chunks.push(chunk)
      })
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')) })
  })
}

// ─── Extract audio via ffmpeg ─────────────────────────────────────────────
export async function extractAudio(videoUrl, prefix = 'audio') {
  return new Promise((resolve, reject) => {
    const out = join(tmpdir(), `${prefix}_${randomBytes(6).toString('hex')}.mp3`)
    const ff = spawn('ffmpeg', [
      '-y', '-i', videoUrl,
      '-vn', '-acodec', 'libmp3lame',
      '-b:a', '192k', '-ar', '44100',
      '-threads', '2', out
    ])
    let stderr = ''
    ff.stderr.on('data', (d) => { stderr += d })
    ff.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg: ${stderr.slice(-200)}`))
      resolve(out)
    })
    ff.on('error', reject)
  })
}

// ─── URL validation ───────────────────────────────────────────────────────
export function isUrl(text = '') { return /^https?:\/\//i.test(text) }

// ─── Get quoted message info ──────────────────────────────────────────────
export function getQuoted(msg) {
  const m = msg.message
  if (!m) return null
  const type = Object.keys(m)[0]
  const content = m[type]
  if (!content?.contextInfo?.quotedMessage) return null
  const qType = Object.keys(content.contextInfo.quotedMessage)[0]
  return {
    type: qType,
    message: content.contextInfo.quotedMessage[qType],
  }
}

// ─── Format numbers ───────────────────────────────────────────────────────
export function formatNum(num) {
  if (!num && num !== 0) return '?'
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K'
  return String(num)
}

// ─── Format bytes ──────────────────────────────────────────────────────────
export function formatBytes(bytes) {
  if (bytes === 0) return '0.00 B'
  if (!bytes || isNaN(bytes)) return 'N/A'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let val = Number(bytes)
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++ }
  return `${val.toFixed(2)} ${units[i]}`
}

// ─── Clamp string length ──────────────────────────────────────────────────
export function clamp(str, n) {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '…' : str
}

// ─── Sleep / delay ────────────────────────────────────────────────────────
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ─── Get Baileys native functions (for interactive messages) ──────────────
export function getBaileysFns(sock) {
  const candidates = ['@whiskeysockets/baileys', 'baileys']
  for (const pkg of candidates) {
    try {
      const mod = require(pkg)
      const gf = (n) => mod[n] || mod.Utils?.[n]
      const generateWAMessageFromContent = gf('generateWAMessageFromContent')
      const prepareWAMessageMedia = gf('prepareWAMessageMedia')
      const generateMessageIDV2 = gf('generateMessageIDV2') || gf('generateMessageID')
      const isJidGroup = gf('isJidGroup') || mod.WABinary?.isJidGroup
      if (generateWAMessageFromContent && prepareWAMessageMedia && sock.relayMessage) {
        return { generateWAMessageFromContent, prepareWAMessageMedia, generateMessageIDV2, isJidGroup }
      }
    } catch { /* next */ }
  }
  return null
}

// ─── Send interactive message with image header ────────────────────────────
export async function sendInteractiveWithImage(sock, jid, { imageUrl, bodyText, footerText, buttons, quotedMsg }) {
  const fns = getBaileysFns(sock)
  if (!fns) throw new Error('No se pudieron cargar las funciones internas de Baileys')
  const { generateWAMessageFromContent, prepareWAMessageMedia, generateMessageIDV2, isJidGroup } = fns

  let mediaContent = null
  if (imageUrl) {
    try {
      mediaContent = await prepareWAMessageMedia({ image: { url: imageUrl } }, { upload: sock.waUploadToServer })
    } catch (err) {
      console.warn('⚠ No se pudo preparar imagen para el header:', err.message)
    }
  }

  const interactiveMessage = {
    body: { text: bodyText || '' },
    footer: { text: footerText || '' },
    nativeFlowMessage: { buttons },
    header: mediaContent
      ? { title: '', hasMediaAttachment: true, ...mediaContent }
      : { title: '', hasMediaAttachment: false }
  }

  const userJid = sock.authState?.creds?.me?.id || sock.user?.id
  const fullMsg = generateWAMessageFromContent(jid, { interactiveMessage }, {
    logger: sock.logger, userJid,
    ...(generateMessageIDV2 ? { messageId: generateMessageIDV2(userJid) } : {}),
    quoted: quotedMsg
  })

  const additionalNodes = []
  const isPrivate = isJidGroup ? !isJidGroup(jid) : !jid.endsWith('@g.us')
  additionalNodes.push({
    tag: 'biz', attrs: {}, content: [{
      tag: 'interactive', attrs: { type: 'native_flow', v: '1' },
      content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
    }]
  })
  if (isPrivate) additionalNodes.push({ tag: 'bot', attrs: { biz_bot: '1' } })

  await sock.relayMessage(jid, fullMsg.message, { messageId: fullMsg.key.id, additionalNodes })
  return fullMsg
}

// ─── Call OptiShield API ─────────────────────────────────────────────────
export function callApi(type, params = {}) {
  return global.OptiShield?.callApi(type, params) || Promise.resolve({ error: 'OptiShield no disponible' })
}

// ─── Get API key from config ──────────────────────────────────────────────
export function getApiKey() {
  try {
    const searchDirs = [process.cwd()]
    for (const dir of searchDirs) {
      try {
        const jsonPath = join(dir, 'optishield.json')
        if (fs.existsSync(jsonPath)) {
          const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
          if (data.apikey) return data.apikey
        }
      } catch { /* skip */ }
    }
    return global.apikey || null
  } catch { return null }
}

// ─── Check if user is owner ──────────────────────────────────────────────
export function isOwner(sender) {
  if (!sender || !Array.isArray(global.owners)) return false
  return global.owners.includes(sender)
}

// ─── Get message text from various formats ────────────────────────────────
export function getText(msg) {
  if (!msg?.message) return ''
  const m = msg.message
  if (m.conversation) return m.conversation
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text
  if (m.imageMessage?.caption) return m.imageMessage.caption
  if (m.videoMessage?.caption) return m.videoMessage.caption
  if (m.buttonsResponseMessage?.selectedButtonId) return m.buttonsResponseMessage.selectedButtonId
  if (m.listResponseMessage?.singleSelectReply?.selectedRowId) return m.listResponseMessage.singleSelectReply.selectedRowId
  // Interactive responses
  const interactive = m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson
  if (interactive) {
    try { return JSON.parse(interactive).id || interactive } catch { return interactive }
  }
  return ''
}

// ─── Temp files manager ─────────────────────────────────────────────────
const TMP = join(process.cwd(), 'tmp')
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true })

export function getTmpPath() { return TMP }

export function tmpFile(ext = 'tmp') {
  return join(TMP, `${randomBytes(8).toString('hex')}.${ext}`)
}

export function cleanFile(p) {
  try { if (fs.existsSync(p)) fs.unlinkSync(p) } catch { /* ignore */ }
}
