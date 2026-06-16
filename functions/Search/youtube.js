export const meta = {
  name: 'YoutubeSearch',
  commands: ['ytsearch', 'yts', 'buscaryt'],
  priority: 5,
  premium: true,
  class: 'Buscadores',
  description: 'Busca videos en YouTube con resultados interactivos',
}

function getBaileysFns(sock) {
  const candidates = ['@whiskeysockets/baileys', 'baileys']
  for (const pkg of candidates) {
    try {
      const mod = require(pkg)
      const gf = (n) => mod[n] || mod.Utils?.[n]
      const generateWAMessageFromContent = gf('generateWAMessageFromContent')
      const prepareWAMessageMedia = gf('prepareWAMessageMedia')
      const generateMessageIDV2 = gf('generateMessageIDV2') || gf('generateMessageID')
      const isJidGroup = gf('isJidGroup') || mod.WABinary?.isJidGroup
      if (generateWAMessageFromContent && prepareWAMessageMedia && sock.relayMessage) {
        return { generateWAMessageFromContent, prepareWAMessageMedia, generateMessageIDV2, isJidGroup }
      }
    } catch (_) { }
  }
  return null
}

async function sendInteractiveWithImage(sock, jid, { imageUrl, bodyText, footerText, buttons, quotedMsg }) {
  const fns = getBaileysFns(sock)
  if (!fns) throw new Error('No se pudieron cargar las funciones internas de Baileys')
  const { generateWAMessageFromContent, prepareWAMessageMedia, generateMessageIDV2, isJidGroup } = fns

  let mediaContent = null
  if (imageUrl) {
    try {
      mediaContent = await prepareWAMessageMedia({ image: { url: imageUrl } }, { upload: sock.waUploadToServer })
    } catch (err) {
      console.warn('⚠ No se pudo preparar imagen para el header:', err.message)
    }
  }

  const interactiveMessage = {
    body: { text: bodyText || '' },
    footer: { text: footerText || '' },
    nativeFlowMessage: { buttons },
    header: mediaContent ? { title: '', hasMediaAttachment: true, ...mediaContent } : { title: '', hasMediaAttachment: false }
  }

  const userJid = sock.authState?.creds?.me?.id || sock.user?.id
  const fullMsg = generateWAMessageFromContent(jid, { interactiveMessage }, {
    logger: sock.logger, userJid,
    ...(generateMessageIDV2 ? { messageId: generateMessageIDV2(userJid) } : {}),
    quoted: quotedMsg
  })

  const additionalNodes = []
  const isPrivate = isJidGroup ? !isJidGroup(jid) : !jid.endsWith('@g.us')
  additionalNodes.push({
    tag: 'biz', attrs: {}, content: [{
      tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
    }]
  })
  if (isPrivate) additionalNodes.push({ tag: 'bot', attrs: { biz_bot: '1' } })

  await sock.relayMessage(jid, fullMsg.message, { messageId: fullMsg.key.id, additionalNodes })
  return fullMsg
}

export default async function (msg, sock, ctx) {
  const { chatId, prefix, args } = ctx
  const query = args.join(' ').trim()

  if (!query) {
    await sock.sendMessage(chatId, {
      text: `🔍 *YouTube Search*
${'─'.repeat(28)}
Busca videos y descarga MP3 o MP4.

◆ ${prefix}yts <búsqueda>

◆ ${prefix}yts Ghost Mary On A Cross

Selecciona 🎵 para MP3 o 🎬 para MP4
⚡ OptiShield`
    }, { quoted: msg })
    return true
  }

  const statusMsg = await sock.sendMessage(chatId, { text: `🔍 Buscando "${query}" en YouTube...` }, { quoted: msg })
  const edit = async (text) => { try { await sock.sendMessage(chatId, { text, edit: statusMsg.key }) } catch { } }

  try {
    const res = await global.OptiShield.callApi('youtubeSearch', { q: query })
    if (res.error || !res?.result?.results?.length) { await edit('❌ No se encontraron resultados.'); return true }

    const results = res.result.results.slice(0, 8)
    const firstVideoThumb = results[0]?.thumbnail || null
    const sections = []

    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      const titulo = r.title.length > 60 ? r.title.substring(0, 60) + '...' : r.title
      sections.push({
        title: `${i + 1}. ${titulo.substring(0, 24)}${titulo.length > 24 ? '...' : ''}`,
        rows: [
          { id: `.play ${r.url}`, title: `🎵 ${titulo.substring(0, 20)}${titulo.length > 20 ? '...' : ''}`, description: `MP3 • ${r.duration} • ${r.channel}` },
          { id: `.play2 ${r.url}`, title: `🎬 ${titulo.substring(0, 20)}${titulo.length > 20 ? '...' : ''}`, description: `MP4 • ${r.duration} • ${r.channel}` }
        ]
      })
    }

    let menuText = `🔎 Búsqueda: ${query}\n📊 Resultados: ${results.length}\n\n`
    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      const titulo = r.title.length > 50 ? r.title.substring(0, 50) + '...' : r.title
      menuText += `${i + 1}. ${titulo}\n   👤 ${r.channel} • ⏱️ ${r.duration}\n\n`
    }
    menuText += `Selecciona 🎵 para MP3 o 🎬 para MP4`

    await edit('✅ Resultados listos...')
    await sendInteractiveWithImage(sock, chatId, {
      imageUrl: firstVideoThumb,
      bodyText: menuText,
      footerText: `OptiShield • ${results.length} videos`,
      buttons: [
        { name: 'single_select', buttonParamsJson: JSON.stringify({ title: '🎵 Seleccionar video', sections }) },
        { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '🔍 Buscar en YouTube', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` }) }
      ],
      quotedMsg: msg
    })

  } catch (err) {
    console.error('❌ [ytsearch]', err.message)
    await edit(`❌ Error: ${err.message}`)
  }
  return true
}
