import { createRequire } from 'module'
import { spawn } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { unlink } from 'fs/promises'
import { randomBytes } from 'crypto'

const require = createRequire(import.meta.url)

export const meta = {
  name: 'tiktok',
  commands: ['tiktok', 'tt', 'ttdl', 'tiktokdl', 'tt_video', 'tt_audio'],
  priority: 3,
  premium: true,
  class: 'Descargadores',
}

const TT_REGEX = /tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com/i
const URL_REGEX = /^https?:\/\//i
const MAX_TITLE = 80

const isTikTokUrl = (url = '') => TT_REGEX.test(url)
const isUrl = (url = '') => URL_REGEX.test(url)
const clamp = (str, n) => str?.length > n ? str.slice(0, n) + '...' : str

function bar(step, total = 4) {
  const pct = Math.round((step / total) * 100)
  const filled = Math.round((step / total) * 12)
  const track = '▰'.repeat(filled) + '▱'.repeat(12 - filled)
  return `${track} ${pct}%`
}

async function log(sock, jid, key, text) {
  try { await sock.sendMessage(jid, { text, edit: key }) } catch (_) {}
}

function extractAudio(videoUrl) {
  return new Promise((resolve, reject) => {
    const out = join(tmpdir(), `tt_${randomBytes(6).toString('hex')}.mp3`)
    const ff = spawn('ffmpeg', [
      '-y', '-i', videoUrl,
      '-vn', '-acodec', 'libmp3lame',
      '-b:a', '192k', '-ar', '44100',
      '-threads', '2',
      out
    ])
    let stderr = ''
    ff.stderr.on('data', d => { stderr += d })
    ff.on('close', code => code === 0 ? resolve(out) : reject(new Error(`ffmpeg: ${stderr.slice(-300)}`)))
    ff.on('error', reject)
  })
}

function buildInteractive(videoUrl, audioUrl, originalUrl) {
  return [
    {
      name: 'single_select',
      buttonParamsJson: JSON.stringify({
        title: '📥 Elegir formato',
        sections: [
          {
            title: '🎬 Opciones de descarga',
            rows: [
              { id: `.tt_video ${videoUrl}`, title: '🎬 Video', description: 'Descargar el video completo' },
              { id: `.tt_audio ${audioUrl || videoUrl}`, title: '🎵 Solo Audio (MP3)', description: 'Extraer solo el audio en MP3' }
            ]
          }
        ]
      })
    },
    {
      name: 'cta_url',
      buttonParamsJson: JSON.stringify({
        display_text: '🔗 Ver en TikTok',
        url: originalUrl,
        merchant_url: originalUrl
      })
    }
  ]
}

// --- FUNCIONES NATIVAS DE BAILEYS (Sin gifted-btns) ---
function getBaileysFns(sock) {
  const candidates = ['baileys', '@whiskeysockets/baileys', '@adiwajshing/baileys']
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
// ------------------------------------------------

async function handleVideo(msg, sock, ctx) {
  const jid = msg.key.remoteJid
  const url = (ctx.body || ctx.args?.join(' ') || '').trim()
  if (!url) return true

  const { key: logKey } = await sock.sendMessage(jid, { text: `🎬 *Preparando video...*\n\n${bar(2)}` }, { quoted: msg })
  try {
    await sock.sendMessage(jid, { video: { url }, caption: `✅ *Video descargado*\n━━━━━━━━━━━━━━━\n_Potenciado por OptiShield_` }, { quoted: msg })
    await log(sock, jid, logKey, `${bar(4)}\n\n✅ ¡Video enviado!`)
  } catch (err) {
    await log(sock, jid, logKey, `❌ Error al enviar el video\n\n_${err.message}_`)
  }
  return true
}

async function handleImages(msg, sock, ctx) {
  const jid = msg.key.remoteJid
  const { files, audioUrl, title, author, originalUrl } = ctx
  const { key: logKey } = await sock.sendMessage(jid, { text: `🖼️ *Enviando imagenes...*\n\n${bar(1)}` }, { quoted: msg })

  try {
    for (let i = 0; i < files.length; i++) {
      await log(sock, jid, logKey, `🖼️ Enviando imagen ${i + 1} de ${files.length}...\n\n${bar(Math.round(((i + 1) / files.length) * 3))}`)
      await sock.sendMessage(jid, {
        image: { url: files[i] },
        caption: i === 0 ? `🖼️ *${title}*\n${author ? `👤 ${author}` : ''}` : `🖼️ ${i + 1} / ${files.length}`
      }, { quoted: msg })
    }

    if (audioUrl) {
      try {
        await sendInteractiveWithImage(sock, jid, {
          bodyText: `✅ *${files.length} imagen(es) enviada(s)*\n_¿También quieres el audio?_`,
          footerText: 'OptiShield • TikTok DL',
          buttons: [
            {
              name: 'single_select',
              buttonParamsJson: JSON.stringify({
                title: '🎵 ¿Quieres el audio?',
                sections: [{ title: '🎵 Audio disponible', rows: [{ id: `.tt_audio ${audioUrl}`, title: '🎵 Descargar Audio (MP3)', description: 'Extraer el audio de este TikTok' }] }]
              })
            },
            { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '🔗 Ver en TikTok', url: originalUrl, merchant_url: originalUrl }) }
          ],
          quotedMsg: msg
        })
      } catch {
        await sock.sendMessage(jid, { text: `✅ Imagenes enviadas\n*Audio disponible:*\n.tt_audio ${audioUrl}` }, { quoted: msg })
      }
    }
    await log(sock, jid, logKey, `${bar(4)}\n\n✅ ¡${files.length} imagen(es) enviada(s)!`)
  } catch (err) {
    await log(sock, jid, logKey, `❌ Error al enviar imagenes\n\n_${err.message}_`)
  }
  return true
}

async function handleAudio(msg, sock, ctx) {
  const jid = msg.key.remoteJid
  const url = (ctx.body || ctx.args?.join(' ') || '').trim()
  if (!url) return true
  const { key: logKey } = await sock.sendMessage(jid, { text: `🎵 *Extrayendo audio...*\n\n${bar(1)}` }, { quoted: msg })
  let audioPath = null
  try {
    await log(sock, jid, logKey, `🎙️ Convirtiendo a MP3...\n\n${bar(2)}`)
    audioPath = await extractAudio(url)
    await log(sock, jid, logKey, `📤 Enviando audio...\n\n${bar(3)}`)
    await sock.sendMessage(jid, { audio: { url: `${audioPath}` }, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg })
    await log(sock, jid, logKey, `${bar(4)}\n\n✅ ¡Audio MP3 listo!`)
  } catch (err) {
    await log(sock, jid, logKey, `❌ Error al extraer audio\n\n_${err.message}_`)
  } finally {
    if (audioPath) unlink(audioPath).catch(() => {})
  }
  return true
}

async function handleMain(msg, sock, ctx) {
  const { args, info } = ctx
  const jid = msg.key.remoteJid
  const apikey = info?.user?.apikey
  const url = args.join(' ').trim()

  if (!url || !isUrl(url)) {
    await sock.sendMessage(jid, {
      text: `╔═══════════════════╗\n║  🎵 TikTok DL    ║\n╚═══════════════════╝\n\n❌ Necesitas enviar un link valido\n\n*Uso:*\n› \`.tt https://vm.tiktok.com/xxx\`\n› \`.tt https://www.tiktok.com/@user/video/xxx\``
    }, { quoted: msg })
    return true
  }

  if (!isTikTokUrl(url)) {
    await sock.sendMessage(jid, { text: `❌ El link no es de TikTok\n\n*Dominios validos:*\n• tiktok.com\n• vm.tiktok.com\n• vt.tiktok.com` }, { quoted: msg })
    return true
  }

  const { key: logKey } = await sock.sendMessage(jid, { text: `⏳ *Analizando link...*\n\n${bar(0)}` }, { quoted: msg })

  try {
    await log(sock, jid, logKey, `🔗 Obteniendo informacion...\n\n${bar(1)}`)
    const res = await global.OptiShield.callApi('tiktokdl', { url, apikey })
    const result = res?.result

    if (!result?.success || res?.error) {
      await log(sock, jid, logKey, `❌ ${res?.error || 'No se pudo procesar el video'}\n\n💡 Verifica que el link sea publico y valido`)
      return true
    }

    const rawType = result.type || ''
    const videoUrl = result.file
    const audioUrl = result.audio
    const files = result.files || []
    const infoData = result.info || {} // Corregido: 'meta' causaba conflicto con export const meta
    const title = clamp(infoData.title || 'TikTok Video', MAX_TITLE)
    const author = infoData.author || infoData.username || ''
    const thumbnail = infoData.thumbnail || infoData.cover || null // Extracción del thumbnail
    const likes = infoData.likes ? `❤️ ${Number(infoData.likes).toLocaleString()}  ` : ''
    const views = infoData.views ? `👁️ ${Number(infoData.views).toLocaleString()}` : ''

    const isImages = (
      rawType === 'images' || rawType === 'image' || rawType === 'photos' ||
      rawType === 'photo' || rawType === 'gallery' || rawType === 'slide' ||
      (files.length > 0 && !videoUrl)
    )

    if (isImages && files.length > 0) {
      await log(sock, jid, logKey, `🖼️ *${title}*\n${author ? `👤 ${author}\n` : ''}\n\n${bar(2)}\n\n🖼️ Carrusel de ${files.length} imagen(es) detectado...`)
      return handleImages(msg, sock, { files, audioUrl, title, author, originalUrl: url })
    }

    if (!videoUrl) {
      await log(sock, jid, logKey, `❌ No se recibio link de descarga`)
      return true
    }

    await log(sock, jid, logKey, `🎵 *${title}*\n${author ? `👤 ${author}\n` : ''}${likes || views ? `\n${likes}${views}\n` : ''}\n\n${bar(3)}\n\n🎬 Preparando opciones...`)

    const body =
      `🎵 *${title}*\n` +
      `${author ? `👤 ${author}\n` : ''}` +
      `${likes ? `${likes}` : ''}` +
      `${views ? `${views}\n` : ''}` +
      `\n_Elige como quieres el contenido:_`

    try {
      // MENÚ INTERACTIVO CON LA IMAGEN DEL VIDEO ARRIBA
      await sendInteractiveWithImage(sock, jid, {
        imageUrl: thumbnail, // Se muestra la portada del video de TikTok
        bodyText: body,
        footerText: 'OptiShield • TikTok DL',
        buttons: buildInteractive(videoUrl, audioUrl, url),
        quotedMsg: msg
      })
    } catch (interactiveErr) {
      console.warn('[TikTok] interactivo fallo:', interactiveErr.message)
      const authorLine = author ? '👤 ' + author + '\n' : ''
      await sock.sendMessage(jid, {
        text: '🎬 *TikTok Downloader*\n━━━━━━━━━━━━━━━━━━━━━\n🎵 *' + title + '*\n' + authorLine + '\n*Usa estos comandos:*\n.tt_video ' + videoUrl + '\n.tt_audio ' + (audioUrl || videoUrl)
      }, { quoted: msg })
    }

    await log(sock, jid, logKey, `🎵 *${title}*\n${author ? `👤 ${author}\n` : ''}\n\n${bar(4)}\n\n✅ ¡Selecciona una opcion!`)

  } catch (err) {
    console.error('[TikTok]', err.message)
    await log(sock, jid, logKey, `❌ Error inesperado\n\n_${err.message}_\n\n💡 Intenta de nuevo en unos segundos`)
  }
  return true
}

export default async function handler(msg, sock, ctx) {
  switch (ctx.command) {
    case 'tt_video': return handleVideo(msg, sock, ctx)
    case 'tt_audio': return handleAudio(msg, sock, ctx)
    default: return handleMain(msg, sock, ctx)
  }
}
