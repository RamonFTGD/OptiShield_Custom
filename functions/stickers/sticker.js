import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { exec } from 'child_process'
import { randomUUID } from 'crypto'
import { downloadContentFromMessage } from '@whiskeysockets/baileys'
import { addExif } from '../../lib/sticker.js'

export const meta = {
  name: 'sticker',
  commands: ['sticker', 's', 'stiker'],
  priority: 4,
  class: 'Herramientas',
}

const PACK_CONFIG = {
  id: 'optishield-ofc',
  name: '꧁ O P T I S H I E L D ꧂',
  author: '✧ Ramón Luna ✧',
  categories: ['☠️'],
}

// ─── Configuración de marca de agua ─────────────────────────────────────────
const WATERMARK = {
  path: path.resolve('../lib/image.png'),
  size: 64,           // tamaño en px (se ajusta proporcionalmente)
  padding: 2,        // margen desde el borde
  opacity: 0.80,      // opacidad (0 a 1)
  position: 'bottom-right', // 'bottom-right' o 'bottom-left'
}

// ─── Verificar existencia de marca de agua ───────────────────────────────────
const hasWatermark = fs.existsSync(WATERMARK.path)
if (!hasWatermark) {
  console.warn('⚠️ Marca de agua no encontrada en:', WATERMARK.path)
}

// ─── Obtener marca de agua redimensionada ────────────────────────────────────
async function getWatermarkBuffer() {
  if (!hasWatermark) return null
  try {
    return await sharp(WATERMARK.path)
      .resize(WATERMARK.size, WATERMARK.size, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .ensureAlpha(WATERMARK.opacity * 255)
      .png()
      .toBuffer()
  } catch (err) {
    console.warn('⚠️ Error al procesar marca de agua:', err.message)
    return null
  }
}

// ─── Calcular posición de overlay para sharp ─────────────────────────────────
function getWatermarkPosition(mainWidth, mainHeight, wmWidth, wmHeight) {
  const pad = WATERMARK.padding
  if (WATERMARK.position === 'bottom-left') {
    return { left: pad, top: mainHeight - wmHeight - pad }
  }
  // bottom-right por defecto
  return { left: mainWidth - wmWidth - pad, top: mainHeight - wmHeight - pad }
}

async function stampExif(webpBuffer) {
  try {
    return await addExif(
      webpBuffer,
      PACK_CONFIG.name,
      PACK_CONFIG.author,
      PACK_CONFIG.categories,
      {},
      PACK_CONFIG.id
    )
  } catch (err) {
    console.warn('⚠️ Error al agregar EXIF al sticker:', err.message)
    return webpBuffer
  }
}

const TMP = path.resolve('./tmp')
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true })

async function downloadMedia(message, type) {
  const stream = await downloadContentFromMessage(message, type)
  let buffer = Buffer.alloc(0)
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk])
  }
  return buffer
}

async function downloadFromUrl(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Error al descargar: ${response.statusText}`)
  return Buffer.from(await response.arrayBuffer())
}

function getQuoted(msg) {
  const m = msg.message
  if (!m) return null
  const type = Object.keys(m)[0]
  const content = m[type]
  if (!content?.contextInfo?.quotedMessage) return null
  const qType = Object.keys(content.contextInfo.quotedMessage)[0]
  return {
    type: qType,
    message: content.contextInfo.quotedMessage[qType],
  }
}

function isValidUrl(string) {
  try {
    const url = new URL(string)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function getMediaTypeFromUrl(url) {
  const urlLower = url.toLowerCase()
  if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) return 'image'
  if (urlLower.match(/\.(mp4|mov|avi|webm|mkv|gif)$/i)) return 'video'
  if (urlLower.includes('pinimg.com') || urlLower.includes('pinterest.com')) return 'image'
  return 'image'
}

function isAnimatedSticker(stickerMessage) {
  return stickerMessage?.isAnimated === true
}

function normalizeMediaType(type, message) {
  if (
    type === 'viewOnceMessage' ||
    type === 'viewOnceMessageV2' ||
    type === 'viewOnceMessageV2Extension'
  ) {
    const innerMessage = message?.message
    if (innerMessage) {
      const innerType = Object.keys(innerMessage)[0]
      return { type: innerType, message: innerMessage[innerType] }
    }
  }
  return { type, message }
}

// ─── Obtener duración de un video ─────────────────────────────────────────────
function getVideoDuration(inputPath) {
  return new Promise((resolve, reject) => {
    exec(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`,
      (err, stdout) => {
        if (err) reject(err)
        else resolve(parseFloat(stdout.trim()) || 0)
      }
    )
  })
}

// ─── Ejecutar ffmpeg y devolver tamaño resultante ─────────────────────────────
function runFfmpeg(cmd, outputPath) {
  return new Promise((resolve) => {
    exec(cmd, (err, _, stderr) => {
      if (err) {
        console.warn('   ⚠️ ffmpeg error:', stderr?.slice(0, 120))
        resolve(Infinity)
        return
      }
      if (fs.existsSync(outputPath)) {
        resolve(fs.statSync(outputPath).size)
      } else {
        resolve(Infinity)
      }
    })
  })
}

// ─── Generar filtro de overlay para ffmpeg ────────────────────────────────────
function buildOverlayFilter(wmPath) {
  if (!wmPath) return ''
  
  const pad = WATERMARK.padding
  const x = WATERMARK.position === 'bottom-left' ? pad : `W-w-${pad}`
  const y = `H-h-${pad}`
  
  // Escalar marca de agua al tamaño configurado y aplicar opacidad
  return (
    `[1:v]scale=${WATERMARK.size}:${WATERMARK.size}:force_original_aspect_ratio=decrease,` +
    `format=rgba,colorchannelmixer=aa=${WATERMARK.opacity}[wm];` +
    `[base][wm]overlay=${x}:${y}`
  )
}

// ─── Convierte un segmento de video → WebP animado ────────────────────────────
async function convertSegmentToWebp(inputPath, outputPath, startSec, durationSec) {
  const MAX_SIZE = 900 * 1024
  const wmPath = hasWatermark ? WATERMARK.path : null

  let bestBuffer = null
  let bestSize = Infinity

  const clean = () => {
    try {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
    } catch {}
  }

  const buildCmd = ({
    size = 512,
    fps = 30,
    quality = 85,
    compression = 6,
    dur = durationSec,
    start = startSec,
  }) => {
    const scaleFilter = `scale=${size}:${size}:force_original_aspect_ratio=increase,crop=${size}:${size},fps=${fps}`
    
    let cmd = `ffmpeg -y -ss ${start} -t ${dur} -i "${inputPath}" `
    
    // Agregar marca de agua como segundo input
    if (wmPath) {
      cmd += `-i "${wmPath}" `
    }
    
    if (wmPath) {
      const overlayFilter = buildOverlayFilter(wmPath)
      cmd += `-filter_complex "[0:v]${scaleFilter}[base];${overlayFilter}" `
    } else {
      cmd += `-vf "${scaleFilter}" `
    }
    
    cmd += `-c:v libwebp -preset default -loop 0 -an -vsync 0 `
    cmd += `-quality ${quality} -compression_level ${compression} `
    cmd += `"${outputPath}"`
    
    return cmd
  }

  const attempt = async (label, opts) => {
    clean()
    const fileSize = await runFfmpeg(buildCmd(opts), outputPath)
    const sizeStr = fileSize === Infinity ? 'ERROR' : `${(fileSize / 1024).toFixed(1)} KB`
    console.log(`   📊 [${label}] → ${sizeStr}`)
    if (fileSize < bestSize) {
      bestSize = fileSize
      bestBuffer = fs.existsSync(outputPath) ? fs.readFileSync(outputPath) : null
    }
    return fileSize
  }

  const runPhases = async (start, dur) => {
    const tag = dur < durationSec ? `[${dur.toFixed(1)}s] ` : ''

    // FASE 1
    console.log(`🔧 ${tag}FASE 1: compression_level 1→6 (quality=85, fps=30, res=512)`)
    for (let comp = 1; comp <= 1; comp++) {
      const s = await attempt(`${tag}comp=${comp}`, { compression: comp, dur, start })
      if (s < MAX_SIZE) {
        console.log(`   ✅ FASE 1 OK — comp=${comp}`)
        return true
      }
    }

    // FASE 2
    console.log(`🔧 ${tag}FASE 2: bajar resolución (quality=85, fps=30, comp=6)`)
    for (const res of [448, 384, 320, 256]) {
      const s = await attempt(`${tag}res=${res}`, { size: res, dur, start })
      if (s < MAX_SIZE) {
        console.log(`   ✅ FASE 2 OK — res=${res}`)
        return true
      }
    }

    // FASE 3
    console.log(`🔧 ${tag}FASE 3: bajar quality 80→1 (res=256, fps=30, comp=6)`)
    for (let q = 80; q >= 1; q -= 5) {
      const actualQ = Math.max(1, q)
      const s = await attempt(`${tag}quality=${actualQ}`, {
        size: 256,
        quality: actualQ,
        dur,
        start,
      })
      if (s < MAX_SIZE) {
        console.log(`   ✅ FASE 3 OK — quality=${actualQ}`)
        return true
      }
    }

    // FASE 4
    console.log(`🔧 ${tag}FASE 4: bajar FPS 28→20 (quality=1, res=256, comp=6)`)
    for (let fps = 28; fps >= 20; fps -= 2) {
      const s = await attempt(`${tag}fps=${fps}`, {
        size: 256,
        quality: 1,
        fps,
        dur,
        start,
      })
      if (s < MAX_SIZE) {
        console.log(`   ✅ FASE 4 OK — fps=${fps}`)
        return true
      }
    }

    return false
  }

  if (await runPhases(startSec, durationSec)) return bestBuffer

  if (durationSec > 8) {
    console.log('🔧 FASE 5: recortando a 8s y reintentando fases 1-4')
    if (await runPhases(startSec, 8)) return bestBuffer
  }

  if (bestBuffer) {
    console.warn(
      `⚠️ Sin solución <900KB (mejor: ${(bestSize / 1024).toFixed(1)} KB), enviando de todas formas`
    )
    return bestBuffer
  }
  return null
}

// ─── Procesar imagen con marca de agua usando sharp ───────────────────────────
async function processImageWithWatermark(inputPath, outputPath) {
  const wmBuffer = await getWatermarkBuffer()
  
  const pipeline = sharp(inputPath)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })

  if (wmBuffer) {
    const wmMeta = await sharp(wmBuffer).metadata()
    const wmW = wmMeta.width
    const wmH = wmMeta.height
    const pos = getWatermarkPosition(512, 512, wmW, wmH)
    
    console.log(`💧 Marca de agua aplicada en: ${WATERMARK.position} (${wmW}x${wmH}px)`)
    
    await pipeline
      .composite([
        {
          input: wmBuffer,
          ...pos,
        },
      ])
      .webp({ quality: 90 })
      .toFile(outputPath)
  } else {
    await pipeline
      .webp({ quality: 90 })
      .toFile(outputPath)
  }

  return fs.existsSync(outputPath)
}

/* ───────── PLUGIN ───────── */
export default async function (msg, sock, ctx) {
  const chatId = msg.key.remoteJid
  let mediaType = null
  let mediaMessage = null
  let urlProvided = null
  let searchQuery = null

  const args = ctx.args.join(' ').trim()

  if (args && isValidUrl(args)) {
    urlProvided = args
    mediaType = getMediaTypeFromUrl(args)
  } else if (args) {
    searchQuery = args
  } else {
    const quoted = getQuoted(msg)
    if (quoted) {
      const normalized = normalizeMediaType(quoted.type, quoted.message)
      mediaType = normalized.type
      mediaMessage = normalized.message
    } else {
      const type = Object.keys(msg.message || {})[0]
      const content = msg.message[type]
      const normalized = normalizeMediaType(type, content)
      mediaType = normalized.type
      mediaMessage = normalized.message

      const supportedTypes = [
        'imageMessage',
        'videoMessage',
        'stickerMessage',
        'gifMessage',
        'videoNoteMessage',
      ]

      if (!supportedTypes.includes(mediaType)) {
        mediaType = null
        mediaMessage = null
      }
    }
  }

  // ── BÚSQUEDA EN PINTEREST ──────────────────────────────────────────────────
  if (searchQuery) {
    try {
      await sock.sendMessage(
        chatId,
        { text: `🔍 Buscando "${searchQuery}"` },
        { quoted: msg }
      )

      const pinterestResult = await global.OptiShield.callApi('pinterestSearch', {
        query: searchQuery,
      })

      if (!pinterestResult?.result?.ok || !pinterestResult.result.results?.length) {
        await sock.sendMessage(
          chatId,
          { text: `❌ No se encontraron resultados para "${searchQuery}"` },
          { quoted: msg }
        )
        return true
      }

      const results = pinterestResult.result.results
      const shuffledResults = [...results].sort(() => Math.random() - 0.5)
      const selectedResults = shuffledResults.slice(0, Math.min(6, shuffledResults.length))

      for (const result of selectedResults) {
        const resUrl = result.archivo
        const id = randomUUID()
        const input = path.join(TMP, `${id}.input`)
        const output = path.join(TMP, `${id}.webp`)

        try {
          const buffer = await downloadFromUrl(resUrl)
          fs.writeFileSync(input, buffer)

          const isVideo =
            buffer[0] === 0x00 &&
            buffer[1] === 0x00 &&
            buffer[2] === 0x00 &&
            (buffer[3] === 0x18 || buffer[3] === 0x20 || buffer[3] === 0x1c)
          const actualType = isVideo ? 'video' : 'image'

          if (actualType === 'image') {
            await processImageWithWatermark(input, output)

            if (fs.existsSync(output)) {
              const finalSticker = await stampExif(fs.readFileSync(output))
              await sock.sendMessage(chatId, { sticker: finalSticker }, { quoted: msg })
            }
          } else {
            const duration = await getVideoDuration(input)
            const SEGMENT_DURATION = 15

            if (duration <= SEGMENT_DURATION) {
              const webpBuf = await convertSegmentToWebp(
                input,
                output,
                0,
                Math.min(duration, SEGMENT_DURATION)
              )
              if (webpBuf) {
                const finalSticker = await stampExif(webpBuf)
                await sock.sendMessage(chatId, { sticker: finalSticker }, { quoted: msg })
              }
            } else {
              console.log(
                `✂️ Video largo (${duration.toFixed(1)}s) — partiendo en segmentos de ${SEGMENT_DURATION}s`
              )
              const totalSegments = Math.ceil(duration / SEGMENT_DURATION)
              await sock.sendMessage(
                chatId,
                {
                  text: `⚙️ Video de ${duration.toFixed(0)}s — generando ${totalSegments} stickers...`,
                },
                { quoted: msg }
              )

              for (let seg = 0; seg < totalSegments; seg++) {
                const start = seg * SEGMENT_DURATION
                const segDur = Math.min(SEGMENT_DURATION, duration - start)
                const segOut = path.join(TMP, `${id}_seg${seg}.webp`)

                console.log(
                  `🎬 Segmento ${seg + 1}/${totalSegments}: ${start}s → ${start + segDur}s`
                )

                const webpBuf = await convertSegmentToWebp(input, segOut, start, segDur)
                if (webpBuf) {
                  const finalSticker = await stampExif(webpBuf)
                  await sock.sendMessage(chatId, { sticker: finalSticker }, { quoted: msg })
                  await new Promise((r) => setTimeout(r, 500))
                }

                try {
                  if (fs.existsSync(segOut)) fs.unlinkSync(segOut)
                } catch {}
              }
            }
          }
        } catch (err) {
          console.error('❌ Error procesando sticker Pinterest:', err)
        } finally {
          try {
            if (fs.existsSync(input)) fs.unlinkSync(input)
            if (fs.existsSync(output)) fs.unlinkSync(output)
          } catch {}
        }
      }

      return true
    } catch (err) {
      console.error('❌ PINTEREST SEARCH ERROR:', err)
      await sock.sendMessage(
        chatId,
        { text: '❌ Error al buscar en Pinterest: ' + err.message },
        { quoted: msg }
      )
      return true
    }
  }

  // ── SIN MEDIA ─────────────────────────────────────────────────────────────
  if (!mediaMessage && !urlProvided) {
    await sock.sendMessage(
      chatId,
      {
        text:
          '╔═════════════════════════════╗\n' +
          '║   🛡️  O P T I S H I E L D      ║\n' +
          '║         Sticker Maker           ║\n' +
          '╠═════════════════════════════╣\n' +
          '║  ❌ No se detectó contenido     ║\n' +
          '╠═════════════════════════════╣\n' +
          '║  • Responde a imagen/video/gif  ║\n' +
          '║  • *.sticker <url>*             ║\n' +
          '║  • *.sticker gatos lindos*      ║\n' +
          '║    (busca en Pinterest)         ║\n' +
          '╚═════════════════════════════╝',
      },
      { quoted: msg }
    )
    return true
  }

  const id = randomUUID()
  const input = path.join(TMP, `${id}.input`)
  const output = path.join(TMP, `${id}.webp`)

  try {
    await sock.sendMessage(
      chatId,
      {
        text:
          '╔═════════════════════════════╗\n' +
          '║   🛡️  O P T I S H I E L D      ║\n' +
          '║       ⏳ Creando sticker...     ║\n' +
          '╚═════════════════════════════╝',
      },
      { quoted: msg }
    )

    let buffer

    if (urlProvided) {
      buffer = await downloadFromUrl(urlProvided)
    } else {
      let downloadType = mediaType.replace('Message', '')
      if (mediaType === 'videoNoteMessage') downloadType = 'ptt'
      if (mediaType === 'gifMessage') downloadType = 'video'
      buffer = await downloadMedia(mediaMessage, downloadType)
    }

    fs.writeFileSync(input, buffer)
    console.log('📥 Descargado:', input, '| Tamaño:', buffer.length, 'bytes')

    // ── Detectar tipo real ────────────────────────────────────────────────
    let actualType = mediaType

    if (actualType === 'stickerMessage') {
      actualType = isAnimatedSticker(mediaMessage) ? 'video' : 'image'
    }
    if (actualType === 'gifMessage' || actualType === 'videoNoteMessage') {
      actualType = 'video'
    }
    if (urlProvided) {
      const isVideo =
        buffer[0] === 0x00 &&
        buffer[1] === 0x00 &&
        buffer[2] === 0x00 &&
        (buffer[3] === 0x18 || buffer[3] === 0x20 || buffer[3] === 0x1c)
      actualType = isVideo ? 'video' : 'image'
    }

    console.log('🔍 Tipo final:', actualType)

    // ── IMAGEN ────────────────────────────────────────────────────────────
    if (actualType === 'image' || actualType === 'imageMessage') {
      console.log('🖼️ Procesando imagen...')
      const success = await processImageWithWatermark(input, output)

      if (!success) throw new Error('No se creó el archivo de salida')

      const finalSticker = await stampExif(fs.readFileSync(output))
      await sock.sendMessage(chatId, { sticker: finalSticker }, { quoted: msg })

      console.log(
        `   🛡️ Sticker enviado — Pack: ${PACK_CONFIG.name} | Author: ${PACK_CONFIG.author} | ID: ${PACK_CONFIG.id}`
      )

    // ── VIDEO / GIF ───────────────────────────────────────────────────────
    } else if (actualType === 'video' || actualType === 'videoMessage') {
      console.log('🎬 Procesando video...')

      const duration = await getVideoDuration(input)
      console.log(`⏱️ Duración: ${duration.toFixed(2)}s`)

      const SEGMENT_DURATION = 15

      if (duration <= SEGMENT_DURATION) {
        console.log('✅ Video corto — convirtiendo directamente')
        const webpBuf = await convertSegmentToWebp(input, output, 0, duration)
        if (!webpBuf) throw new Error('No se pudo convertir el video a WebP')

        const finalSticker = await stampExif(webpBuf)
        await sock.sendMessage(chatId, { sticker: finalSticker }, { quoted: msg })

        console.log(
          `   🛡️ Sticker enviado — Pack: ${PACK_CONFIG.name} | Author: ${PACK_CONFIG.author} | ID: ${PACK_CONFIG.id}`
        )

      } else {
        const totalSegments = Math.ceil(duration / SEGMENT_DURATION)
        console.log(
          `✂️ Video largo (${duration.toFixed(1)}s) → ${totalSegments} segmentos de ${SEGMENT_DURATION}s`
        )

        await sock.sendMessage(
          chatId,
          {
            text:
              '╔═════════════════════════════╗\n' +
              '║   🛡️  O P T I S H I E L D      ║\n' +
              `║  ⚙️ ${totalSegments} stickers de ${SEGMENT_DURATION}s         ║\n` +
              '║  ⏳ Enviando uno por uno...      ║\n' +
              '╚═════════════════════════════╝',
          },
          { quoted: msg }
        )

        for (let seg = 0; seg < totalSegments; seg++) {
          const start = seg * SEGMENT_DURATION
          const segDur = Math.min(SEGMENT_DURATION, duration - start)
          const segOut = path.join(TMP, `${id}_seg${seg}.webp`)

          console.log(
            `\n🎬 Segmento ${seg + 1}/${totalSegments}: ${start.toFixed(1)}s → ${(start + segDur).toFixed(1)}s (${segDur.toFixed(1)}s)`
          )

          const webpBuf = await convertSegmentToWebp(input, segOut, start, segDur)

          if (webpBuf) {
            const finalSticker = await stampExif(webpBuf)
            await sock.sendMessage(chatId, { sticker: finalSticker }, { quoted: msg })
            console.log(
              `   📤 Sticker ${seg + 1}/${totalSegments} enviado — 🛡️ ${PACK_CONFIG.id}`
            )
            await new Promise((r) => setTimeout(r, 600))
          } else {
            console.warn(`   ⚠️ Segmento ${seg + 1} falló, saltando`)
          }

          try {
            if (fs.existsSync(segOut)) fs.unlinkSync(segOut)
          } catch {}
        }

        console.log(`✅ Todos los segmentos enviados con EXIF: ${PACK_CONFIG.id}`)
      }
    }
  } catch (err) {
    console.error('❌ STICKER ERROR:', err)
    await sock.sendMessage(
      chatId,
      { text: '❌ Error al crear el sticker: ' + err.message },
      { quoted: msg }
    )
  } finally {
    try {
      if (fs.existsSync(input)) fs.unlinkSync(input)
      if (fs.existsSync(output)) fs.unlinkSync(output)
    } catch {}
  }

  return true
}
