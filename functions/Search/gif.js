import { reply, editLog, ProgressBar } from '../../lib/utils.js'

export const meta = {
  name: 'GIFSearch',
  commands: ['gif', 'gifsearch'],
  priority: 4,
  premium: true,
  class: 'Buscadores',
  description: 'Busca y descarga GIFs animados'
}

export default async function (msg, sock, ctx) {
  const { chatId, text } = ctx

  if (!text) {
    await reply(sock, chatId,
      `🎥 *GIF Search*
${'─'.repeat(28)}
Busca y descarga GIFs animados.

◆ ${'.gif <búsqueda>'}

◆ .gif gato bailando
◆ .gif reacción sorpresa
◆ .gif anime kiss

⚡ OptiShield`,
      msg)
    return true
  }

  const { key: logKey } = await sock.sendMessage(chatId, { text: `🔍 Buscando GIFs de "${text}"...` }, { quoted: msg })

  try {
    const res = await global.OptiShield.callApi('gifSearch', { query: text })
    if (res.error) { await sock.sendMessage(chatId, { text: `❌ ${res.error}`, edit: logKey }); return true }

    const gifs = res.result?.gifs || []
    if (!gifs.length) { await sock.sendMessage(chatId, { text: `❌ No se encontraron GIFs para "${text}"`, edit: logKey }); return true }

    const selected = gifs[Math.floor(Math.random() * Math.min(gifs.length, 5))]
    const videoUrl = selected?.url
    if (!videoUrl) { await sock.sendMessage(chatId, { text: '❌ Error al obtener el GIF', edit: logKey }); return true }

    await editLog(sock, chatId, logKey, `🎥 Enviando GIF...\n\n${ProgressBar(3)}`)
    await sock.sendMessage(chatId, { video: { url: videoUrl }, caption: `🎥 *GIF*\n🔍 "${text}"\n\n⚡ OptiShield` }, { quoted: msg })
    await sock.sendMessage(chatId, { text: `✅ ¡GIF enviado!\n\n${ProgressBar(4)}`, edit: logKey })

  } catch (err) {
    console.error('❌ GIF error:', err)
    await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}`, edit: logKey })
  }
  return true
}
