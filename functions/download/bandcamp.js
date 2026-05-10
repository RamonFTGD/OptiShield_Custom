import https from 'https'
import http from 'http'
import sharp from 'sharp'

export const meta = {
  name: 'bandcamp',
  commands: ['bandcamp', 'bc', 'bcdl'],
  priority: 3,
  premium: true,
  class: 'Descargadores',
}

function progressBar(step, total = 5) {
  const filled = Math.round((step / total) * 10)
  const empty = 10 - filled
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${Math.round((step / total) * 100)}%`
}

function updateLog(sock, chatId, logKey, text) {
  if (logKey) sock.sendMessage(chatId, { text, edit: logKey }).catch(() => {})
}

function fetchBuffer(url, maxBytes = 500 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, { timeout: 60_000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return fetchBuffer(res.headers.location, maxBytes).then(resolve).catch(reject)
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      const chunks = []
      let total = 0
      res.on('data', chunk => {
        total += chunk.length
        if (total > maxBytes) { res.destroy(); return reject(new Error('Archivo demasiado grande')) }
        chunks.push(chunk)
      })
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

async function fetchThumbnail(url) {
  if (!url) return null
  try {
    const raw = await fetchBuffer(url, 5 * 1024 * 1024)
    return await sharp(raw).resize(320, 320, { fit: 'cover', position: 'centre' }).jpeg({ quality: 70 }).toBuffer()
  } catch { return null }
}

export default async function (msg, sock, ctx) {
  const { text, info } = ctx
  const chatId = msg.key.remoteJid
  const apikey = info?.user?.apikey
  const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: msg })

  if (!apikey) return reply('▸ APIKEY no disponible.')

  const query = text.trim()
  if (!query) return reply('▸ Envía un enlace de Bandcamp o un término de búsqueda.\n\n• .bc canción\n• .bc https://artist.bandcamp.com/track/...')

  const isUrl = /^https?:\/\/.+bandcamp\.com/i.test(query)
  let logKey = null

  try {
    const { key } = await reply(`${isUrl ? 'Procesando enlace...' : 'Buscando en Bandcamp...'}\n\n${progressBar(0)}`)
    logKey = key

    let trackUrl = null, trackTitle = '', trackArtist = '', trackArtwork = null

    if (!isUrl) {
      updateLog(sock, chatId, logKey, `Buscando: ${query}\n\n${progressBar(1)}`)

      const search = await global.OptiShield.callApi('bandcamp-search', { q: query, limit: '1', apikey })
      if (search.error || !search?.result?.results?.length) {
        await updateLog(sock, chatId, logKey, '▸ No se encontraron resultados.')
        return true
      }

      const first = search.result.results[0]
      trackUrl = first.url?.replace(/&amp;/g, '&')
      trackTitle = first.title
      trackArtist = first.artist?.replace(/^by\s*/i, '').trim()
      trackArtwork = first.artwork
    } else {
      trackUrl = query
    }

    await updateLog(sock, chatId, logKey, `${trackTitle ? `${trackTitle} - ${trackArtist}\n` : 'Descargando...\n'}${progressBar(2)}`)

    const dl = await global.OptiShield.callApi('bandcamp-dl', { url: trackUrl, apikey })
    if (dl.error || !dl?.result?.url) {
      await updateLog(sock, chatId, logKey, `▸ ${dl.error || 'No se pudo descargar. Asegúrate de que el link sea válido y el track gratuito.'}`)
      return true
    }

    const result = dl.result
    trackTitle = result.title || trackTitle || 'Bandcamp Track'
    trackArtist = result.artist || trackArtist || ''
    const album = result.album || ''
    trackArtwork = result.artwork || trackArtwork

    await updateLog(sock, chatId, logKey, `${trackTitle} - ${trackArtist}\n\n${progressBar(3)}`)

    const audioBuffer = await fetchBuffer(result.url)
    await updateLog(sock, chatId, logKey, `${trackTitle} - ${trackArtist}\n\n${progressBar(4)}`)

    const thumbBuffer = await fetchThumbnail(trackArtwork)

    const safeTitle = trackTitle.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\\/:*?"<>|]/g, '').replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim().substring(0, 100) || 'Bandcamp Track'

    await sock.sendMessage(chatId, {
      document: audioBuffer,
      mimetype: 'audio/mpeg',
      fileName: `${safeTitle}.mp3`,
      ...(thumbBuffer ? { jpegThumbnail: thumbBuffer } : {}),
    }, { quoted: msg })

    await updateLog(sock, chatId, logKey, `${trackTitle} - ${trackArtist}${album ? `\nDisco: ${album}` : ''}\n\n${progressBar(5)}\n\nDescarga completa.`)

  } catch (err) {
    if (logKey) {
      await updateLog(sock, chatId, logKey, `▸ Error: ${err.message}`)
    } else {
      await reply(`▸ Error: ${err.message}`)
    }
  }

  return true
}
