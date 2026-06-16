export const meta = {
  name: 'xvideos-search',
  commands: ['xvideos', 'xv', 'xvideo', 'xvdl', 'xvsearch'],
  priority: 4,
  class: 'Descargadores',
  premium: true,
  nsfw: true,
  description: 'Busca y descarga videos de XVideos',
}

export default async function (msg, sock, ctx) {
  const { chatId, args, apikey } = ctx
  const parts = args
  const subCmd = parts[0]?.toLowerCase()

  if (!args.length) {
    await sock.sendMessage(chatId, {
      text: '╔═══════════════════╗\n' +
            '║  🔞 XVIDEOS       ║\n' +
            '╚═══════════════════╝\n\n' +
            '❌ *Uso:*\n' +
            '• \`.xv <búsqueda>\` — Buscar videos\n' +
            '• \`.xv dl <url>\` — Descargar video\n\n' +
            '📝 *Ejemplos:*\n' +
            '• \`.xv hot\`\n' +
            '• \`.xv dl https://xvideos.com/video...\`\n\n' +
            '⚡ OptiShield'
    }, { quoted: msg })
    return true
  }

  const { key: logKey } = await sock.sendMessage(chatId, {
    text: '⏳ Procesando...'
  }, { quoted: msg })

  const edit = async (text) => {
    try { await sock.sendMessage(chatId, { text, edit: logKey }) } catch { }
  }

  try {
    // ── DOWNLOAD ─────────────────────────────────────────────────────
    if (subCmd === 'dl' && parts[1]) {
      const videoUrl = parts[1]

      await edit('📥 *Descargando video de XVideos...*')

      const res = await global.OptiShield.callApi('xvideosdl', {
        url: videoUrl,
        apikey,
      })

      if (res.error) {
        await edit(`❌ *Error al descargar*\n\n${res.error}`)
        return true
      }

      const data = res.result || res
      const fileUrl = data.file || data.url || data.downloadUrl || data.videoUrl
      const title = data.title || data.name || 'XVideos Video'
      const duration = data.duration || ''
      const quality = data.quality || data.qualityLabel || ''

      if (fileUrl) {
        let caption = `🎬 *${title}*\n`
        if (duration) caption += `⏱️ ${duration}\n`
        if (quality) caption += `📺 ${quality}\n`
        caption += '\n⚡ OptiShield'

        await sock.sendMessage(chatId, {
          video: { url: fileUrl },
          caption,
        }, { quoted: msg })
      } else {
        await edit(`✅ *Video listo*\n\n🔗 ${JSON.stringify(data)}`)
      }
      return true
    }

    // ── SEARCH ───────────────────────────────────────────────────────
    const query = args.join(' ').trim()
    await edit(`🔍 *Buscando en XVideos:* "${query}"...`)

    const res = await global.OptiShield.callApi('xvideosSearch', {
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
                 `💡 Prueba con otros términos.\n` +
                 `📝 Ejemplo: \`.xv hot\``)
      return true
    }

    const list = Array.isArray(results) ? results : [results]
    const maxResults = Math.min(list.length, 8)

    let text = '🔞 *VIDEOS ENCONTRADOS*\n' +
               '━━━━━━━━━━━━━━━━━━━━━━\n' +
               `📌 Búsqueda: "${query}"\n` +
               `📊 Resultados: ${list.length}\n\n`

    for (let i = 0; i < maxResults; i++) {
      const v = list[i]
      const title = v.title || v.name || v.titulo || 'Video'
      const duration = v.duration || v.duracion || v.length || ''
      const quality = v.quality || v.qualityLabel || v.definition || ''
      const views = v.views || v.vistas || v.visitas || ''
      const rating = v.rating || v.score || ''
      const url = v.url || v.link || ''

      text += `*${i + 1}.* ${title.slice(0, 60)}${title.length > 60 ? '...' : ''}\n`
      if (duration) text += `   ⏱️ ${duration}\n`
      if (quality) text += `   📺 ${quality}\n`
      if (views) text += `   👁️ ${Number(views).toLocaleString()} vistas\n`
      if (rating) text += `   ⭐ ${rating}/5\n`
      if (url) text += `   🔗 ${url}\n`
      text += '\n'
    }

    if (list.length > maxResults) {
      text += `... y ${list.length - maxResults} más\n\n`
    }

    text += '━━━━━━━━━━━━━━━━━━━━━━\n' +
            '💡 Usa \`.xv dl <url>\` para descargar\n' +
            '⚡ OptiShield'

    await edit(text)

  } catch (err) {
    console.error('[xvideos] Error:', err.message)
    await edit(`❌ *Error*\n\n${err.message}\n\n🔄 Intenta de nuevo.`)
  }

  return true
}
