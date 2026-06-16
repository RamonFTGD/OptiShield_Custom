import { reply, editLog, fetchBuffer, tmpFile, cleanFile } from '../../lib/utils.js'

export const meta = {
  name: 'TextToSpeech',
  commands: ['tts', 'speak', 'decir', 'audio'],
  priority: 4,
  premium: true,
  class: 'Herramientas',
  description: 'Convierte texto a voz'
}

const VOICES = {
  'es': { name: 'Español', emoji: '🇪🇸', option: 'es' },
  'en': { name: 'Inglés', emoji: '🇬🇧', option: 'en' },
  'fr': { name: 'Francés', emoji: '🇫🇷', option: 'fr' },
  'de': { name: 'Alemán', emoji: '🇩🇪', option: 'de' },
  'it': { name: 'Italiano', emoji: '🇮🇹', option: 'it' },
  'pt': { name: 'Portugués', emoji: '🇵🇹', option: 'pt' },
  'ja': { name: 'Japonés', emoji: '🇯🇵', option: 'ja' },
  'ko': { name: 'Coreano', emoji: '🇰🇷', option: 'ko' },
  'zh': { name: 'Chino', emoji: '🇨🇳', option: 'zh' },
  'ru': { name: 'Ruso', emoji: '🇷🇺', option: 'ru' },
}

export default async function (msg, sock, ctx) {
  const { chatId, text } = ctx

  if (!text) {
    let help = `🔊 *Texto a Voz*
${'─'.repeat(28)}
Convierte texto a audio en 10 idiomas.

◆ ${'.tts <texto>'} — Español (por defecto)
◆ ${'.tts <texto> | <código>'} — Otro idioma

Idiomas:\n`
    for (const [, v] of Object.entries(VOICES)) {
      help += `${v.emoji} ${v.name} — .tts texto | ${v.option}\n`
    }
    help += `\n◆ ${'.tts Hola mundo | en'}\n⚡ OptiShield TTS`
    await reply(sock, chatId, help, msg)
    return true
  }

  let lang = 'es'
  let sourceText = text

  const pipeIndex = text.lastIndexOf('|')
  if (pipeIndex !== -1) {
    const afterPipe = text.slice(pipeIndex + 1).trim().toLowerCase()
    if (VOICES[afterPipe]) {
      lang = afterPipe
      sourceText = text.slice(0, pipeIndex).trim()
    }
  }

  const { key: logKey } = await sock.sendMessage(chatId, { text: '🔊 Generando audio...' }, { quoted: msg })

  try {
    const voice = VOICES[lang]
    const res = await global.OptiShield.callApi('tts-google', {
      text: sourceText,
      option: voice.option
    })

    if (res.error) {
      await sock.sendMessage(chatId, { text: `❌ ${res.error}`, edit: logKey })
      return true
    }

    const audioUrl = res.result?.audio || res.result?.url || res.result?.file
    if (!audioUrl) {
      await sock.sendMessage(chatId, { text: '❌ No se pudo generar el audio', edit: logKey })
      return true
    }

    const audioPath = tmpFile('mp3')
    const buffer = await fetchBuffer(audioUrl, 10 * 1024 * 1024)

    if (!buffer || buffer.length < 100) {
      await sock.sendMessage(chatId, { text: '❌ Error al descargar el audio', edit: logKey })
      cleanFile(audioPath)
      return true
    }

    await editLog(sock, chatId, logKey, '📤 Enviando audio...')

    await sock.sendMessage(chatId, {
      audio: buffer,
      mimetype: 'audio/mpeg',
      ptt: false,
    }, { quoted: msg })

    await sock.sendMessage(chatId, {
      text: `✅ *Audio generado*\n🔤 ${sourceText.slice(0, 100)}\n🔊 ${voice.emoji} ${voice.name}\n\n⚡ OptiShield TTS`,
      edit: logKey
    })

  } catch (err) {
    console.error('❌ TTS error:', err)
    await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}`, edit: logKey })
  }

  return true
}
