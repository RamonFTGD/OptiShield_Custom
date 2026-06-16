import fs from 'fs'
import path from 'path'
import url from 'url'
import * as security from './lib/security.js'

// ─── Constants ──────────────────────────────────────────────────────────────
const PREFIXES = ['!', '.', '#', '/']
const COOLDOWN_DEFAULT_MS = 3000  // 3s default between commands
const COOLDOWN_MAP = new Map()

// ─── Text cleaning ──────────────────────────────────────────────────────────
const RE_INVISIBLE = /[\u200e\u200f\u202a-\u202e\u00a0]/g

function cleanText(text) {
  return text ? text.replace(RE_INVISIBLE, ' ').trim() : ''
}

// ─── Extract message content (text + interactive responses) ─────────────────
function extractMessageContent(msg) {
  if (!msg?.message) return ''

  // Buttons & interactive responses
  const btn = msg.message?.buttonsResponseMessage?.selectedButtonId
  if (btn) return btn

  const list = msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId
  if (list) return list

  const template = msg.message?.templateButtonReplyMessage?.selectedId
  if (template) return template

  const interactive =
    msg.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson
  if (interactive) {
    try { return JSON.parse(interactive).id || interactive } catch { return interactive }
  }

  // Resolve view-once / ephemeral wrappers
  let content = msg.message
  if (content.viewOnceMessageV2) content = content.viewOnceMessageV2.message
  else if (content.viewOnceMessage) content = content.viewOnceMessage.message
  else if (content.ephemeralMessage) content = content.ephemeralMessage.message

  return (
    content?.conversation ||
    content?.extendedTextMessage?.text ||
    content?.imageMessage?.caption ||
    content?.videoMessage?.caption ||
    ''
  )
}

// ─── Cooldown check ─────────────────────────────────────────────────────────
function checkCooldown(sender, commandName) {
  const key = `${sender}:${commandName}`
  const now = Date.now()
  const last = COOLDOWN_MAP.get(key) || 0
  const remaining = COOLDOWN_DEFAULT_MS - (now - last)
  if (remaining > 0) return remaining
  COOLDOWN_MAP.set(key, now)
  // Cleanup old entries periodically
  if (COOLDOWN_MAP.size > 10000) {
    const threshold = now - 60000
    for (const [k, v] of COOLDOWN_MAP) {
      if (v < threshold) COOLDOWN_MAP.delete(k)
    }
  }
  return 0
}

// ─── Middleware runner ───────────────────────────────────────────────────────
async function runMiddleware(middleware, ctx, msg, sock) {
  for (const mw of middleware) {
    const result = await mw(ctx, msg, sock)
    if (result === false) return false  // middleware blocked
    if (result && typeof result === 'object') Object.assign(ctx, result)
  }
  return true
}

// ─── Built-in middlewares ────────────────────────────────────────────────────
const MIDDLEWARE = {
  // Check cooldown
  cooldown: (cooldownMs) => async (ctx) => {
    const remaining = checkCooldown(ctx.sender, ctx.command)
    if (remaining > 0) {
      ctx._blocked = 'cooldown'
      ctx._cooldownRemaining = remaining
      return false
    }
    return true
  },

  // Restrict to owners only
  ownerOnly: async (ctx) => {
    if (!isOwner(ctx.sender)) {
      ctx._blocked = 'owner'
      return false
    }
    return true
  },

  // Restrict to groups only
  groupOnly: async (ctx) => {
    if (!ctx.isGroup) {
      ctx._blocked = 'group'
      return false
    }
    return true
  },

  // Restrict to private chats only
  privateOnly: async (ctx) => {
    if (ctx.isGroup) {
      ctx._blocked = 'private'
      return false
    }
    return true
  },

  // Attach API key to context
  attachApikey: async (ctx) => {
    try {
      const cfgPath = path.join(process.cwd(), 'optishield.json')
      if (fs.existsSync(cfgPath)) {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
        ctx.apikey = cfg.apikey
      }
    } catch { /* ignore */ }
    ctx.apikey = ctx.apikey || global.apikey || null
    return { apikey: ctx.apikey }
  },
}

// ─── Plugin metadata wrapper (for commands that define middleware) ──────────
export function definePlugin(meta, middlewareList, handler) {
  return { meta, middleware: middlewareList || [], run: handler }
}

// ═════════════════════════════════════════════════════════════════════════════
//  LOAD PLUGINS
// ═════════════════════════════════════════════════════════════════════════════
export async function loadPlugins(dirPath) {
  const commands = new Map()
  if (!fs.existsSync(dirPath)) {
    console.warn(`⚠️ Carpeta de plugins no encontrada: ${dirPath}`)
    return commands
  }

  const readDir = async (p) => {
    const items = fs.readdirSync(p, { withFileTypes: true })
    for (const item of items) {
      const fullPath = path.join(p, item.name)
      if (item.isDirectory()) {
        await readDir(fullPath)
      } else if (item.name.endsWith('.js') && !item.name.endsWith('.bak.js')) {
        try {
          const mod = await import(url.pathToFileURL(fullPath).href + `?t=${Date.now()}`)
          if (mod.meta?.commands && typeof mod.default === 'function') {
            const mw = mod.meta.middleware || []
            mod.meta.commands.forEach((c) => {
              commands.set(c.toLowerCase(), {
                meta: mod.meta,
                run: mod.default,
                middleware: mw,
              })
            })
            const priority = mod.meta.priority || 5
            if (priority <= 2) {
              console.log(`✅ ${'⬛'.repeat(priority)} ${mod.meta.name} [${mod.meta.commands.join(', ')}]`)
            } else {
              console.log(`   ${'▫️'.repeat(Math.min(priority, 3))} ${mod.meta.name} [${mod.meta.commands.join(', ')}]`)
            }
          }
        } catch (e) {
          console.error(`❌ Error cargando ${item.name}:`, e.message)
        }
      }
    }
  }

  await readDir(dirPath)
  console.log(`\n🚀 Total comandos cargados: ${commands.size}`)
  return commands
}

// ═════════════════════════════════════════════════════════════════════════════
//  HANDLE EVENTS
// ═════════════════════════════════════════════════════════════════════════════
export function handleEvents(sock, commandsMap, options = {}) {
  const { database = null } = options

  const handler = async ({ messages, type }) => {
    if (type !== 'notify') return

    const msg = messages[0]
    if (!msg?.message) return

    const chatId = msg.key.remoteJid
    if (chatId === 'status@broadcast') return

    const rawText = extractMessageContent(msg)
    const text = cleanText(rawText)
    if (!text) return

    // Detect prefix
    const prefix = PREFIXES.find((p) => text.startsWith(p))
    let body = text
    let usedPrefix = ''

    if (prefix) {
      usedPrefix = prefix
      body = text.slice(prefix.length).trim()
    } else {
      // No prefix — check if first word is a command
      const parts = text.split(/\s+/)
      const potentialCmd = parts[0]?.toLowerCase()
      if (!commandsMap.has(potentialCmd)) return
    }

    const parts = body.split(/\s+/)
    const commandName = parts[0]?.toLowerCase()
    const args = parts.slice(1)

    const cmd = commandsMap.get(commandName)
    if (!cmd) return

    // ── Build context ──────────────────────────────────────────────────
    const sender = msg.key.participant || chatId

    // Check cooldown (unless command has `cooldown: 0` in meta)
    const cmdCooldown = cmd.meta.cooldown !== undefined ? cmd.meta.cooldown : COOLDOWN_DEFAULT_MS
    if (cmdCooldown > 0) {
      const remaining = checkCooldown(sender, commandName)
      if (remaining > 0) return  // silently ignore
    }

    const ctx = {
      command: commandName,
      args,
      text: args.join(' '),
      body: text,
      prefix: usedPrefix,
      chatId,
      isGroup: chatId.endsWith('@g.us'),
      sender,
      msg,
      sock,
      db: database,
      apikey: null,
      info: { user: { apikey: database?.apikey || global.apikey } },
      meta: cmd.meta,
    }

    // Load API key from config
    try {
      const cfgPath = path.join(process.cwd(), 'optishield.json')
      if (fs.existsSync(cfgPath)) {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
        ctx.apikey = cfg.apikey
      }
    } catch { /* ignore */ }
    ctx.apikey = ctx.apikey || global.apikey || null

    // ── SECURITY CHECKS ────────────────────────────────────────────────
    // 1. Banned user?
    if (security.isBanned(sender)) return

    // 2. Owner-only command?
    if (cmd.meta.ownerOnly && !security.isOwner(sender)) {
      return  // silently ignore for non-owners
    }

    // 3. Command disabled in this chat?
    if (!security.isCommandEnabled(chatId, commandName)) return

    // 4. Rate limit per user?
    const rateCheck = security.checkRateLimit(sender, 20)
    if (!rateCheck.allowed) return  // silently rate-limited

    // ── Execute ─────────────────────────────────────────────────────────
    try {
      console.log(`▶️ ${commandName} | ${sender.split('@')[0]}${chatId.endsWith('@g.us') ? ` [${chatId.split('@')[0]}]` : ''}`)
      const startTime = Date.now()
      await cmd.run(msg, sock, ctx)
      const elapsed = Date.now() - startTime
      security.trackCommand(commandName, elapsed, false)
      if (elapsed > 2000) {
        console.log(`⏱️ ${commandName} — ${(elapsed / 1000).toFixed(1)}s`)
      }
    } catch (e) {
      console.error(`❌ Error en ${commandName}:`, e.message)
      security.trackCommand(commandName, 0, true)
      try {
        await sock.sendMessage(chatId, { text: `❌ Error: ${e.message}` }, { quoted: msg })
      } catch { /* ignore send error */ }
    }
  }

  sock.ev.on('messages.upsert', handler)
  return handler
}

// ═════════════════════════════════════════════════════════════════════════════
//  WATCH PLUGINS (Hot-Reload)
// ═════════════════════════════════════════════════════════════════════════════
export function watchPlugins(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.warn('⚠️ No se puede observar plugins: carpeta no existe.')
    return
  }

  let debounceTimer = null

  fs.watch(dirPath, { recursive: true }, async (eventType, filename) => {
    if (!filename || !filename.endsWith('.js')) return

    // Debounce rapid changes (multiple saves trigger multiple events)
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      const fullPath = path.join(dirPath, filename)
      const map = global.commandsMap
      if (!map) return

      try {
        console.log(`🔄 Cambio detectado: ${filename}. Recargando...`)
        const moduleUrl = url.pathToFileURL(fullPath).href + `?update=${Date.now()}`
        const mod = await import(moduleUrl)

        if (mod.meta?.commands) {
          // Remove old commands from this plugin
          for (const [key, val] of map) {
            if (val.meta && val.meta.name === mod.meta.name) {
              map.delete(key)
            }
          }
          // Add new commands
          mod.meta.commands.forEach((c) => {
            map.set(c.toLowerCase(), { meta: mod.meta, run: mod.default })
          })
          console.log(`✅ Plugin recargado: ${mod.meta.name} [${mod.meta.commands.join(', ')}]`)
        }
      } catch (err) {
        console.error(`❌ Error recargando ${filename}:`, err.message)
      }
    }, 500)
  })
}
