// ═══════════════════════════════════════════════════════════════════════════
//  OptiShield Security & Permissions System
// ═══════════════════════════════════════════════════════════════════════════

import fs from 'fs'
import path from 'path'

// ─── User levels ──────────────────────────────────────────────────────────
export const LEVELS = {
  BANNED: -1,
  USER: 0,
  PREMIUM: 1,
  ADMIN: 2,
  OWNER: 3,
  BOT: 4,
}

const LEVEL_NAMES = {
  [LEVELS.BANNED]: '🚫 Baneado',
  [LEVELS.USER]: '👤 Usuario',
  [LEVELS.PREMIUM]: '⭐ Premium',
  [LEVELS.ADMIN]: '🛡️ Admin',
  [LEVELS.OWNER]: '👑 Owner',
  [LEVELS.BOT]: '🤖 Bot',
}

// ─── In-memory stores ────────────────────────────────────────────────────
const userLevels = new Map()   // jid -> level number
const chatSettings = new Map() // chatId -> { settings }
const rateLimitMap = new Map() // key -> timestamp[]
const cmdStats = new Map()     // commandName -> { calls, errors, totalTime }

// ─── Persistent config path ───────────────────────────────────────────────
const CONFIG_DIR = path.join(process.cwd(), 'config')
const SECURITY_FILE = path.join(CONFIG_DIR, 'security.json')
const CHAT_CONFIG_FILE = path.join(CONFIG_DIR, 'chats.json')
const STATS_FILE = path.join(CONFIG_DIR, 'stats.json')

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
}

// ─── Load / Save ─────────────────────────────────────────────────────────
function loadJSON(file) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'))
    }
  } catch (e) {
    console.warn(`⚠️ Error loading ${file}:`, e.message)
  }
  return {}
}

function saveJSON(file, data) {
  try {
    const dir = path.dirname(file)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
  } catch (e) {
    console.warn(`⚠️ Error saving ${file}:`, e.message)
  }
}

// Load persisted data
const persistedLevels = loadJSON(SECURITY_FILE)
for (const [jid, level] of Object.entries(persistedLevels)) {
  userLevels.set(jid, level)
}

const persistedChats = loadJSON(CHAT_CONFIG_FILE)
for (const [cid, settings] of Object.entries(persistedChats)) {
  chatSettings.set(cid, settings)
}

// ─── Auto-save every 60s ────────────────────────────────────────────────
let saveTimer = null
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const levelsObj = {}
    for (const [jid, level] of userLevels) levelsObj[jid] = level
    saveJSON(SECURITY_FILE, levelsObj)

    const chatsObj = {}
    for (const [cid, settings] of chatSettings) chatsObj[cid] = settings
    saveJSON(CHAT_CONFIG_FILE, chatsObj)

    const statsObj = {}
    for (const [cmd, data] of cmdStats) statsObj[cmd] = data
    saveJSON(STATS_FILE, statsObj)

    console.log('💾 Configuración de seguridad guardada.')
  }, 5000)
}

// ══════════════════════════════════════════════════════════════════════════
//  PUBLIC API
// ══════════════════════════════════════════════════════════════════════════

/** Set user permission level (persisted) */
export function setUserLevel(jid, level) {
  if (!Object.values(LEVELS).includes(level)) return false
  userLevels.set(jid, level)
  scheduleSave()
  return true
}

/** Get user permission level */
export function getUserLevel(jid) {
  return userLevels.get(jid) ?? LEVELS.USER
}

/** Get level name */
export function getLevelName(level) {
  return LEVEL_NAMES[level] || '👤 Usuario'
}

/** Check if user has required level */
export function hasPermission(jid, requiredLevel) {
  if (requiredLevel === undefined || requiredLevel === null) return true
  const userLevel = getUserLevel(jid)
  if (userLevel === LEVELS.BANNED) return false
  return userLevel >= requiredLevel
}

/** Check if user is banned */
export function isBanned(jid) {
  return getUserLevel(jid) === LEVELS.BANNED
}

/** Check if user is owner */
export function isOwner(jid) {
  if (!jid) return false
  if (Array.isArray(global.owners) && global.owners.includes(jid)) return true
  return getUserLevel(jid) >= LEVELS.OWNER
}

/** Check if user is at least admin */
export function isAdmin(jid) {
  return isOwner(jid) || getUserLevel(jid) >= LEVELS.ADMIN
}

// ══════════════════════════════════════════════════════════════════════════
//  CHAT SETTINGS
// ══════════════════════════════════════════════════════════════════════════

const DEFAULT_CHAT_SETTINGS = {
  enabled: true,
  onlyAdmins: false,
  disabledCommands: [],
  allowedCommands: [],
  onlyPremium: false,
  antiflood: true,
  antifloodMaxPerMin: 15,
  welcome: false,
  welcomeMessage: '',
  goodbye: false,
  goodbyeMessage: '',
}

export function getChatSettings(chatId) {
  return { ...DEFAULT_CHAT_SETTINGS, ...(chatSettings.get(chatId) || {}) }
}

export function setChatSettings(chatId, settings) {
  const current = chatSettings.get(chatId) || {}
  Object.assign(current, settings)
  chatSettings.set(chatId, current)
  scheduleSave()
  return true
}

export function isCommandEnabled(chatId, commandName) {
  const settings = getChatSettings(chatId)
  if (!settings.enabled) return false
  if (settings.allowedCommands.length > 0) {
    return settings.allowedCommands.includes(commandName)
  }
  if (settings.disabledCommands.includes(commandName)) return false
  return true
}

// ══════════════════════════════════════════════════════════════════════════
//  RATE LIMITING (Flood control)
// ══════════════════════════════════════════════════════════════════════════

const RATE_WINDOW_MS = 60000 // 1 min
const DEFAULT_MAX_PER_WINDOW = 20

export function checkRateLimit(key, maxPerWindow = DEFAULT_MAX_PER_WINDOW) {
  const now = Date.now()
  const timestamps = rateLimitMap.get(key) || []

  // Remove old entries
  const recent = timestamps.filter(t => now - t < RATE_WINDOW_MS)
  rateLimitMap.set(key, recent)

  if (recent.length >= maxPerWindow) {
    const oldest = recent[0]
    const resetIn = Math.ceil((RATE_WINDOW_MS - (now - oldest)) / 1000)
    return { allowed: false, resetIn }
  }

  recent.push(now)
  rateLimitMap.set(key, recent)
  return { allowed: true, resetIn: 0 }
}

// ══════════════════════════════════════════════════════════════════════════
//  COMMAND STATISTICS
// ══════════════════════════════════════════════════════════════════════════

export function trackCommand(commandName, timeMs, error = false) {
  const data = cmdStats.get(commandName) || { calls: 0, errors: 0, totalTime: 0 }
  data.calls++
  data.totalTime += timeMs
  if (error) data.errors++
  data.lastCall = Date.now()
  cmdStats.set(commandName, data)
  scheduleSave()
}

export function getCommandStats() {
  const stats = []
  for (const [cmd, data] of cmdStats) {
    stats.push({
      command: cmd,
      calls: data.calls,
      errors: data.errors,
      avgTime: data.calls > 0 ? (data.totalTime / data.calls).toFixed(0) : 0,
      lastCall: data.lastCall ? new Date(data.lastCall).toLocaleString() : 'Nunca',
    })
  }
  return stats.sort((a, b) => b.calls - a.calls)
}

// ══════════════════════════════════════════════════════════════════════════
//  INPUT VALIDATION (Prevent injection)
// ══════════════════════════════════════════════════════════════════════════

/** Validate and sanitize a URL — prevents command injection */
export function validateUrl(url) {
  if (!url || typeof url !== 'string') return null
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
    // Block internal/private IPs
    const hostname = parsed.hostname.toLowerCase()
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return null
    }
    return parsed.href
  } catch {
    return null
  }
}

/** Sanitize text — remove dangerous characters for shell commands */
export function sanitizeShell(text) {
  if (typeof text !== 'string') return ''
  // Remove shell metacharacters
  return text.replace(/[;&|`$(){}[\]!#~\\<>*?]/g, '').trim()
}

/** Validate WhatsApp JID */
export function isValidJid(jid) {
  if (!jid || typeof jid !== 'string') return false
  return /^\d+@(s\.whatsapp\.net|g\.us|lid|broadcast)$/.test(jid)
}

/** Check if text contains dangerous patterns */
export function isDangerous(text) {
  if (!text) return false
  const dangerous = [
    /\.git/i,
    /rm\s+-rf/i,
    /mkfs/i,
    /dd\s+if/i,
    /:\(\)\s*\{/i,  // fork bomb
    /chmod\s+777/i,
    /wget\s+.+\s+-O/i,
    /curl\s+.+\s+-o/i,
  ]
  return dangerous.some(p => p.test(text))
}
