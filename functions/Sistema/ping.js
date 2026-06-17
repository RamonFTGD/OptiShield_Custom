import os from 'os'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

export const meta = {
  name: 'ping',
  commands: ['ping', 'p'],
  priority: 1,
  class: 'Sistema',
}

function getCPUTemperature() {
  try {
    for (let i = 0; i <= 5; i++) {
      const typePath = `/sys/class/thermal/thermal_zone${i}/type`
      const tempPath = `/sys/class/thermal/thermal_zone${i}/temp`
      if (fs.existsSync(tempPath) && fs.existsSync(typePath)) {
        const type = fs.readFileSync(typePath, 'utf8').trim().toLowerCase()
        if (type.includes('package') || type.includes('x86') || type.includes('cpu')) {
          const tempC = parseInt(fs.readFileSync(tempPath, 'utf8').trim()) / 1000
          if (tempC > 0 && tempC < 150) return tempC.toFixed(1)
        }
      }
    }
    if (fs.existsSync('/sys/class/thermal/thermal_zone0/temp')) {
      const thermalZone = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8').trim()
      const tempC = parseInt(thermalZone) / 1000
      if (tempC > 0 && tempC < 150) return tempC.toFixed(1)
    }
    return 'N/A'
  } catch { return 'N/A' }
}

function getMemoryInfo() {
  try {
    const memInfo = fs.readFileSync('/proc/meminfo', 'utf8')
    const lines = memInfo.split('\n')
    const getValue = (name) => {
      const line = lines.find(l => l.startsWith(name))
      if (!line) return 0
      const match = line.match(/(\d+)/)
      return match ? parseInt(match[1]) * 1024 : 0
    }
    const totalRam = getValue('MemTotal:')
    const availableRam = getValue('MemAvailable:')
    return { 
      totalRam, 
      usedRam: totalRam - availableRam, 
      totalSwap: getValue('SwapTotal:'), 
      usedSwap: getValue('SwapTotal:') - getValue('SwapFree:') 
    }
  } catch {
    return { totalRam: os.totalmem(), usedRam: os.totalmem() - os.freemem(), totalSwap: 0, usedSwap: 0 }
  }
}

async function getPingAPI() {
  try {
    const apiStart = Date.now()
    await fetch('https://optishield.uk/api/?type=ok&apikey=anonymous')
    return { latency: Date.now() - apiStart, status: '🟢 Online' }
  } catch { return { latency: 'Timeout', status: '❌ Offline' } }
}

async function getUserInfo() {
  try {
    const searchDirs = [process.cwd(), path.dirname(fileURLToPath(import.meta.url))]
    let apikey = null
    for (const dir of searchDirs) {
      try {
        const jsonPath = path.join(dir, 'optishield.json')
        if (fs.existsSync(jsonPath)) {
          const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
          if (data.apikey) {
            apikey = data.apikey
            break
          }
        }
      } catch {}
    }
    if (!apikey) return null
    const res = await fetch(`https://optishield.uk/api/account?apikey=${apikey}`)
    return await res.json()
  } catch { return null }
}

function generateMessage(info, apiData, whatsappLatency, editCount = 1) {
  const cpuModel = os.cpus()[0]?.model || 'Desconocido'
  const cpuUsage = Math.min(((os.loadavg()[0] / os.cpus().length) * 100), 100).toFixed(0)
  const cpuTemp = getCPUTemperature()
  const mem = getMemoryInfo()
  const ramPercent = ((mem.usedRam / mem.totalRam) * 100).toFixed(0)
  const swapPercent = mem.totalSwap > 0 ? ((mem.usedSwap / mem.totalSwap) * 100).toFixed(0) : 0

  let diskUsed = 0, diskTotal = 0, diskPercent = 0
  try {
    const df = execSync('df -k /').toString().split('\n')[1].split(/\s+/)
    diskTotal = Number(df[1]) * 1024; diskUsed = Number(df[2]) * 1024; diskPercent = ((diskUsed / diskTotal) * 100).toFixed(0)
  } catch { }

  const uptimeSec = process.uptime()
  const uptime = uptimeSec > 3600 ? `${(uptimeSec / 3600).toFixed(1)}h` : `${(uptimeSec / 60).toFixed(1)}m`
  const formatMB = b => (b / 1024 / 1024).toFixed(0)
  const formatGB = b => (b / 1024 / 1024 / 1024).toFixed(1)
  const bar = p => '▓'.repeat(Math.round((p / 100) * 10)) + '░'.repeat(10 - Math.round((p / 100) * 10))

  const userName = info?.user?.usuario || 'Desconocido'
  const userReqs = info?.user?.requests || 0

  let messageText =
    `╔═════ 「 *STATUS* 」 ═════╗\n` +
    `║ 👤 *Usuario:* ${userName}\n` +
    `║ 🎟️ *Solicitudes:* ${userReqs}\n` +
    `║ 📊 *Sync:* ${editCount}/10\n` +
    `╠═════════════════════════╣\n` +
    `║ ⚡ *LATENCIA*\n` +
    `║ ▸ WhatsApp: ${whatsappLatency} ms\n` +
    `║ ▸ API: ${apiData.latency} ms ${apiData.status}\n` +
    `╠═════════════════════════╣\n` +
    `║ 🖥️ *SISTEMA*\n` +
    `║ ▸ Uptime: ${uptime}\n` +
    `║ ▸ CPU: ${cpuUsage}% ${bar(cpuUsage)}\n` +
    `║ ▸ RAM: ${ramPercent}% ${bar(ramPercent)}\n` +
    `║ ▸ Disco: ${diskPercent}% ${bar(diskPercent)}\n` +
    `╚═════════════════════════╝\n` +
    `🛡️ _OptiShield System Online_`

  return messageText
}

export default async function (msg, sock, ctx) {
  try {
    console.log('[DEBUG PING] Plugin ejecutado...')

    if (!msg?.key?.remoteJid) {
      console.log('[DEBUG PING] Error: No se encontró chatId')
      return false
    }

    const chatId = msg.key.remoteJid
    const msgKey = msg.key

    const userInfo = await getUserInfo()
    const safeInfo = { user: { usuario: userInfo?.usuario || 'N/A', requests: userInfo?.requests || 0 } }

    let reactLatency = 0
    try {
      const t = Date.now()
      await sock.sendMessage(chatId, { react: { text: '⏳', key: msgKey } })
      reactLatency = Date.now() - t
      console.log('[DEBUG PING] Reacción enviada')
    } catch (e) {
      console.log('[DEBUG PING] No se pudo reaccionar:', e.message)
    }

    const apiData = await getPingAPI()
    const messageData = await sock.sendMessage(
      chatId,
      { text: generateMessage(safeInfo, apiData, reactLatency, 1) },
      { quoted: msg }
    )

    console.log('[DEBUG PING] Mensaje enviado correctamente')
    const sentMsgKey = messageData.key

    let editCount = 1
    const editTimer = setInterval(async () => {
      try {
        if (editCount >= 10) { clearInterval(editTimer); return }
        editCount++
        const newApiData = await getPingAPI()
        await sock.sendMessage(chatId, {
          text: generateMessage(safeInfo, newApiData, reactLatency, editCount),
          edit: sentMsgKey
        })
      } catch (err) {
        console.warn(`[DEBUG PING] Error editando:`, err.message)
        if (editCount >= 10) clearInterval(editTimer)
      }
    }, 90000)

    setTimeout(() => clearInterval(editTimer), 900000)

    try {
      await sock.sendMessage(chatId, { react: { text: '🛡️', key: msgKey } })
    } catch {}

    return true

  } catch (error) {
    console.error('[ERROR CRÍTICO PING]:', error)
    return false
  }
}