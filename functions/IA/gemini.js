import { reply } from '../../lib/utils.js'

export const meta = {
  name: 'Gemini',
  commands: ['gemini', 'gem'],
  priority: 5,
  premium: true,
  class: 'IA',
  description: 'Chat with Google Gemini AI with session memory'
}

const SESSIONS = new Map()
const MAX_SESSION_AGE = 30 * 60 * 1000

setInterval(() => {
  const now = Date.now()
  for (const [key, val] of SESSIONS) {
    if (now - val.lastAccess > MAX_SESSION_AGE) SESSIONS.delete(key)
  }
}, 60000)

export default async function (msg, sock, ctx) {
  const { chatId, text, sender } = ctx

  if (text === 'reset' || text === 'clear' || text === 'reiniciar') {
    SESSIONS.delete(sender)
    await reply(sock, chatId, `🔄 *Sesión reiniciada*

Gemini ha olvidado la conversación anterior.
${'━'.repeat(28)}
⚡ OptiShield IA`, msg)
    return true
  }

  if (!text) {
    await reply(sock, chatId,
      `🧠 *Gemini AI*
${'━'.repeat(28)}
Chatea con Google Gemini.
Mantiene contexto de la conversación por 30 min.

◆ ${'.gemini <pregunta>'}
◆ ${'.gemini reset'} — Reiniciar conversación

◆ ${'.gemini Explica la teoría de la relatividad'}

También disponible: .gpt, .gpt5, .glm5
⚡ OptiShield IA`,
      msg)
    return true
  }

  const { key: logKey } = await sock.sendMessage(chatId, { text: '🧠 Analizando...' }, { quoted: msg })

  try {
    let session = SESSIONS.get(sender)
    if (!session) {
      session = { id: sender, created: Date.now(), lastAccess: Date.now() }
      SESSIONS.set(sender, session)
    }
    session.lastAccess = Date.now()

    const res = await global.OptiShield.callApi('gemini', {
      text,
      session: session.id
    })

    if (res.error) {
      await sock.sendMessage(chatId, { text: `❌ ${res.error}`, edit: logKey })
      return true
    }

    const respuesta = res.result?.response || res.result?.text || res.result?.message || JSON.stringify(res.result)

    const finalText = `🧠 *Gemini AI*\n${'━'.repeat(28)}\n\n${respuesta}\n\n${'━'.repeat(28)}\n💡 .gemini reset — Reiniciar sesión\n⚡ OptiShield IA`

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
    console.error('❌ Gemini error:', err)
    await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}`, edit: logKey })
  }

  return true
}
