import { reply, editLog } from '../../lib/utils.js'

export const meta = {
  name: 'AnimeSearch',
  commands: ['anime', 'animeinfo', 'animebuscar', 'anisearch'],
  priority: 4,
  class: 'Anime',
  description: 'Busca y obtén información de animes'
}

export default async function (msg, sock, ctx) {
  const { chatId, command, text } = ctx

  if (!text) {
    await reply(sock, chatId,
      '🎌 *Anime Search*\n\n' +
      'Busca animes, mira información y descarga episodios.\n\n' +
      '📝 *.anime <nombre>* — Buscar anime\n' +
      '📝 *.animeinfo <slug>* — Info detallada\n\n' +
      '✨ *Ejemplos:*\n' +
      '• .anime One Piece\n' +
      '• .anime Shingeki no Kyojin',
      msg)
    return true
  }

  const { key: logKey } = await sock.sendMessage(chatId, { text: '🎌 Buscando anime...' }, { quoted: msg })

  try {
    const res = await global.OptiShield.callApi('animeSearch', { query: text })

    if (res.error) {
      await sock.sendMessage(chatId, { text: `❌ ${res.error}`, edit: logKey })
      return true
    }

    const results = res.result?.results || []
    if (!results.length) {
      await sock.sendMessage(chatId, { text: `❌ No se encontraron animes para "${text}"`, edit: logKey })
      return true
    }

    let msgText = `🎌 *Resultados: ${text}*\n━━━━━━━━━━━━━━━━━━━━\n\n`

    for (let i = 0; i < Math.min(results.length, 8); i++) {
      const r = results[i]
      msgText += `${i + 1}. *${r.title || r.name || 'N/A'}*\n`
      if (r.type) msgText += `   📺 ${r.type}\n`
      if (r.score) msgText += `   ⭐ ${r.score}\n`
      if (r.status) msgText += `   📊 ${r.status}\n`
      msgText += '\n'
    }

    msgText += '━━━━━━━━━━━━━━━━━━━━\n'
    msgText += '💡 .animeinfo <slug> para más detalles\n'
    msgText += '🎌 OptiShield Anime'

    await sock.sendMessage(chatId, { text: msgText, edit: logKey })

  } catch (err) {
    console.error('❌ AnimeSearch error:', err)
    await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}`, edit: logKey })
  }

  return true
}
