import { load } from 'cheerio'
import { reply, isOwner } from '../../lib/utils.js'

export const meta = {
  name: 'get',
  commands: ['get', 'fetch', 'html'],
  priority: 1,
  class: 'Sistema',
  ownerOnly: true,
  description: 'Obtiene el contenido HTML de una URL (solo owners)'
}

export default async function (msg, sock, ctx) {
  const { chatId, sender, args } = ctx

  // 🔒 SOLO OWNERS — este plugin ejecuta peticiones externas
  if (!isOwner(sender)) {
    await reply(sock, chatId, '❌ *Acceso denegado.* Solo el owner puede usar este comando.', msg)
    return true
  }

  if (!args[0]) {
    await reply(sock, chatId, '❌ Proporciona una URL\n\nEjemplo:\n.get https://example.com\n.get https://example.com | div p', msg)
    return true
  }

  const rawInput = args.join(' ')
  const pipeIndex = rawInput.indexOf('|')
  let url = rawInput
  let filterTags = []

  if (pipeIndex !== -1) {
    url = rawInput.slice(0, pipeIndex).trim()
    filterTags = rawInput.slice(pipeIndex + 1).trim().split(/\s+/).filter(Boolean)
  }

  // 🔒 Validar URL — solo http/https, no IPs internas
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      await reply(sock, chatId, '❌ Solo se permiten URLs HTTP/HTTPS.', msg)
      return true
    }
    const host = parsed.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' ||
        host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.16.')) {
      await reply(sock, chatId, '❌ No se permiten direcciones IP internas.', msg)
      return true
    }
  } catch {
    await reply(sock, chatId, '❌ URL inválida.', msg)
    return true
  }

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OptiShieldBot/2.0)' }
    })

    if (!response.ok) {
      await reply(sock, chatId, `❌ Error HTTP ${response.status} al obtener la URL.`, msg)
      return true
    }

    const contentType = response.headers.get('content-type') || ''

    if (contentType.startsWith('image/')) {
      const buffer = Buffer.from(await response.arrayBuffer())
      await sock.sendMessage(chatId, { image: buffer, caption: `🖼️ ${url}` }, { quoted: msg })
      return true
    }

    let text = await response.text()

    if (filterTags.length > 0 && contentType.includes('html')) {
      const $ = load(text)
      const parts = []
      filterTags.forEach(tag => {
        $(tag).each(function () {
          const outerHtml = $.html(this).trim()
          if (outerHtml) parts.push(`── <${tag}> ──\n${outerHtml}`)
        })
      })
      text = parts.length > 0 ? parts.join('\n\n') : `⚠️ No se encontraron: ${filterTags.join(', ')}`
    }

    if (text.length > 44500) text = text.slice(0, 44500) + '\n\n⚠️ Contenido truncado...'

    const tagInfo = filterTags.length > 0 ? `🏷️ ${filterTags.join(', ')}\n` : ''
    await reply(sock, chatId,
      `📄 *Contenido obtenido*\n🧾 ${contentType.split(';')[0]}\n🌐 ${url}\n${tagInfo}\n${text}`,
      msg)

  } catch (err) {
    await reply(sock, chatId, `❌ Error: ${err.message}`, msg)
  }

  return true
}
