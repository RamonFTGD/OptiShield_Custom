import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { sendInteractiveMessage } = require('gifted-btns')

export const meta = {
  name: 'short',
  commands: ['short', 'acortar', 'shorturl'],
  priority: 4,
  class: 'Herramientas',
}

export default async function (msg, sock, ctx) {
  const chatId = msg.key.remoteJid
  const { info } = ctx
  const args = ctx.args.join(' ').trim()

  if (!args) {
    await sendInteractiveMessage(sock, chatId, {
      title: '🔗 URL Shortener',
      text:
        `🔗 *ACORTADOR DE URLs*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Acorta cualquier URL larga en un link corto de OptiShield.\n\n` +
        `📝 *Uso:*\n` +
        `• \`.short https://url.com/ruta/larga\`\n` +
        `• \`.short https://url.com midoc\` (código personalizado)\n\n` +
        `📊 *Estadísticas:*\n` +
        `• \`.short stats aB3xYz\``,
      footer: 'OptiShield • URL Shortener',
      interactiveButtons: [
        {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: '🌐 Ver OptiShield',
            url: 'https://optishield.uk'
          })
        }
      ]
    })
    return true
  }

  if (args.toLowerCase().startsWith('stats ')) {
    const code = args.split(' ')[1]?.trim()
    if (!code) {
      await sock.sendMessage(chatId, { text: '❌ Especifica el código.\nEjemplo: `.short stats aB3xYz`' }, { quoted: msg })
      return true
    }

    try {
      const res  = await fetch(`https://optishield.uk/r/${code}/stats`)
      const data = await res.json()

      if (!data.ok) {
        await sock.sendMessage(chatId, { text: `❌ Link no encontrado: *${code}*` }, { quoted: msg })
        return true
      }

      const created = new Date(data.created).toLocaleString('es-MX')
      const last    = data.lastAccess ? new Date(data.lastAccess).toLocaleString('es-MX') : 'Nunca'
      const shortUrl = data.short

      await sendInteractiveMessage(sock, chatId, {
        title: '📊 Estadísticas',
        text:
          `📊 *ESTADÍSTICAS DEL LINK*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `🔗 *Short:* ${shortUrl}\n` +
          `🌐 *Original:* ${data.url.length > 50 ? data.url.slice(0, 50) + '...' : data.url}\n` +
          `👆 *Clicks:* ${data.clicks}\n` +
          `📅 *Creado:* ${created}\n` +
          `🕒 *Último acceso:* ${last}`,
        footer: 'OptiShield • URL Shortener',
        interactiveButtons: [
          {
            name: 'cta_copy',
            buttonParamsJson: JSON.stringify({
              display_text: '📋 Copiar Link',
              copy_code: shortUrl
            })
          },
          {
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
              display_text: '🌐 Abrir Link',
              url: shortUrl,
              merchant_url: shortUrl
            })
          }
        ]
      })

    } catch (err) {
      await sock.sendMessage(chatId, { text: `❌ Error obteniendo stats: ${err.message}` }, { quoted: msg })
    }

    return true
  }

  const parts = args.split(' ')
  const url   = parts[0]
  const code  = parts[1]?.trim() || undefined

  try { new URL(url) } catch {
    await sock.sendMessage(chatId, { text: '❌ La URL no es válida. Debe empezar con *https://* o *http://*' }, { quoted: msg })
    return true
  }

  try {
    await sock.sendMessage(chatId, { react: { text: '⚙️', key: msg.key } })

    const apiResponse = await global.OptiShield.callApi('url-short', {
      url, ...(code && { code })
    })

    const result = apiResponse?.result
    if (!result?.ok) throw new Error(result?.error || 'No se pudo acortar la URL')

    const originalPreview = url.length > 50 ? url.slice(0, 50) + '...' : url
    const shortUrl = result.short

    await sendInteractiveMessage(sock, chatId, {
      title: '🔗 URL Acortada',
      text:
        `🔗 *URL ACORTADA*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `✅ *Short:* ${shortUrl}\n` +
        `🌐 *Original:* ${originalPreview}\n` +
        `🆔 *Código:* ${result.code}\n` +
        `📅 *Creado:* ${new Date(result.created).toLocaleString('es-MX')}` +
        `${result.reused ? '\n\n♻️ _Este link ya existía, se reutilizó_' : ''}`,
      footer: 'OptiShield • URL Shortener',
      interactiveButtons: [
        {
          name: 'cta_copy',
          buttonParamsJson: JSON.stringify({
            display_text: '📋 Copiar Link',
            copy_code: shortUrl
          })
        },
        {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: '🌐 Abrir Link',
            url: shortUrl,
            merchant_url: shortUrl
          })
        },
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({
            display_text: '📊 Ver Estadísticas',
            id: `.short stats ${result.code}`
          })
        }
      ]
    })

    await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } })

  } catch (err) {
    console.error('❌ SHORT ERROR:', err)
    await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}` }, { quoted: msg })
    await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } })
  }

  return true
}
