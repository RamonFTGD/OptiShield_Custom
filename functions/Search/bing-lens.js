import { downloadContentFromMessage } from '@whiskeysockets/baileys'

export const meta = {
  name: 'imagelens',
  commands: ['lens', 'imglens', 'buscarimg', 'imagelens'],
  priority: 5,
  premium: true,
  class: 'Herramientas',
}

export default async function (msg, sock, ctx) {
  const jid = msg.key.remoteJid
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
  const apikey = ctx.apikey

  if (!quoted) {
    await sock.sendMessage(jid, { 
      text: '❌ Responde a una imagen o sticker para buscar imágenes similares.\n\nEjemplo: `.lens` (respondiendo a una imagen)' 
    }, { quoted: msg })
    return true
  }

  const type = Object.keys(quoted)[0]
  if (!['imageMessage', 'stickerMessage'].includes(type)) {
    await sock.sendMessage(jid, { 
      text: '❌ Solo funciona con imágenes o stickers' 
    }, { quoted: msg })
    return true
  }

  if (!apikey) {
    await sock.sendMessage(jid, { 
      text: '❌ No tienes API Key válida.' 
    }, { quoted: msg })
    return true
  }

  const statusMsg = await sock.sendMessage(jid, {
    text: '🔍 Buscando imágenes similares en Bing Lens...'
  }, { quoted: msg })

  const edit = async (text) => {
    try { 
      await sock.sendMessage(jid, { text, edit: statusMsg.key }) 
    } catch { }
  }

  try {
    await edit('⏳ Descargando imagen...')
    

    const stream = await downloadContentFromMessage(quoted[type], type.replace('Message', ''))
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)
    const { archivo: dataUrl } = await global.OptiShield.uploadFile(buffer)
    
    const res = await global.OptiShield.callApi('image-lens', { 
      url: dataUrl, 
      apikey 
    })

    if (res.error) { 
      await edit(`❌ ${res.error}`)
      return true 
    }

    const result = res.result
    

    if (!result?.ok || !result.results?.length) {
      await edit('⚠️ No se encontraron imágenes similares.')
      return true
    }

    const validImages = result.results
      .filter(img => {

        if (!img.archivo) return false

        if (img.archivo.includes('svg')) return false

        if (img.video === true) return false

        if (img.tipo !== 'imagen') return false
        return true
      })
      .slice(0, 10)

    if (!validImages.length) {
      await edit('⚠️ No hay imágenes válidas para mostrar.')
      return true
    }

    await edit(`🎯 Encontradas *${validImages.length}* imágenes similares. Enviando...`)

    const imageUrls = validImages.map(img => img.archivo)

    const medias = imageUrls.map(url => ({
      image: { url }
    }))
    
    const caption = `✅ *Búsqueda Inversa Completada*

📊 Resultados: *${imageUrls.length}* imágenes similares
🔗 Fuente: Bing Lens → Pinterest
🔍 Query: ${result.queryUsed?.substring(0, 60) || 'N/A'}
⚡ OptiShield`

    await sock.sendAlbumMessage(jid, medias, {
      quoted: msg,
      caption,
      delay: 400
    })

  } catch (err) {
    console.error('❌ lens error:', err)
    await edit(`❌ Error: ${err.message}`)
  }

  return true
}
