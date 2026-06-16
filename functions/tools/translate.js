import { reply, editLog } from '../../lib/utils.js'

export const meta = {
  name: 'Translate',
  commands: ['translate', 'traducir', 'traduce', 'tl'],
  priority: 4,
  premium: true,
  class: 'Herramientas',
  description: 'Traduce texto entre idiomas usando Google Translate'
}

export default async function (msg, sock, ctx) {
  const { chatId, text } = ctx

  if (!text) {
    await reply(sock, chatId,
      `🌐 *Traductor*
${'─'.repeat(28)}
Traduce texto a cualquier idioma.

◆ ${'.tl <texto> | <idioma>'}
◆ ${'.tl Hello world | es'} — Inglés → Español
◆ ${'.tl こんにちは | en'} — Japonés → Inglés

Códigos: es, en, fr, de, it, pt, ja, ko, zh...
⚡ OptiShield Translate`,
      msg)
    return true
  }

  let targetLang = 'es'
  let sourceText = text

  const pipeIndex = text.lastIndexOf('|')
  if (pipeIndex !== -1) {
    const afterPipe = text.slice(pipeIndex + 1).trim()
    if (afterPipe.length <= 5) {
      targetLang = afterPipe
      sourceText = text.slice(0, pipeIndex).trim()
    }
  }

  const { key: logKey } = await sock.sendMessage(chatId, { text: '🌐 Traduciendo...' }, { quoted: msg })

  try {
    const res = await global.OptiShield.callApi('translate', {
      texto: sourceText,
      lenguaje2: targetLang
    })

    if (res.error) {
      await sock.sendMessage(chatId, { text: `❌ ${res.error}`, edit: logKey })
      return true
    }

    const result = res.result
    const translated = result?.text || result?.translation || result?.translated || ''

    const finalText =
      `🌐 *Traducción*\n${'━'.repeat(28)}\n\n` +
      `Original:\n${sourceText.slice(0, 500)}\n\n` +
      `*${result?.targetLang || targetLang}:*\n${translated.slice(0, 4000)}\n\n` +
      `${result?.sourceLang ? `🔤 Detectado: ${result.sourceLang}\n` : ''}` +
      `${'━'.repeat(28)}\n⚡ OptiShield Translate`

    await sock.sendMessage(chatId, { text: finalText, edit: logKey })

  } catch (err) {
    console.error('❌ Translate error:', err)
    await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}`, edit: logKey })
  }

  return true
}
