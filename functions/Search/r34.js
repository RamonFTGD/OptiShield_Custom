export const meta = {
  name: 'r34-search',
  commands: ['r34', 'rule34', 'rule34search'],
  priority: 4,
  class: 'Buscadores',
  premium: true,
  nsfw: true,
  description: 'Busca imágenes en Rule34 o descarga videos',
}

export default async function (msg, sock, ctx) {
  const { chatId, args, apikey } = ctx
  const parts = args
  const subCmd = parts[0]?.toLowerCase()

  if (!args.length) {
    await sock.sendMessage(chatId, {
      text: '╔═══════════════════╗\n' +
            '║  🔞 RULE34        ║\n' +
            '╚═══════════════════╝\n\n' +
            '❌ *Uso:*\n' +
            '• \`.r34 <tags>\` — Buscar imágenes\n' +
            '• \`.r34 video <url>\` — Descargar video\n\n' +
            '📝 *Ejemplos:*\n' +
            '• \`.r34 naruto\`\n' +
            '• \`.r34 video https://rule34video.com/...\`\n\n' +
            '💡 Separa múltiples tags con espacios\n' +
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
    // ── VIDEO DOWNLOAD ───────────────────────────────────────────────
    if (subCmd === 'video' && parts[1]) {
      const videoUrl = parts[1]
      const quality = parts[2] || ''

      await edit('📥 *Descargando video de Rule34...*')

      const res = await global.OptiShield.callApi('r34-video-download', {
        url: videoUrl,
        quality,
      })

      if (res.error) {
        await edit(`❌ *Error al descargar*\n\n${res.error}`)
        return true
      }

      const data = res.result || res
      const fileUrl = data.file || data.url || data.downloadUrl || data.videoUrl
      const title = data.title || data.name || 'Rule34 Video'
      const duration = data.duration || ''

      if (fileUrl) {
        let caption = `🎬 *${title}*\n`
        if (duration) caption += `⏱️ ${duration}\n`
        caption += '\n⚡ OptiShield'

        await sock.sendMessage(chatId, {
          video: { url: fileUrl },
          caption,
        }, { quoted: msg })
      } else {
        await edit(`✅ *Video listo*\n\n🔗 ${fileUrl || JSON.stringify(data)}`)
      }
      return true
    }

    // ── IMAGE SEARCH ─────────────────────────────────────────────────
    const query = args.join(' ').trim()
    await edit(`🔍 *Buscando en Rule34:* "${query}"...`)

    const res = await global.OptiShield.callApi('IMGR34Search', {
      query,
      apikey,
      limit: 15,
    })

    if (res.error) {
      await edit(`❌ *Error en la búsqueda*\n\n${res.error}`)
      return true
    }

    const results = res?.result?.results || res?.results || res?.result || []

    if (!results || (Array.isArray(results) && results.length === 0)) {
      await edit(`🔍 *Sin resultados para:* "${query}"\n\n` +
                 `💡 Prueba con otros tags.\n` +
                 `📝 Ejemplo: \`.r34 naruto\``)
      return true
    }

    const list = Array.isArray(results) ? results : [results]
    const maxSend = Math.min(list.length, 5)

    await edit(`✅ *${list.length} resultados* encontrados.\nEnviando ${maxSend} imágenes...`)

    for (let i = 0; i < maxSend; i++) {
      const img = list[i]
      const imgUrl = img.image || img.file_url || img.url || img.preview || img.sample
      const tags = img.tags || img.tagsString || ''
      const rating = img.rating || ''
      const score = img.score || ''

      if (imgUrl) {
        let caption = `🔞 *Resultado ${i + 1}/${maxSend}*\n`
        if (tags) caption += `🏷️ ${tags.slice(0, 100)}${tags.length > 100 ? '...' : ''}\n`
        if (rating) caption += `🔞 Rating: ${rating.toUpperCase()}\n`
        if (score) caption += `⭐ Score: ${score}\n`
        caption += '\n⚡ OptiShield'

        await sock.sendMessage(chatId, {
          image: { url: imgUrl },
          caption,
        }, { quoted: msg })

        await new Promise(r => setTimeout(r, 800))
      }
    }

    if (list.length > maxSend) {
      await sock.sendMessage(chatId, {
        text: `📊 *${list.length - maxSend} imágenes más* no mostradas.\n` +
              `Usa tags más específicos para mejores resultados.`,
      })
    }

  } catch (err) {
    console.error('[r34] Error:', err.message)
    await edit(`❌ *Error*\n\n${err.message}\n\n🔄 Intenta de nuevo.`)
  }

  return true
}
