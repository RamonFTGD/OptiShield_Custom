import { reply } from '../../lib/utils.js'

export const meta = {
  name: 'AIModels',
  commands: ['ai', 'modelo', 'model'],
  priority: 5,
  premium: true,
  class: 'IA',
  description: 'List available AI models and chat with specific ones'
}

const MODELS = [
  { name: 'ChatGPT',          api: 'ChatGPT',         desc: 'ChatGPT Nano 4.1',           emoji: '🤖' },
  { name: 'GPT-5 Mini',       api: 'ChatGPT-5_mini',  desc: 'ChatGPT 5 Mini',             emoji: '⚡' },
  { name: 'Gemini',           api: 'gemini',          desc: 'Google Gemini',              emoji: '🧠' },
  { name: 'Gemma 3',          api: 'gemma-3',         desc: 'Google Gemma 3',             emoji: '🟢' },
  { name: 'Gemma 3 12B',      api: 'gemma-3-12b',     desc: 'Gemma 3 12B params',         emoji: '🟢' },
  { name: 'Gemma 3 4B',       api: 'gemma-3-4b',      desc: 'Gemma 3 4B params',          emoji: '🟢' },
  { name: 'Llama 3.2',        api: 'llama-3.2',       desc: 'Meta Llama 3.2',             emoji: '🦙' },
  { name: 'Llama 3.3',        api: 'llama-3.3',       desc: 'Meta Llama 3.3',             emoji: '🦙' },
  { name: 'Mistral Small 3',  api: 'mistral-small-3', desc: 'Mistral AI Small',           emoji: '🌬️' },
  { name: 'Qwen 3 4B',        api: 'qwen3-4b',        desc: 'Qwen 3 4B',                  emoji: '🐉' },
  { name: 'Qwen 3 Code',      api: 'qwen3-code',      desc: 'Qwen 3 Code',                emoji: '💻' },
  { name: 'Dolphine Mistral', api: 'dolphine-mistral-24b', desc: 'Dolphine Mistral 24B',  emoji: '🐬' },
  { name: 'Hermes 3 Llama',   api: 'hermes-3-llama',  desc: 'Hermes 3 Llama',             emoji: '🔮' },
  { name: 'Felo AI',          api: 'felo',            desc: 'Felo AI Search',             emoji: '🔍' },
  { name: 'Gita AI',          api: 'gita',            desc: 'Bhagavad Gita AI',           emoji: '📿' },
  { name: 'Mova AI',          api: 'mova',            desc: 'Mova AI',                    emoji: '✨' },
  { name: 'OptiShield V2',    api: 'OptiShieldV2',    desc: 'Multimodal IA V2',           emoji: '🛡️' },
  { name: 'OptiShield',       api: 'OptiShield',      desc: 'IA avanzada',                emoji: '🛡️' },
  { name: 'OptiShield Agent', api: 'optishield-agente', desc: 'Agente con memoria',       emoji: '🤖' },
  { name: 'GLM-5 Turbo',      api: 'GLM-5-Turbo',     desc: 'GLM 5 Turbo con memoria',    emoji: '⚡' },
  { name: 'IA Fast',          api: 'ia-fast',         desc: 'IA optimizada con memoria',  emoji: '🚀' },
  { name: 'Trinity Mini',     api: 'trinitymini',     desc: 'Trinity Mini',               emoji: '🔷' },
  { name: 'Trinity Large',    api: 'trinitylarge',    desc: 'Trinity Large',              emoji: '🔶' },
  { name: 'StepFlash',        api: 'stepflash',       desc: 'StepFun Flash',              emoji: '⚡' },
]

export default async function (msg, sock, ctx) {
  const { chatId, args, text } = ctx

  // .ai <nombre modelo> <prompt>
  if (args.length >= 2) {
    const modelName = args[0].toLowerCase()
    const prompt = args.slice(1).join(' ')

    const model = MODELS.find(m =>
      m.name.toLowerCase().includes(modelName) ||
      m.api.toLowerCase().includes(modelName)
    )

    if (!model) {
      const names = MODELS.map(m => `• ${m.emoji} ${m.name}`).join('\n')
      await reply(sock, chatId,
        `❌ Modelo "${args[0]}" no encontrado.\n\n*Modelos disponibles:*\n${names}`,
        msg)
      return true
    }

    const { key: logKey } = await sock.sendMessage(chatId, { text: `${model.emoji} Consultando ${model.name}...` }, { quoted: msg })

    try {
      const apiParams = { prompt }
      if (['gemini', 'felo', 'gita', 'mova'].includes(model.api)) {
        apiParams.text = prompt
        delete apiParams.prompt
      } else if (model.api === 'OptiShield') {
        apiParams.mensaje = prompt
        delete apiParams.prompt
      }

      const res = await global.OptiShield.callApi(model.api, apiParams)

      if (res.error) {
        await sock.sendMessage(chatId, { text: `❌ ${res.error}`, edit: logKey })
        return true
      }

      const respuesta = res.result?.response || res.result?.text || res.result?.message || JSON.stringify(res.result)
      const finalText = `${model.emoji} *${model.name}*\n━━━━━━━━━━━━━━━━━━━━\n\n${respuesta}\n\n━━━━━━━━━━━━━━━━━━━━\n⚡ OptiShield IA`

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
      console.error(`❌ ${model.name} error:`, err)
      await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}`, edit: logKey })
    }

    return true
  }

  // .ai — show model list
  const groups = {}
  for (const m of MODELS) {
    const category = m.api.includes('gemma') || m.api.includes('llama') || m.api.includes('qwen') || m.api.includes('mistral') || m.api.includes('trinity') ? 'Text To Text' :
                     m.api.includes('gemini') || m.api.includes('ChatGPT') || m.api.includes('felo') || m.api.includes('mova') || m.api.includes('gita') ? 'Chat' :
                     m.api.includes('OptiShield') || m.api.includes('GLM') || m.api.includes('ia-fast') ? 'Asistentes' : 'Otros'
    if (!groups[category]) groups[category] = []
    groups[category].push(m)
  }

  let menuText = '🤖 *MODELOS DE IA DISPONIBLES*\n'
  menuText += `📊 Total: ${MODELS.length} modelos\n━━━━━━━━━━━━━━━━━━━━\n\n`

  for (const [cat, models] of Object.entries(groups)) {
    menuText += `▸ *${cat}*\n`
    for (const m of models) {
      menuText += `   ${m.emoji} ${m.name} — ${m.desc}\n`
    }
    menuText += '\n'
  }

  menuText += '━━━━━━━━━━━━━━━━━━━━\n'
  menuText += '💡 *.ai <modelo> <mensaje>* — Chatear\n'
  menuText += '💡 *.gpt <mensaje>* — ChatGPT rápido\n'
  menuText += '💡 *.gemini <mensaje>* — Gemini rápido\n'
  menuText += '⚡ OptiShield IA'

  await reply(sock, chatId, menuText, msg)
  return true
}
