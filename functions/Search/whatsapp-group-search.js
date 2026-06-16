export const meta = {
  name: 'whatsapp-group-search',
  commands: ['grupos', 'groups', 'grupowa', 'groupwa'],
  priority: 4,
  class: 'Buscadores',
  premium: true,
  description: 'Busca grupos públicos de WhatsApp por tema o categoría',
}

export default async function (msg, sock, ctx) {
  const { chatId, args, apikey } = ctx
  const query = args.join(' ').trim()

  if (!query) {
    await sock.sendMessage(chatId, {
      text: '╔═══════════════════╗\n' +
            '║  🔍 BUSCAR GRUPOS ║\n' +
            '╚═══════════════════╝\n\n' +
            '❌ *Uso:* `.grupos <búsqueda>`\n\n' +
            '📝 *Ejemplos:*\n' +
            '• `.grupos anime` — Grupos de anime\n' +
            '• `.grupos programación` — Grupos de coding\n' +
            '• `.grupos música` — Grupos musicales\n\n' +
            '🔍 Busca grupos públicos en directorios web.\n' +
            '⚡ OptiShield'
    }, { quoted: msg })
    return true
  }

  const { key: logKey } = await sock.sendMessage(chatId, {
    text: `🔍 *Buscando grupos:* "${query}"...`
  }, { quoted: msg })

  const edit = async (text) => {
    try { await sock.sendMessage(chatId, { text, edit: logKey }) } catch { }
  }

  try {
    const res = await global.OptiShield.callApi('whatsapp-group-search', {
      query,
      apikey,
    })

    if (res.error) {
      await edit(`❌ *Error en la búsqueda*\n\n${res.error}`)
      return true
    }

    const results = res?.result?.results || res?.results || res?.result || []

    if (!results || (Array.isArray(results) && results.length === 0)) {
      await edit(`🔍 *Sin resultados para:* "${query}"\n\n` +
                 `💡 Prueba con términos más generales.\n` +
                 `📝 Ejemplo: \`.grupos anime\``)
      return true
    }

    const list = Array.isArray(results) ? results : [results]
    const maxResults = Math.min(list.length, 10)

    let text = `🔍 *GRUPOS ENCONTRADOS*\n` +
               `━━━━━━━━━━━━━━━━━━━━━━\n` +
               `📌 Búsqueda: "${query}"\n` +
               `📊 Resultados: ${list.length}\n\n`

    for (let i = 0; i < maxResults; i++) {
      const g = list[i]
      const name = g.name || g.title || g.nombre || 'Grupo'
      const desc = g.description || g.desc || g.descripcion || ''
      const link = g.link || g.url || g.invite || g.enlace || ''
      const members = g.members || g.miembros || g.count || ''
      const lang = g.lang || g.language || g.idioma || ''

      text += `*${i + 1}.* ${name}\n`
      if (desc) text += `   📝 ${desc.slice(0, 80)}${desc.length > 80 ? '...' : ''}\n`
      if (members) text += `   👥 ${members} miembros\n`
      if (lang) text += `   🌐 ${lang}\n`
      if (link) text += `   🔗 ${link}\n`
      text += '\n'
    }

    if (list.length > maxResults) {
      text += `... y ${list.length - maxResults} más\n\n`
    }

    text += '━━━━━━━━━━━━━━━━━━━━━━\n' +
            '💡 Haz clic en el enlace para unirte\n' +
            '⚡ OptiShield'

    await edit(text)

    // Send first 3 group links as quick actions
    for (let i = 0; i < Math.min(list.length, 3); i++) {
      const g = list[i]
      const link = g.link || g.url || g.invite || g.enlace || ''
      const name = g.name || g.title || g.nombre || 'Grupo'
      if (link) {
        await sock.sendMessage(chatId, {
          text: `📎 *${name}*\n${link}`,
        }, { quoted: msg })
        await new Promise(r => setTimeout(r, 300))
      }
    }

  } catch (err) {
    console.error('[grupos] Error:', err.message)
    await edit(`❌ *Error al buscar grupos*\n\n${err.message}\n\n🔄 Intenta de nuevo.`)
  }

  return true
}
