import { reply } from '../../lib/utils.js'

export const meta = {
  name: 'GLM5',
  commands: ['glm', 'glm5', 'glmturbo'],
  priority: 5,
  premium: true,
  class: 'IA',
  description: 'GLM-5 Turbo AI with memory per chat'
}

export default async function (msg, sock, ctx) {
  const { chatId, text } = ctx

  if (text === 'reset' || text === 'clear') {
    const res = await global.OptiShield.callApi('GLM-5-Turbo', { prompt: '', chatId, resetChat: true })
    await reply(sock, chatId,
      `🔄 *Sesión reiniciada*
${'━'.repeat(28)}
GLM-5 ha olvidado todo.
⚡ OptiShield IA`, msg)
    return true
  }

  if (!text) {
    await reply(sock, chatId,
      `🧠 *GLM-5 Turbo*
${'━'.repeat(28)}
IA con memoria persistente por chat.
Recuerda toda la conversación.

◆ ${'.glm5 <mensaje>'}
◆ ${'.glm5 reset'} — Reiniciar memoria

◆ ${'.glm5 ¿Cuál es el sentido de la vida?'}

También disponible: .gpt, .gemini, .gpt5
⚡ OptiShield IA`,
      msg)
    return true
  }

  const { key: logKey } = await sock.sendMessage(chatId, { text: '🧠 Procesando con GLM-5...' }, { quoted: msg })

  try {
    const res = await global.OptiShield.callApi('GLM-5-Turbo', { prompt: text, chatId })

    if (res.error) {
      await sock.sendMessage(chatId, { text: `❌ ${res.error}`, edit: logKey })
      return true
    }

    const respuesta = res.result?.response || res.result?.text || res.result?.message || JSON.stringify(res.result)
    const finalText = `🧠 *GLM-5 Turbo*\n${'━'.repeat(28)}\n\n${respuesta}\n\n${'━'.repeat(28)}\n💡 .glm5 reset — Reiniciar sesión\n⚡ OptiShield IA`

    if (finalText.length > 4000) {
      const chunks = []; let remaining = finalText
      while (remaining.length > 0) { chunks.push(remaining.substring(0, 3800)); remaining = remaining.substring(3800) }
      await sock.sendMessage(chatId, { text: chunks[0], edit: logKey })
      for (let i = 1; i < chunks.length; i++) { await new Promise(r => setTimeout(r, 500)); await sock.sendMessage(chatId, { text: chunks[i] }) }
    } else {
      await sock.sendMessage(chatId, { text: finalText, edit: logKey })
    }

  } catch (err) {
    console.error('❌ GLM5 error:', err)
    await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}`, edit: logKey })
  }

  return true
}
