import { reply } from '../../lib/utils.js'

export const meta = {
  name: 'ChatGPT',
  commands: ['chatgpt', 'gpt', 'ia', 'ai'],
  priority: 5,
  premium: true,
  class: 'IA',
  description: 'Chat with ChatGPT AI'
}

export default async function (msg, sock, ctx) {
  const { chatId, text, apikey } = ctx
  const prompt = text

  if (!prompt) {
    await reply(sock, chatId,
      `🤖 *ChatGPT IA*
━${'━'.repeat(30)}
Chatea con inteligencia artificial.

◆ ${'.gpt <tu pregunta>'}

◆ ${'.gpt ¿Cuál es la capital de Francia?'}

También disponible: .gemini, .gpt5, .glm5
⚡ OptiShield IA`,
      msg)
    return true
  }

  const { key: logKey } = await sock.sendMessage(chatId, { text: '🤔 Pensando...' }, { quoted: msg })

  try {
    const res = await global.OptiShield.callApi('ChatGPT', { prompt })

    if (res.error) {
      await sock.sendMessage(chatId, { text: `❌ ${res.error}`, edit: logKey })
      return true
    }

    const respuesta = res.result?.response || res.result?.text || res.result?.message || JSON.stringify(res.result)
    const finalText = `🤖 *ChatGPT*\n${'━'.repeat(28)}\n\n${respuesta}\n\n${'━'.repeat(28)}\n⚡ OptiShield IA`

    if (finalText.length > 4000) {
      const chunks = []
      let remaining = finalText
      while (remaining.length > 0) {
        chunks.push(remaining.substring(0, 3800))
        remaining = remaining.substring(3800)
      }
      await sock.sendMessage(chatId, { text: chunks[0], edit: logKey })
      for (let i = 1; i < chunks.length; i++) {
        await new Promise(r => setTimeout(r, 500))
        await sock.sendMessage(chatId, { text: chunks[i] })
      }
    } else {
      await sock.sendMessage(chatId, { text: finalText, edit: logKey })
    }

  } catch (err) {
    console.error('❌ ChatGPT error:', err)
    await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}`, edit: logKey })
  }

  return true
}
