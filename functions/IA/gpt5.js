import { reply } from '../../lib/utils.js'

export const meta = {
  name: 'GPT5Mini',
  commands: ['gpt5', 'gpt5mini'],
  priority: 5,
  premium: true,
  class: 'IA',
  description: 'Chat with GPT-5 Mini AI (fastest model)'
}

export default async function (msg, sock, ctx) {
  const { chatId, text } = ctx

  if (!text) {
    await reply(sock, chatId,
      `⚡ *GPT-5 Mini*
${'━'.repeat(28)}
La versión más rápida de ChatGPT.
Respuestas veloces y precisas.

◆ ${'.gpt5 <pregunta>'}

◆ ${'.gpt5 Resumen de la Segunda Guerra Mundial'}

También disponible: .gpt, .gemini, .glm5
⚡ OptiShield IA`,
      msg)
    return true
  }

  const { key: logKey } = await sock.sendMessage(chatId, { text: '⚡ Pensando...' }, { quoted: msg })

  try {
    const res = await global.OptiShield.callApi('ChatGPT-5_mini', { prompt: text })

    if (res.error) {
      await sock.sendMessage(chatId, { text: `❌ ${res.error}`, edit: logKey })
      return true
    }

    const respuesta = res.result?.response || res.result?.text || res.result?.message || JSON.stringify(res.result)
    const finalText = `⚡ *GPT-5 Mini*\n${'━'.repeat(28)}\n\n${respuesta}\n\n${'━'.repeat(28)}\n⚡ OptiShield IA`

    if (finalText.length > 4000) {
      const chunks = []; let remaining = finalText
      while (remaining.length > 0) { chunks.push(remaining.substring(0, 3800)); remaining = remaining.substring(3800) }
      await sock.sendMessage(chatId, { text: chunks[0], edit: logKey })
      for (let i = 1; i < chunks.length; i++) { await new Promise(r => setTimeout(r, 500)); await sock.sendMessage(chatId, { text: chunks[i] }) }
    } else {
      await sock.sendMessage(chatId, { text: finalText, edit: logKey })
    }

  } catch (err) {
    console.error('❌ GPT5 error:', err)
    await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}`, edit: logKey })
  }

  return true
}
