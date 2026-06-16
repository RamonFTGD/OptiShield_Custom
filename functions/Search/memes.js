import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { sendInteractiveMessage } = require('gifted-btns')

export const meta = {
  name: 'Memes',
  commands: ['meme', 'memes'],
  priority: 5,
  premium: true,
  class: 'Buscadores',
  public: true,
  description: 'Genera memes por categoría (30+ categorías)',
}

const MEME_CATEGORIES = [
  { name: 'Random',       query: 'memes español graciosos',          emoji: '🎲' },
  { name: 'Anime',        query: 'memes anime español',              emoji: '🎌' },
  { name: 'Gatos',        query: 'memes gatos graciosos',            emoji: '🐱' },
  { name: 'Perros',       query: 'memes perros chistosos',           emoji: '🐶' },
  { name: 'Gaming',       query: 'memes videojuegos gaming',         emoji: '🎮' },
  { name: 'Programación', query: 'memes programadores developers',   emoji: '💻' },
  { name: 'Trabajo',      query: 'memes trabajo oficina',            emoji: '💼' },
  { name: 'Escuela',      query: 'memes estudiantes escuela',        emoji: '📚' },
  { name: 'Amor',         query: 'memes amor pareja novios',         emoji: '❤️' },
  { name: 'Comida',       query: 'memes comida hamburguesas',        emoji: '🍔' },
  { name: 'Gym',          query: 'memes gimnasio fitness',           emoji: '💪' },
  { name: 'Dormir',       query: 'memes dormir cansancio',           emoji: '😴' },
  { name: 'Lunes',        query: 'memes lunes odio',                 emoji: '😩' },
  { name: 'Viernes',      query: 'memes viernes fin de semana',      emoji: '🎉' },
  { name: 'Mamá',         query: 'memes mamá latina',                emoji: '👩' },
  { name: 'Papá',         query: 'memes papá chancla',               emoji: '👨' },
  { name: 'WhatsApp',     query: 'memes whatsapp conversaciones',    emoji: '💬' },
  { name: 'TikTok',       query: 'memes tiktok viral',               emoji: '🎵' },
  { name: 'Netflix',      query: 'memes netflix series',             emoji: '📺' },
  { name: 'Fútbol',       query: 'memes futbol soccer',              emoji: '⚽' },
  { name: 'Pokémon',      query: 'memes pokemon pikachu',            emoji: '⚡' },
  { name: 'Dragon Ball',  query: 'memes dragon ball goku',           emoji: '🐉' },
  { name: 'Naruto',       query: 'memes naruto sasuke',              emoji: '🍥' },
  { name: 'One Piece',    query: 'memes one piece luffy',            emoji: '🏴‍☠️' },
  { name: 'Marvel',       query: 'memes marvel avengers',            emoji: '🦸' },
  { name: 'Star Wars',    query: 'memes star wars',                  emoji: '⭐' },
  { name: 'Among Us',     query: 'memes among us impostor',          emoji: '🔴' },
  { name: 'Minecraft',    query: 'memes minecraft creeper',          emoji: '⛏️' },
  { name: 'Amigos',       query: 'memes amigos mejores',             emoji: '👥' },
  { name: 'DC',           query: 'memes dc batman superman',         emoji: '🦇' },
]

export default async function (msg, sock, ctx) {
  const jid    = msg.key.remoteJid
  const query  = ctx.args.join(' ').trim()

  if (!query) {
    const sections = []
    const chunkSize = 10
    for (let i = 0; i < MEME_CATEGORIES.length; i += chunkSize) {
      const chunk = MEME_CATEGORIES.slice(i, i + chunkSize)
      sections.push({
        title: `😂 Categorías ${i + 1}–${i + chunk.length}`,
        rows: chunk.map(c => ({
          id: `.meme ${c.name}`,
          title: `${c.emoji} ${c.name}`,
          description: 'Toca para ver memes'
        }))
      })
    }
    await sendInteractiveMessage(sock, jid, {
      title: '😂 Memes',
      text:
        `😂 *Memes*
${'─'.repeat(28)}
${MEME_CATEGORIES.length} categorías disponibles.

◆ .meme <categoría> — Por categoría
◆ .meme <tema> — Búsqueda personalizada

◆ .meme programación

⚡ OptiShield Memes`,
      footer: 'OptiShield • Memes 😂',
      interactiveButtons: [{
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: '😂 Elegir categoría',
          sections
        })
      }]
    })
    return true
  }

  try {
    const category = MEME_CATEGORIES.find(c => c.name.toLowerCase() === query.toLowerCase())
    const searchQuery = category ? category.query : `memes ${query} graciosos español`

    const res = await global.OptiShield.callApi('pinterestSearch', { query: searchQuery })
    if (res.error || !res?.result?.ok || !res.result.results?.length) {
      await sock.sendMessage(jid, { text: `❌ No se encontraron memes de "${query}"` }, { quoted: msg })
      return true
    }

    const images = res.result.results.filter(r => typeof r.archivo === 'string' && !r.video)
    if (!images.length) {
      await sock.sendMessage(jid, { text: `⚠️ No hay memes válidos para "${query}"` }, { quoted: msg })
      return true
    }

    const randomMeme = images[Math.floor(Math.random() * images.length)]
    const emoji = category ? category.emoji : '😂'
    const categoryName = category ? category.name : query

    await sock.sendMessage(jid, {
      image: { url: randomMeme.archivo },
      caption:
        `${emoji} *${categoryName}*\n\n` +
        `🎲 ${images.length}+ memes disponibles\n` +
        `💡 .meme ${categoryName} — Otro\n` +
        `📋 .meme — Ver categorías`
    }, { quoted: msg })

  } catch (err) {
    console.error('❌ meme error:', err)
    await sock.sendMessage(jid, { text: '❌ Error: ' + err.message }, { quoted: msg })
  }
  return true
}
