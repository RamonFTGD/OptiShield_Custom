import { reply, editLog, isUrl, ProgressBar } from '../../lib/utils.js'

export const meta = {
  name: 'VideoTools',
  commands: ['mp3', 'mp4tomp3', 'compressvid', 'gifvid', 'mutevid', 'normalize'],
  priority: 4,
  premium: true,
  class: 'Herramientas',
  description: 'Herramientas de conversión y edición de video/audio'
}

export default async function (msg, sock, ctx) {
  const { chatId, command, text, apikey } = ctx
  const url = text.trim()

  if (!url || !isUrl(url)) {
    await reply(sock, chatId,
      `🎬 *Video Tools*
${'─'.repeat(28)}
Conversión y edición de video/audio.

◆ ${'.mp3 <url>'} — Video a MP3
◆ ${'.compressvid <url>'} — Comprimir video
◆ ${'.gifvid <url>'} — Video a GIF
◆ ${'.mutevid <url>'} — Silenciar video
◆ ${'.normalize <url>'} — Normalizar audio

◆ .mp3 https://ejemplo.com/video.mp4
⚡ OptiShield`,
      msg)
    return true
  }

  const apiMap = {
    'mp3': 'mp4-mp3', 'mp4tomp3': 'mp4-mp3',
    'compressvid': 'mp4-compress', 'gifvid': 'mp4-gif',
    'mutevid': 'mp4-mute', 'normalize': 'mp4-normalize',
  }

  const apiType = apiMap[command]
  if (!apiType) return true

  const actionNames = {
    'mp4-mp3': '🎵 Convirtiendo a MP3', 'mp4-compress': '📦 Comprimiendo video',
    'mp4-gif': '🎞️ Convirtiendo a GIF', 'mp4-mute': '🔇 Silenciando video',
    'mp4-normalize': '🔊 Normalizando audio',
  }

  const { key: logKey } = await sock.sendMessage(chatId, { text: `${actionNames[apiType] || 'Procesando...'}\n\n${ProgressBar(0)}` }, { quoted: msg })

  try {
    await editLog(sock, chatId, logKey, `${actionNames[apiType] || 'Procesando...'}\n\n${ProgressBar(1)}`)
    const res = await global.OptiShield.callApi(apiType, { url })
    if (res.error) { await sock.sendMessage(chatId, { text: `❌ ${res.error}`, edit: logKey }); return true }

    const resultUrl = res.result?.url || res.result?.file || res.result?.download
    if (!resultUrl) { await sock.sendMessage(chatId, { text: '❌ No se pudo procesar', edit: logKey }); return true }

    await editLog(sock, chatId, logKey, `📤 Enviando resultado...\n\n${ProgressBar(3)}`)
    const isAudio = ['mp4-mp3', 'mp4-normalize'].includes(apiType)

    if (isAudio) {
      await sock.sendMessage(chatId, { audio: { url: resultUrl }, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg })
    } else if (apiType === 'mp4-gif') {
      await sock.sendMessage(chatId, { video: { url: resultUrl }, caption: `🎞️ *GIF generado*\n⚡ OptiShield`, gifPlayback: true }, { quoted: msg })
    } else {
      await sock.sendMessage(chatId, { video: { url: resultUrl }, caption: `✅ *Procesado*\n⚡ OptiShield` }, { quoted: msg })
    }
    await sock.sendMessage(chatId, { text: `✅ ¡Listo!\n\n${ProgressBar(4)}`, edit: logKey })

  } catch (err) {
    console.error(`❌ ${apiType} error:`, err)
    await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}`, edit: logKey })
  }
  return true
}
