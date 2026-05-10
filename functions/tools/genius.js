export const meta = {
  name: 'genius',
  commands: ['genius', 'lyrics2'],
  priority: 4,
  class: 'Herramientas',
  premium: true,
}

export default async function (msg, sock, ctx) {
  const jid    = msg.key.remoteJid
  const query  = ctx.text.trim()
  const apikey = ctx?.info?.user?.apikey

  if (!apikey) {
    await sock.sendMessage(jid, { text: '❌ No tienes API Key válida.' })
    return true
  }

  if (!query) {
    await sock.sendMessage(jid, {
      text: '❌ Debes escribir el nombre de la canción.\nEjemplo:\n.genius Bohemian Rhapsody Queen\n.letra Despacito'
    })
    return true
  }

  await sock.sendMessage(jid, { text: '🔍 Buscando letra en Genius...' }, { quoted: msg })

  const res = await global.OptiShield.callApi('genius-search', { q: query, limit: '1', lyrics: 'true', apikey })

  if (res.error || !res?.result?.results?.length) {
    await sock.sendMessage(jid, { text: '❌ No se encontró letra para esa canción.' })
    return true
  }

  const song   = res.result.results[0]
  const lyrics = song.lyrics

  if (!lyrics) {
    await sock.sendMessage(jid, {
      text: `✅ Canción encontrada pero sin letra disponible:\n\n*${song.title}*\n👤 ${song.artist || '—'}\n\n🔗 ${song.url}`
    }, { quoted: msg })
    return true
  }

  const header =
    `🎵 *${song.title}*\n` +
    `👤 ${song.artist || '—'}\n` +
    `📅 ${song.releaseDate || '—'}\n` +
    `━━━━━━━━━━━━━━━━━━\n\n`

  const fullText = header + lyrics

  if (fullText.length <= 4000) {
    await sock.sendMessage(jid, { text: fullText }, { quoted: msg })
    return true
  }

  const chunks = []
  let remaining = lyrics
  while (remaining.length > 0) {
    chunks.push(remaining.substring(0, 3800))
    remaining = remaining.substring(3800)
  }

  await sock.sendMessage(jid, { text: header + chunks[0] }, { quoted: msg })

  for (let i = 1; i < chunks.length; i++) {
    await new Promise(r => setTimeout(r, 500))
    await sock.sendMessage(jid, { text: chunks[i] })
  }

  return true
}
