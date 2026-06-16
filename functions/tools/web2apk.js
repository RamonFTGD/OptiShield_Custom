export const meta = {
  name: 'web2apk',
  commands: ['web2apk', 'webapp', 'appweb'],
  priority: 4,
  class: 'Herramientas',
  premium: true,
  description: 'Convierte una página web en una app nativa para Android/iOS',
}

function isValidUrl(str) {
  try {
    const url = new URL(str)
    return ['http:', 'https:'].includes(url.protocol) &&
           url.hostname.includes('.')
  } catch { return false }
}

function sanitizeAppName(name) {
  return name.replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 50) || 'MyApp'
}

export default async function (msg, sock, ctx) {
  const { chatId, args, apikey } = ctx

  // .web2apk <nombre> <url>
  if (args.length < 2) {
    await sock.sendMessage(chatId, {
      text: '╔═══════════════════╗\n' +
            '║  📱 WEB TO APP    ║\n' +
            '╚═══════════════════╝\n\n' +
            '❌ *Uso:* `.web2apk <nombre> <url>`\n\n' +
            '📝 *Ejemplo:*\n' +
            '`.web2apk MiApp https://ejemplo.com`\n\n' +
            '📱 Convierte cualquier sitio web en una app nativa.\n' +
            '⚡ OptiShield'
    }, { quoted: msg })
    return true
  }

  const appName = sanitizeAppName(args.slice(0, -1).join(' '))
  const url = args[args.length - 1]

  if (!isValidUrl(url)) {
    await sock.sendMessage(chatId, {
      text: '❌ *URL inválida*\n\n' +
            'Asegúrate de incluir el protocolo (https://)\\n' +
            '📝 Ejemplo: `.web2apk GitHub https://github.com`'
    }, { quoted: msg })
    return true
  }

  if (!appName || appName.length < 2) {
    await sock.sendMessage(chatId, {
      text: '❌ *Nombre inválido*\n\n' +
            'El nombre debe tener al menos 2 caracteres.\\n' +
            '📝 Ejemplo: `.web2apk MiApp https://ejemplo.com`'
    }, { quoted: msg })
    return true
  }

  const { key: logKey } = await sock.sendMessage(chatId, {
    text: `📱 *Convirtiendo web a app...*\n\n` +
          `🌐 *Sitio:* ${url}\n` +
          `📝 *Nombre:* ${appName}\n\n` +
          `⏳ Esto puede tomar un momento...`
  }, { quoted: msg })

  const edit = async (text) => {
    try { await sock.sendMessage(chatId, { text, edit: logKey }) } catch { }
  }

  try {
    const res = await global.OptiShield.callApi('web2apk', {
      appName,
      websiteUrl: url,
      apikey,
    })

    if (res.error) {
      await edit(`❌ *Error al generar la app*\n\n${res.error}`)
      return true
    }

    const result = res.result || res

    const downloadUrl = result.url || result.downloadUrl || result.link || result.file
    const appIcon = result.icon || result.iconUrl || null
    const appSize = result.size || result.fileSize || null
    const packageName = result.package || result.bundle || result.packageName || null

    let text = '✅ *¡APP GENERADA EXITOSAMENTE!*\n' +
               '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
               `📱 *${appName}*\n` +
               `🌐 ${url}\n\n`

    if (packageName) text += `📦 Package: \`${packageName}\`\n`
    if (appSize) text += `📦 Tamaño: ${appSize}\n`

    text += '\n━━━━━━━━━━━━━━━━━━━━━━\n'

    if (downloadUrl) {
      text += `🔗 *DESCARGAR:*\n${downloadUrl}\n\n`
      text += '💡 *Instalación:*\n' +
              '1. Descarga el archivo .apk\n' +
              '2. Habilita "Orígenes desconocidos" en Android\n' +
              '3. Abre el archivo para instalarlo\n'
    } else {
      text += '✅ La app se ha generado correctamente.\n' +
              'Revisa el enlace de descarga en la respuesta.'
    }

    text += '\n\n⚡ OptiShield'

    if (downloadUrl) {
      if (appIcon) {
        await sock.sendMessage(chatId, {
          image: { url: appIcon },
          caption: text,
        }, { quoted: msg })
      } else {
        await edit(text)
      }

      await sock.sendMessage(chatId, {
        document: { url: downloadUrl },
        mimetype: 'application/vnd.android.package-archive',
        fileName: `${appName}.apk`,
        caption: `📱 *${appName}* — App lista para instalar`,
      }, { quoted: msg })
    } else {
      await edit(text)
    }

  } catch (err) {
    console.error('[web2apk] Error:', err.message)
    await edit(`❌ *Error al generar la app*\n\n${err.message}\n\nIntenta con otro nombre o URL.`)
  }

  return true
}
