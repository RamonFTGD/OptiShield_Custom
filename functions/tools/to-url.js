import {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto,
  downloadMediaMessage
} from '@whiskeysockets/baileys'

export const meta = {
  name: 'ToUrl',
  commands: ['tourl', 'url', 'link'],
  priority: 5,
  class: 'Herramientas'
}

export default async function (msg, sock, ctx) {
  try {
    const jid = msg.key.remoteJid
    const quoted = msg.message?.extendedTextMessage?.contextInfo
    const args = ctx.args.join(' ').trim()

    const urlMatch = args.match(/https?:\/\/[^\s|]+/)

    if (urlMatch) {
      const imageUrl = urlMatch[0]
      const restArgs = args.replace(imageUrl, '').trim()

      if (!restArgs.includes('|')) {
        await sock.sendMessage(jid, {
          text: '❌ Formato incorrecto.\n\n' +
            '📝 Uso desde botón:\n' +
            'URL | server'
        }, { quoted: msg })
        return true
      }

      const parts = restArgs.split('|').map(p => p.trim())

      if (parts.length < 2 || !parts[1]) {
        await sock.sendMessage(jid, {
          text: '❌ Debes especificar un servidor.\n\n' +
            '✨ Ejemplo:\n' +
            'URL | optishield'
        }, { quoted: msg })
        return true
      }

      const server = parts[1].toLowerCase()

      return await uploadToServer(msg, sock, imageUrl, server)
    }

    if (!quoted?.quotedMessage) {
      await sock.sendMessage(jid, {
        text: '❌ Debes responder a un archivo.\n\n' +
          '📝 Uso:\n' +
          '• Responde a una imagen, video, audio o documento\n' +
          '• Usa: .tourl\n\n' +
          '✨ Ejemplo:\n' +
          'Responde a una imagen con .tourl\n\n' +
          '⏱️ La URL expira en 2 horas'
      }, { quoted: msg })
      return true
    }

    const messageTypes = quoted.quotedMessage
    let mediaType = null
    let fileName = 'file'
    let mimeType = 'application/octet-stream'

    if (messageTypes.imageMessage) {
      mediaType = 'image'
      fileName = 'image.jpg'
      mimeType = messageTypes.imageMessage.mimetype || 'image/jpeg'
    } else if (messageTypes.videoMessage) {
      mediaType = 'video'
      fileName = 'video.mp4'
      mimeType = messageTypes.videoMessage.mimetype || 'video/mp4'
    } else if (messageTypes.audioMessage) {
      mediaType = 'audio'
      fileName = 'audio.mp3'
      mimeType = messageTypes.audioMessage.mimetype || 'audio/mpeg'
    } else if (messageTypes.documentMessage) {
      mediaType = 'document'
      fileName = messageTypes.documentMessage.fileName || 'document.pdf'
      mimeType = messageTypes.documentMessage.mimetype || 'application/pdf'
    } else if (messageTypes.stickerMessage) {
      mediaType = 'sticker'
      fileName = 'sticker.webp'
      mimeType = 'image/webp'
    } else {
      await sock.sendMessage(jid, {
        text: '❌ El mensaje citado no es un archivo válido.\n\n' +
          '✅ Tipos soportados:\n' +
          '• 📸 Imágenes\n' +
          '• 🎥 Videos\n' +
          '• 🎵 Audios\n' +
          '• 📄 Documentos\n' +
          '• 🎨 Stickers'
      }, { quoted: msg })
      return true
    }

    await sock.sendMessage(jid, {
      text: '⏳ Descargando archivo...'
    }, { quoted: msg })

    const buffer = await downloadMediaMessage(
      { message: quoted.quotedMessage },
      'buffer',
      {}
    )

    if (!buffer || buffer.length === 0) {
      await sock.sendMessage(jid, {
        text: '❌ Error: No se pudo descargar el archivo'
      }, { quoted: msg })
      return true
    }

    const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2)
    const fileSizeKB = (buffer.length / 1024).toFixed(2)
    const fileSize = buffer.length > 1024 * 1024 ? `${fileSizeMB} MB` : `${fileSizeKB} KB`

    const res = await global.OptiShield.uploadFile(buffer, fileName)

    if (!res || !res.archivo) {
      await sock.sendMessage(jid, {
        text: '❌ Error: No se pudo generar la URL'
      }, { quoted: msg })
      return true
    }

    const imageUrl = res.archivo

    return await showCarousel(msg, sock, buffer, imageUrl, fileName, fileSize, mediaType)

  } catch (err) {
    console.error('❌ tourl error:', err)
    await sock.sendMessage(msg.key.remoteJid, {
      text: '❌ Error: ' + err.message
    }, { quoted: msg })
    return true
  }
}

async function showCarousel(msg, sock, buffer, imageUrl, fileName, fileSize, mediaType) {
  const jid = msg.key.remoteJid

  try {
    const prepared = await prepareWAMessageMedia(
      { image: buffer },
      { upload: sock.waUploadToServer }
    )

    const card = {
      header: proto.Message.InteractiveMessage.Header.create({
        title: '📤 Subir Archivo',
        subtitle: 'Selecciona el servidor',
        hasMediaAttachment: true,
        imageMessage: prepared.imageMessage
      }),
      body: proto.Message.InteractiveMessage.Body.create({
        text: `📁 *Información del Archivo*\n\n` +
          `📄 Nombre: ${fileName}\n` +
          `📊 Tamaño: ${fileSize}\n` +
          `📁 Tipo: ${mediaType.toUpperCase()}\n\n` +
          `🌐 Selecciona el servidor donde deseas subir el archivo si gustas` +
          `📁 URL directa: ${imageUrl}`
      }),
      footer: proto.Message.InteractiveMessage.Footer.create({
        text: 'File Upload Service'
      }),
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
        buttons: [
          {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: '🐙 GitHub Server',
              id: `.tourl ${imageUrl} | github`
            })
          }
        ]
      })
    }

    const carouselMsg = generateWAMessageFromContent(jid, {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2
          },
          interactiveMessage: proto.Message.InteractiveMessage.create({
            body: proto.Message.InteractiveMessage.Body.create({
              text: `📤 *Convertir a URL*\n\n` +
                `✅ Archivo listo para subir\n` +
                `🌐 Selecciona tu servidor preferido\n\n` +
                `💡 Cada servidor tiene sus ventajas`
            }),
            footer: proto.Message.InteractiveMessage.Footer.create({
              text: '© Upload Service'
            }),
            header: proto.Message.InteractiveMessage.Header.create({
              title: '🔗 URL Generator',
              subtitle: '2 servidores disponibles',
              hasMediaAttachment: false
            }),
            carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.create({
              cards: [card]
            })
          })
        }
      }
    }, { quoted: msg })

    await sock.relayMessage(jid, carouselMsg.message, {
      messageId: carouselMsg.key.id
    })

    return true

  } catch (err) {
    console.error('❌ showCarousel error:', err)
    await sock.sendMessage(jid, {
      text: '❌ Error al mostrar opciones: ' + err.message
    }, { quoted: msg })
    return true
  }
}

async function uploadToServer(msg, sock, imageUrl, server) {
  const jid = msg.key.remoteJid

  try {
    await sock.sendMessage(jid, {
      text: `⏳ Subiendo a *${server.toUpperCase()}*...`
    }, { quoted: msg })

    const response = await fetch(imageUrl)
    const buffer = Buffer.from(await response.arrayBuffer())

    const fileName = imageUrl.split('/').pop()
    const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2)
    const fileSizeKB = (buffer.length / 1024).toFixed(2)
    const fileSize = buffer.length > 1024 * 1024 ? `${fileSizeMB} MB` : `${fileSizeKB} KB`

    let res
    let finalUrl
    let serverInfo

    if (server === 'optishield') {
      res = await global.OptiShield.uploadFile(buffer, fileName)
      finalUrl = res.archivo
      serverInfo = {
        '🌐 Servidor': 'OptiShield',
        '⏱️ Expira': 'En 2 horas',
        '🔒 Tipo': 'Temporal',
        '⚡ Velocidad': 'Alta',
        '📍 Región': 'Global'
      }
    } else if (server === 'github') {
      res = await global.OptiShield.uploadFileGitHub(buffer, fileName)
      finalUrl = res.archivo
      serverInfo = {
        '🌐 Servidor': 'GitHub',
        '⏱️ Expira': 'Permanente',
        '🔒 Tipo': 'Público',
        '⚡ Velocidad': 'Media',
        '📍 CDN': 'GitHub CDN'
      }
    } else {
      await sock.sendMessage(jid, {
        text: '❌ Servidor no válido'
      }, { quoted: msg })
      return true
    }

    if (!res || !finalUrl) {
      await sock.sendMessage(jid, {
        text: `❌ Error al subir a ${server.toUpperCase()}`
      }, { quoted: msg })
      return true
    }

    const infoText = Object.entries(serverInfo)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')

    await sock.sendMessage(jid, {
      text: `✅ *Archivo subido exitosamente*\n\n` +
        `${infoText}\n` +
        `📄 Nombre: ${fileName}\n` +
        `📊 Tamaño: ${fileSize}\n` +
        `🔗 URL: ${finalUrl}\n\n` +
        `💡 *Tip:* Copia la URL para compartirla`
    }, { quoted: msg })

    return true

  } catch (err) {
    console.error('❌ uploadToServer error:', err)
    await sock.sendMessage(jid, {
      text: `❌ Error al subir: ${err.message}`
    }, { quoted: msg })
    return true
  }
}
