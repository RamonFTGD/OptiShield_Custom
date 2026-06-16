export const meta = {
  name: 'mods-bedrock',
  commands: ['modsbedrock', 'bedrock', 'addon', 'mcaddon'],
  priority: 4,
  class: 'Buscadores',
  premium: true,
  description: 'Busca y descarga addons de Minecraft Bedrock desde CurseForge',
}

export default async function (msg, sock, ctx) {
  const { chatId, args } = ctx
  const query = args.join(' ').trim()

  if (!query) {
    await sock.sendMessage(chatId, {
      text: '╔═══════════════════╗\n' +
            '║  ⛏️ BEDROCK MODS ║\n' +
            '╚═══════════════════╝\n\n' +
            '❌ *Uso:*\n' +
            '• \`.bedrock <búsqueda>\` — Buscar addons\n' +
            '• \`.bedrock info <link>\` — Info de un addon\n' +
            '• \`.bedrock dl <link>\` — Descargar addon\n\n' +
            '📝 *Ejemplos:*\n' +
            '• \`.bedrock furniture\`\n' +
            '• \`.bedrock info https://curseforge.com/...\`\n' +
            '• \`.bedrock dl https://curseforge.com/...\`\n\n' +
            '⚡ OptiShield'
    }, { quoted: msg })
    return true
  }

  const { key: logKey } = await sock.sendMessage(chatId, {
    text: `⏳ Procesando solicitud...`
  }, { quoted: msg })

  const edit = async (text) => {
    try { await sock.sendMessage(chatId, { text, edit: logKey }) } catch { }
  }

  try {
    const parts = args
    const subCmd = parts[0]?.toLowerCase()

    // ── INFO ──────────────────────────────────────────────────────────
    if (subCmd === 'info' && parts[1]) {
      const url = parts[1]
      await edit('🔍 *Obteniendo información del addon...*')

      const res = await global.OptiShield.callApi('mods-bedrock-version', { link: url })

      if (res.error) {
        await edit(`❌ *Error*\n\n${res.error}`)
        return true
      }

      const data = res.result || res

      let text = '📦 *INFO DEL ADDON*\n' +
                 '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
                 `📛 *${data.name || data.title || 'Desconocido'}*\n`

      if (data.description) text += `📝 ${data.description.slice(0, 200)}\n`
      if (data.version) text += `🔖 Versión: ${data.version}\n`
      if (data.mcVersion || data.gameVersion) text += `⛏️ Minecraft: ${data.mcVersion || data.gameVersion}\n`
      if (data.author) text += `👤 Autor: ${data.author}\n`
      if (data.downloads || data.downloadCount) text += `📥 Descargas: ${(data.downloads || data.downloadCount).toLocaleString()}\n`
      if (data.rating || data.score) text += `⭐ ${data.rating || data.score}/5\n`
      if (data.updated || data.lastUpdate) text += `🔄 Actualizado: ${data.updated || data.lastUpdate}\n`

      text += '\n━━━━━━━━━━━━━━━━━━━━━━\n' +
              '💡 Usa \`.bedrock dl <link>\` para descargar\n' +
              '⚡ OptiShield'

      if (data.icon || data.thumbnail) {
        await sock.sendMessage(chatId, {
          image: { url: data.icon || data.thumbnail },
          caption: text,
        }, { quoted: msg })
      } else {
        await edit(text)
      }
      return true
    }

    // ── DOWNLOAD ─────────────────────────────────────────────────────
    if (subCmd === 'dl' && parts[1]) {
      const url = parts[1]
      await edit('📥 *Descargando addon...*\n\nEsto puede tomar un momento...')

      const res = await global.OptiShield.callApi('mods-bedrockdl', { link: url })

      if (res.error) {
        await edit(`❌ *Error al descargar*\n\n${res.error}`)
        return true
      }

      const data = res.result || res
      const fileUrl = data.file || data.url || data.downloadUrl || data.link
      const fileName = data.filename || data.name || 'addon.mcaddon'

      if (fileUrl) {
        await edit(`✅ *Addon descargado!*\n\nEnviando archivo...`)

        await sock.sendMessage(chatId, {
          document: { url: fileUrl },
          mimetype: 'application/octet-stream',
          fileName: fileName.endsWith('.mcaddon') ? fileName : `${fileName}.mcaddon`,
          caption: `📦 *${data.name || 'Addon'}*\n` +
                   (data.version ? `🔖 v${data.version}\n` : '') +
                   '\n📁 Abre este archivo con Minecraft para instalarlo.\n⚡ OptiShield',
        }, { quoted: msg })
      } else {
        await edit(`✅ *Addon listo*\n\n🔗 ${JSON.stringify(data)}`)
      }
      return true
    }

    // ── SEARCH ───────────────────────────────────────────────────────
    await edit(`🔍 *Buscando addons:* "${query}"...`)

    const res = await global.OptiShield.callApi('mods-bedrock-search', { query })

    if (res.error) {
      await edit(`❌ *Error en la búsqueda*\n\n${res.error}`)
      return true
    }

    const results = res?.result?.results || res?.results || res?.result || []

    if (!results || (Array.isArray(results) && results.length === 0)) {
      await edit(`🔍 *Sin resultados para:* "${query}"\n\n` +
                 `💡 Prueba con términos en inglés.\n` +
                 `📝 Ejemplo: \`.bedrock furniture\``)
      return true
    }

    const list = Array.isArray(results) ? results : [results]
    const maxResults = Math.min(list.length, 8)

    let text = '⛏️ *ADDONS DE MINECRAFT BEDROCK*\n' +
               '━━━━━━━━━━━━━━━━━━━━━━\n' +
               `📌 Búsqueda: "${query}"\n` +
               `📊 Resultados: ${list.length}\n\n`

    for (let i = 0; i < maxResults; i++) {
      const a = list[i]
      const name = a.name || a.title || 'Addon'
      const desc = a.description || a.summary || a.desc || ''
      const downloads = a.downloads || a.downloadCount || ''
      const rating = a.rating || a.score || ''

      text += `*${i + 1}.* ${name}\n`
      if (desc) text += `   📝 ${desc.slice(0, 100)}${desc.length > 100 ? '...' : ''}\n`
      if (downloads) text += `   📥 ${Number(downloads).toLocaleString()} descargas\n`
      if (rating) text += `   ⭐ ${rating}/5\n`
      text += '\n'
    }

    text += '━━━━━━━━━━━━━━━━━━━━━━\n' +
            '💡 Usa \`.bedrock info <link>\` para detalles\n' +
            '💡 Usa \`.bedrock dl <link>\` para descargar\n' +
            '⚡ OptiShield'

    await edit(text)

  } catch (err) {
    console.error('[bedrock] Error:', err.message)
    await edit(`❌ *Error*\n\n${err.message}\n\n🔄 Intenta de nuevo.`)
  }

  return true
}
