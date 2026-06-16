import { reply, editLog, fetchBuffer, isUrl } from '../../lib/utils.js'

export const meta = {
  name: 'PDFTools',
  commands: ['pdftoimg', 'imgtopdf', 'pdf2img', 'img2pdf'],
  priority: 4,
  premium: true,
  class: 'Herramientas',
  description: 'Convierte PDF a imágenes o imágenes a PDF'
}

export default async function (msg, sock, ctx) {
  const { chatId, command, text } = ctx

  if (command === 'imgtopdf' || command === 'img2pdf') {
    const urls = text.split(/\s+/).filter(u => isUrl(u))
    if (urls.length === 0) {
      await reply(sock, chatId,
        `📄 *Imágenes → PDF*
${'─'.repeat(28)}
Convierte imágenes a un PDF.

◆ ${'.imgtopdf <url1> <url2> ...'}

◆ .imgtopdf https://ejemplo.com/img1.jpg

⚡ OptiShield`,
        msg)
      return true
    }

    const { key: logKey } = await sock.sendMessage(chatId, { text: `📄 Convirtiendo ${urls.length} imágenes a PDF...` }, { quoted: msg })
    try {
      const res = await global.OptiShield.callApi('images-to-pdf', { urls: urls.join(','), size: 'A4', fit: 'contain', margin: 10 })
      if (res.error) { await sock.sendMessage(chatId, { text: `❌ ${res.error}`, edit: logKey }); return true }
      const pdfUrl = res.result?.pdf || res.result?.url || res.result?.file
      if (!pdfUrl) { await sock.sendMessage(chatId, { text: '❌ No se pudo generar el PDF', edit: logKey }); return true }
      await editLog(sock, chatId, logKey, '📤 Enviando PDF...')
      const buffer = await fetchBuffer(pdfUrl, 50 * 1024 * 1024)
      await sock.sendMessage(chatId, { document: buffer, mimetype: 'application/pdf', fileName: 'documento.pdf', caption: `📄 *PDF generado*\n🖼️ ${urls.length} imágenes\n\n⚡ OptiShield` }, { quoted: msg })
      await sock.sendMessage(chatId, { text: '✅ PDF enviado', edit: logKey })
    } catch (err) {
      console.error('❌ img2pdf error:', err)
      await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}`, edit: logKey })
    }
    return true
  }

  if (command === 'pdftoimg' || command === 'pdf2img') {
    const url = text.trim()
    if (!url || !isUrl(url)) {
      await reply(sock, chatId,
        `📄 *PDF → Imágenes*
${'─'.repeat(28)}
Convierte un PDF a imágenes PNG.

◆ ${'.pdf2img <url-del-pdf>'}

◆ .pdf2img https://ejemplo.com/documento.pdf

⚡ OptiShield`,
        msg)
      return true
    }

    const { key: logKey } = await sock.sendMessage(chatId, { text: '📄 Convirtiendo PDF a imágenes...' }, { quoted: msg })
    try {
      const res = await global.OptiShield.callApi('pdf-to-images', { url, format: 'png', dpi: 150 })
      if (res.error) { await sock.sendMessage(chatId, { text: `❌ ${res.error}`, edit: logKey }); return true }
      const images = res.result?.images || []
      if (!images.length) { await sock.sendMessage(chatId, { text: '❌ No se pudieron generar imágenes', edit: logKey }); return true }
      await editLog(sock, chatId, logKey, `🖼️ Enviando ${images.length} imágenes...`)
      for (let i = 0; i < Math.min(images.length, 10); i++) {
        await sock.sendMessage(chatId, {
          image: { url: images[i] },
          caption: i === 0 ? `📄 *PDF convertido*\n📄 Página ${i + 1}/${images.length}\n\n⚡ OptiShield` : `📄 Página ${i + 1}/${images.length}`
        }, { quoted: msg })
        await new Promise(r => setTimeout(r, 400))
      }
      await sock.sendMessage(chatId, { text: `✅ ${Math.min(images.length, 10)} imágenes enviadas`, edit: logKey })
    } catch (err) {
      console.error('❌ pdf2img error:', err)
      await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}`, edit: logKey })
    }
    return true
  }
  return true
}
