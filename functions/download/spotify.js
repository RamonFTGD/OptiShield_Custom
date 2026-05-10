import path from 'path'
import fs from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

export const meta = {
  name: 'spotify',
  commands: ['spotify', 'sp', 'spotifydl'],
  priority: 3,
  premium: true,
  class: 'Descargadores'
}

function getHighResSpotify(url) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const imageId = parsed.pathname.split('/').pop()
    if (!imageId || imageId.length < 14) return url

    const prefix = imageId.substring(0, 14)
    const hash = imageId.substring(14)

    if (prefix.startsWith('ab67616d')) return `https://i.scdn.co/image/ab67616d0000b273${hash}`
    if (prefix.startsWith('ab6742d3')) return `https://i.scdn.co/image/ab6742d30001be39${hash}`

    return url
  } catch {
    return url
  }
}

function getBaileysFns(sock) {
  const candidates = ['@whiskeysockets/baileys']
  for (const pkg of candidates) {
    try {
      const mod = require(pkg)
      const generateWAMessageFromContent = mod.generateWAMessageFromContent || mod.Utils?.generateWAMessageFromContent
      const prepareWAMessageMedia = mod.prepareWAMessageMedia || mod.Utils?.prepareWAMessageMedia
      const generateMessageIDV2 = mod.generateMessageIDV2 || mod.Utils?.generateMessageIDV2 || mod.generateMessageID || mod.Utils?.generateMessageID
      const isJidGroup = mod.isJidGroup || mod.WABinary?.isJidGroup

      if (generateWAMessageFromContent && prepareWAMessageMedia && sock.relayMessage) {
        return { generateWAMessageFromContent, prepareWAMessageMedia, generateMessageIDV2, isJidGroup }
      }
    } catch (_) {}
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
    header: mediaContent
      ? { title: '', hasMediaAttachment: true, ...mediaContent }
      : { title: '', hasMediaAttachment: false }
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

function isSpotifyUrl(text = '') {
  return /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|playlist)/i.test(text)
}

function getLocalFilePath(url) {
  const match = url.match(/\/tmp\/(.+)$/)
  if (!match) throw new Error('URL no contiene ruta /tmp/')
  const localPath = path.join('/Servidor/Web/public/tmp', match[1])
  if (!fs.existsSync(localPath)) throw new Error(`Archivo no encontrado: ${localPath}`)
  return localPath
}

function readLocalFile(url) {
  return fs.readFileSync(getLocalFilePath(url))
}

async function updateLog(sock, jid, logKey, newText) {
  try { await sock.sendMessage(jid, { text: newText, edit: logKey }) }
  catch (e) { console.warn('⚠️ No se pudo editar mensaje:', e.message) }
}

function formatNum(num) {
  if (!num) return '?'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return String(num)
}

export default async function (msg, sock, ctx) {
  const { info, args } = ctx
  const jid    = msg.key.remoteJid
  const apikey = info?.user?.apikey

  if (!apikey) {
    await sock.sendMessage(jid, { text: '⚠️ APIKEY no disponible' }, { quoted: msg })
    return true
  }

  if (!args.length) {
    await sendInteractiveWithImage(sock, jid, {
      bodyText:
        `🎵 *SPOTIFY BUSCADOR & DESCARGADOR*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📝 *Búsqueda:*\n\`.spotify snowfall\`\n\n` +
        `🔗 *Descarga directa:*\n\`.spotify https://open.spotify.com/track/...\``,
      footerText: 'OptiShield • Spotify',
      buttons: [
        {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: '🎵 Abrir Spotify',
            url: 'https://open.spotify.com'
          })
        }
      ],
      quotedMsg: msg
    })
    return true
  }

  const input = args.join(' ')

  if (isSpotifyUrl(input)) {
    await downloadSpotifyTrack(sock, jid, msg, input, apikey)
    return true
  }

  const query = args.join(' ')
  let logKey  = null

  try {
    const { key } = await sock.sendMessage(jid, { text: '⏳ Buscando...' }, { quoted: msg })
    logKey = key

    await updateLog(sock, jid, logKey, `🔍 Buscando *${query}* en Spotify...`)

    const searchData = await global.OptiShield.callApi('spotifySearch', { query, apikey })

    if (searchData.error) { await updateLog(sock, jid, logKey, `❌ ${searchData.error}`); return true }
    if (!searchData.result?.results?.length) { await updateLog(sock, jid, logKey, '❌ No se encontraron resultados'); return true }

    const results = searchData.result.results.slice(0, 10)
    await updateLog(sock, jid, logKey, `✅ ${results.length} canciones encontradas. Preparando lista...`)

    let menuText = `🎵 *Búsqueda Spotify:* ${query}\n`
    menuText += `📊 *Resultados:* ${results.length}\n\n`

    for (let i = 0; i < results.length; i++) {
      const t = results[i]
      const explicit = t.explicit ? '🅴 ' : ''
      menuText += `*${i + 1}.* ${explicit}${t.title.substring(0, 40)}\n`
      menuText += `   👤 ${t.artist.substring(0, 30)} • ⏱️ ${t.duration || '?:??'}\n\n`
    }

    menuText += `_Selecciona una canción para descargarla_`

    const rows = results.map((t) => {
      const explicit = t.explicit ? '🅴 ' : ''
      const titulo   = t.title.substring(0, 22)
      return {
        id: `.spotify ${t.spotify_url}`,
        title: `${explicit}🎵 ${titulo}${t.title.length > 22 ? '...' : ''}`,
        description: `👤 ${t.artist.substring(0, 30)} • ⏱️ ${t.duration || '?:??'}`
      }
    })

    await updateLog(sock, jid, logKey, `✅ Lista lista`)

    await sendInteractiveWithImage(sock, jid, {
      bodyText: menuText,
      imageUrl: await getHighResSpotify(results[0].thumbnail),
      footerText: `OptiShield • ${results.length} canciones`,
      buttons: [
        {
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '🎵 Seleccionar canción',
            sections: [{ title: '🎵 Canciones encontradas', rows }]
          })
        },
        {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: '🎵 Ver en Spotify',
            url: `https://open.spotify.com/search/${encodeURIComponent(query)}`
          })
        }
      ],
      quotedMsg: msg
    })

  } catch (e) {
    console.error('❌ spotify error:', e)
    if (logKey) await updateLog(sock, jid, logKey, '⚠️ Error procesando la búsqueda')
    else await sock.sendMessage(jid, { text: '⚠️ Error procesando la búsqueda' }, { quoted: msg })
  }

  return true
}

async function downloadSpotifyTrack(sock, jid, msg, url, apikey) {
  let logKey = null
  try {
    const { key } = await sock.sendMessage(jid, { text: '⏳ Validando enlace...' }, { quoted: msg })
    logKey = key

    await updateLog(sock, jid, logKey, '⬇️ Descargando de Spotify...')

    const dlData = await global.OptiShield.callApi('spotifydl', { url, apikey })

    if (dlData.error) { await updateLog(sock, jid, logKey, `❌ ${dlData.error}`); return }
    if (!dlData.result?.download) { await updateLog(sock, jid, logKey, '❌ No se pudo obtener el enlace de descarga'); return }

    const track = dlData.result
    await updateLog(sock, jid, logKey, '📦 Preparando audio...')

    const audioBuffer = readLocalFile(track.download)
    await updateLog(sock, jid, logKey, '📤 Enviando audio...')

    await sock.sendMessage(jid, {
      audio: audioBuffer,
      mimetype: 'audio/mpeg',
      ptt: false,
      fileName: `${track.title} - ${track.artist}.mp3`
    }, { quoted: msg })

    await updateLog(sock, jid, logKey, '✅ Audio enviado correctamente')
    console.log(`✅ Spotify descargado: ${track.title}`)

  } catch (e) {
    console.error('❌ downloadSpotifyTrack error:', e)
    if (logKey) await updateLog(sock, jid, logKey, `⚠️ Error: ${e.message}`)
    else await sock.sendMessage(jid, { text: '⚠️ Error descargando. Intenta de nuevo.' }, { quoted: msg })
  }
}
