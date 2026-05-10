import { spawn } from 'child_process'
import { load } from 'cheerio'

export const meta = {
  name: 'get',
  commands: ['get'],
  priority: 1,
  class: 'Sistema',
}

export default async function (msg, sock, ctx) {
  const { info, isGroup, admins, args } = ctx

  if (!args[0]) {
    await sock.sendMessage(msg.key.remoteJid, {
      text: '❌ Debes proporcionar una URL\n\nEjemplos:\nget https://example.com\nget https://example.com | div p h1'
    }, { quoted: msg })
    return true
  }

  const rawInput = args.join(' ')
  const pipeIndex = rawInput.indexOf('|')

  let url = rawInput
  let filterTags = []

  if (pipeIndex !== -1) {
    url = rawInput.slice(0, pipeIndex).trim()
    filterTags = rawInput
      .slice(pipeIndex + 1)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
  }

  try {
    const result = await new Promise((resolve, reject) => {
      let raw = Buffer.alloc(0)

      const proc = spawn('torsocks', [
        'curl',
        '-i',
        '-L',
        '--max-time', '30',
        url
      ])

      proc.stdout.on('data', d => {
        raw = Buffer.concat([raw, d])
      })

      proc.on('close', code => {
        if (code !== 0) return reject(new Error('curl falló vía TOR'))

        const sep = raw.indexOf('\r\n\r\n')
        if (sep === -1) return reject(new Error('Respuesta inválida'))

        const headers = raw.slice(0, sep).toString()
        const body = raw.slice(sep + 4)

        const ctLine = headers
          .split('\n')
          .find(l => l.toLowerCase().startsWith('content-type'))

        const contentType = ctLine
          ? ctLine.split(':')[1].trim()
          : 'application/octet-stream'

        resolve({ contentType, body })
      })
    })

    const { contentType, body } = result

    if (contentType.startsWith('image/')) {
      await sock.sendMessage(msg.key.remoteJid, {
        image: body,
        caption: `🖼️ Imagen obtenida (TOR)\n🌐 ${url}`
      }, { quoted: msg })
      return true
    }

    if (
      contentType.includes('text') ||
      contentType.includes('json') ||
      contentType.includes('xml') ||
      contentType.includes('html')
    ) {
      let text = body.toString('utf8')

      if (filterTags.length > 0 && contentType.includes('html')) {
        const $ = load(text)
        const parts = []

        filterTags.forEach(tag => {
          $(tag).each(function () {
            const content = $(this).text().trim()
            const outerHtml = $.html(this).trim()

            if (outerHtml) {
              parts.push(`── <${tag}> ──\n${outerHtml}`)
            }
          })
        })

        if (parts.length === 0) {
          text = `⚠️ No se encontraron las etiquetas: ${filterTags.join(', ')}`
        } else {
          text = parts.join('\n\n')
        }
      }

      if (text.length > 44500) {
        text = text.slice(0, 44500) + '\n\n⚠️ Contenido demasiado largo...'
      }

      const tagInfo = filterTags.length > 0
        ? `🏷️ Etiquetas: ${filterTags.join(', ')}\n`
        : ''

      await sock.sendMessage(msg.key.remoteJid, {
        text:
          `📄 Contenido obtenido (TOR)\n` +
          `🧾 Tipo: ${contentType}\n` +
          `🌐 ${url}\n` +
          tagInfo +
          `\n` +
          text
      }, { quoted: msg })
      return true
    }

    const ext = contentType.split('/')[1]?.split(';')[0] || 'bin'

    await sock.sendMessage(msg.key.remoteJid, {
      document: body,
      fileName: `file.${ext}`,
      mimetype: contentType,
      caption: `📦 Archivo descargado (TOR)\n🧾 ${contentType}\n🌐 ${url}`
    }, { quoted: msg })

  } catch (err) {
    await sock.sendMessage(msg.key.remoteJid, {
      text: '❌ Error al obtener el contenido del enlace vía TOR'
    }, { quoted: msg })
  }

  return true
}
