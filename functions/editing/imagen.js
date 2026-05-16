import { downloadMediaMessage } from '@whiskeysockets/baileys'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

export const meta = {
  name: 'EditImg',
  commands: ['editimg', 'editimage', 'imgedit'],
  priority: 5,
  premium: true,
  class: 'Editores'
}

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
    logger: sock.logger,
    userJid,
    ...(generateMessageIDV2 ? { messageId: generateMessageIDV2(userJid) } : {}),
    quoted: quotedMsg
  })

  const additionalNodes = []
  const isPrivate = isJidGroup ? !isJidGroup(jid) : !jid.endsWith('@g.us')

  additionalNodes.push({
    tag: 'biz', attrs: {}, content: [{
      tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [{
        tag: 'native_flow', attrs: { v: '9', name: 'mixed' }
      }]
    }]
  })

  if (isPrivate) additionalNodes.push({ tag: 'bot', attrs: { biz_bot: '1' } })

  await sock.relayMessage(jid, fullMsg.message, {
    messageId: fullMsg.key.id,
    additionalNodes
  })

  return fullMsg
}

export default async function (msg, sock, ctx) {
  try {
    const jid    = msg.key.remoteJid
    const quoted = msg.message?.extendedTextMessage?.contextInfo
    const args   = ctx.args.join(' ')

    const urlMatch = args.match(/https?:\/\/[^\s|]+/)

    if (urlMatch) {
      const imageUrl = urlMatch[0]
      const restArgs = args.replace(imageUrl, '').trim()
      if (!restArgs.includes('|')) {
        await sock.sendMessage(jid, { text: '❌ Formato: URL | efecto | valor' }, { quoted: msg })
        return true
      }
      const parts = restArgs.split('|').map(p => p.trim())
      if (parts.length < 2 || !parts[1]) {
        await sock.sendMessage(jid, { text: '❌ Especifica un efecto\nEjemplo: URL | brightness | 1.5' }, { quoted: msg })
        return true
      }
      return await applyEffect(msg, sock, imageUrl, parts[1].toLowerCase(), parts[2] || '')
    }

    if (!quoted?.quotedMessage) {
      await sock.sendMessage(jid, {
        text: '❌ Responde a una imagen con .editimg\n\nO usa: `.editimg URL | efecto | valor`'
      }, { quoted: msg })
      return true
    }

    if (!quoted?.quotedMessage?.imageMessage) {
      await sock.sendMessage(jid, { text: '❌ El mensaje citado no es una imagen.' }, { quoted: msg })
      return true
    }

    await sock.sendMessage(jid, { text: '⏳ Procesando imagen...' }, { quoted: msg })

    const buffer = await downloadMediaMessage({ message: quoted.quotedMessage }, 'buffer', {})
    const res = await global.OptiShield.uploadFile(buffer)
    const imageUrl = res.archivo

    if (!args.includes('|')) return await showMenu(msg, sock, imageUrl)

    const parts = args.split('|').map(p => p.trim())
    if (parts.length < 2 || !parts[1]) return await showMenu(msg, sock, imageUrl)

    return await applyEffect(msg, sock, imageUrl, parts[1].toLowerCase(), parts[2] || '', apikey)

  } catch (err) {
    console.error('❌ editimg error:', err)
    await sock.sendMessage(msg.key.remoteJid, { text: '❌ Error: ' + err.message }, { quoted: msg })
    return true
  }
}

async function showMenu(msg, sock, imageUrl) {
  const jid = msg.key.remoteJid

  await sendInteractiveWithImage(sock, jid, {
    imageUrl: imageUrl,
    bodyText: '📸 *Imagen lista para editar*\n\nSelecciona una categoría y elige el efecto que quieres aplicar.',
    footerText: 'OptiShield • Image Editor',
    buttons: [
      {
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: '🎨 Elegir efecto',
          sections: [
            {
              title: '☀️ Ajustes Básicos',
              rows: [
                { id: `.editimg ${imageUrl} | brightness | 1.3`,  title: '☀️ Aumentar Brillo',    description: 'Brillo +30%'           },
                { id: `.editimg ${imageUrl} | brightness | 0.7`,  title: '🌙 Reducir Brillo',     description: 'Brillo -30%'           },
                { id: `.editimg ${imageUrl} | contrast | 1.5`,    title: '🎭 Más Contraste',       description: 'Contraste +50%'        },
                { id: `.editimg ${imageUrl} | saturate | 1.5`,    title: '🎨 Más Saturación',      description: 'Colores más vivos'     },
                { id: `.editimg ${imageUrl} | grayscale`,         title: '🖤 Escala de Grises',    description: 'Blanco y negro'        },
                { id: `.editimg ${imageUrl} | negate`,            title: '🔄 Invertir Colores',    description: 'Negativo de la imagen' },
                { id: `.editimg ${imageUrl} | normalize`,         title: '🔲 Normalizar',          description: 'Normalizar niveles'    },
              ]
            },
            {
              title: '🌈 Tintes de Color',
              rows: [
                { id: `.editimg ${imageUrl} | tint | blue`,   title: '🔵 Tinte Azul',   description: 'Filtro azulado'   },
                { id: `.editimg ${imageUrl} | tint | green`,  title: '💚 Tinte Verde',  description: 'Filtro verdoso'   },
                { id: `.editimg ${imageUrl} | tint | red`,    title: '❤️ Tinte Rojo',   description: 'Filtro rojizo'    },
                { id: `.editimg ${imageUrl} | sepia`,         title: '🌅 Sepia Vintage', description: 'Efecto antiguo'  },
              ]
            },
            {
              title: '✨ Filtros y Efectos',
              rows: [
                { id: `.editimg ${imageUrl} | blur | 3`,       title: '🌫️ Blur Suave',        description: 'Desenfoque ligero'  },
                { id: `.editimg ${imageUrl} | blur | 10`,      title: '💨 Blur Intenso',       description: 'Desenfoque fuerte' },
                { id: `.editimg ${imageUrl} | sharpen | 2`,    title: '⚡ Más Nitidez',         description: 'Imagen más nítida' },
                { id: `.editimg ${imageUrl} | median | 5`,     title: '🎪 Mediana',             description: 'Filtro mediana'   },
                { id: `.editimg ${imageUrl} | gamma | 2.2`,    title: '🔆 Gamma Alto',          description: 'Gamma 2.2'        },
                { id: `.editimg ${imageUrl} | gamma | 0.8`,    title: '🔅 Gamma Bajo',          description: 'Gamma 0.8'        },
                { id: `.editimg ${imageUrl} | posterize | 4`,  title: '🎞️ Posterize',          description: 'Efecto póster'    },
              ]
            },
            {
              title: '📐 Transformaciones',
              rows: [
                { id: `.editimg ${imageUrl} | flip`,              title: '🌀 Flip Horizontal',   description: 'Voltear horizontal'  },
                { id: `.editimg ${imageUrl} | flop`,              title: '↕️ Flop Vertical',     description: 'Voltear vertical'    },
                { id: `.editimg ${imageUrl} | rotate | 90`,       title: '🔄 Rotar 90°',         description: 'Girar 90 grados'     },
                { id: `.editimg ${imageUrl} | rotate | 180`,      title: '🔁 Rotar 180°',        description: 'Girar 180 grados'    },
                { id: `.editimg ${imageUrl} | rotate | 270`,      title: '↩️ Rotar 270°',        description: 'Girar 270 grados'    },
                { id: `.editimg ${imageUrl} | crop | square`,     title: '✂️ Recortar Cuadrado', description: 'Formato cuadrado'    },
                { id: `.editimg ${imageUrl} | crop | 16:9`,       title: '🎬 Recortar 16:9',     description: 'Formato widescreen'  },
              ]
            },
            {
              title: '📏 Resolución',
              rows: [
                { id: `.editimg ${imageUrl} | resize | 1280x720`,   title: '📱 720p HD',      description: '1280x720 px'  },
                { id: `.editimg ${imageUrl} | resize | 1920x1080`,  title: '🖥️ 1080p Full HD', description: '1920x1080 px' },
                { id: `.editimg ${imageUrl} | resize | 2560x1440`,  title: '🎬 2K QHD',       description: '2560x1440 px' },
                { id: `.editimg ${imageUrl} | resize | 3840x2160`,  title: '🎥 4K UHD',       description: '3840x2160 px' },
              ]
            }
          ]
        })
      }
    ],
    quotedMsg: msg
  })

  return true
}

async function applyEffect(msg, sock, imageUrl, effect, value ) {
  const jid = msg.key.remoteJid
  try {
    await sock.sendMessage(jid, { text: `⏳ Aplicando efecto: *${effect}*...` }, { quoted: msg })

    let params = { url: imageUrl, effect }

    switch (effect) {
      case 'brightness': case 'contrast': case 'saturate': case 'sharpen':
        params.factor = parseFloat(value) || 1.3; break
      case 'blur':   params.sigma  = parseFloat(value) || 3;   break
      case 'median': params.size   = parseInt(value)   || 5;   break
      case 'gamma':  params.factor = parseFloat(value) || 2.2; break
      case 'posterize': params.levels = parseInt(value) || 4;  break
      case 'tint':   params.color  = value || 'blue';          break
      case 'resize':
        if (value.includes('x')) {
          const [w, h] = value.split('x')
          params.width = parseInt(w) || 1920
          params.height = parseInt(h) || 1080
        }; break
      case 'rotate': params.angle  = parseInt(value) || 90;    break
      case 'crop':   params.type   = value || 'square';        break
    }

    const res = await global.OptiShield.callApi('editimg', params)

    if (!res.result?.ok || !res.result?.url) {
      await sock.sendMessage(jid, { text: `❌ ${res.result?.error || 'Error al procesar la imagen'}` }, { quoted: msg })
      return true
    }

    await sock.sendMessage(jid, {
      image: { url: res.result.url },
      caption: `✅ *Efecto:* ${effect}\n💡 Responde a esta imagen con .editimg para más efectos`
    }, { quoted: msg })

    return true
  } catch (err) {
    await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` }, { quoted: msg })
    return true
  }
}
