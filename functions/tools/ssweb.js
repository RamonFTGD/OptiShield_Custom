export const meta = {
  name: 'ssweb',
  commands: ['ssweb'],
  priority: 4,
  premium: true,
  class: 'Seguridad',
}

export default async function (msg, sock, ctx) {
  const { info, isGroup, admins, args } = ctx
  const chatId = msg.key.remoteJid
  const url = args[0]

  if (!url) {
    await sock.sendMessage(chatId, {
      text:
        '❌ Debes proporcionar una URL\n\n' +
        'Ejemplo:\n' +
        'ssweb https://google.com'
    }, { quoted: msg })
    return true
  }

  try {
    await sock.sendMessage(chatId, {
      text: '📸 Generando screenshot, espera...'
    }, { quoted: msg })

    const data = await global.OptiShield.callApi('ssweb', { url, apikey: info.user.apikey })
    if (data.error) {
      await sock.sendMessage(chatId, { text: data.error }, { quoted: msg })
    }
    if (!data) return true

    if (data.error) {
      await sock.sendMessage(chatId, {
        text: `❌ ${data.error}`
      }, { quoted: msg })
      return true
    }

    if (data.status !== 'ok' || !data.result?.url) {
      await sock.sendMessage(chatId, {
        text: '❌ Respuesta inválida de la API'
      }, { quoted: msg })
      return true
    }

    await sock.sendMessage(chatId, {
      image: { url: data.result.url },
      caption:
        `📸 *Screenshot Web*\n` +
        `🌐 ${url}\n` +
        `👤 ${info.user.usuario || 'Usuario'}`
    }, { quoted: msg })

  } catch (e) {
    console.error('❌ ssweb error:', e)
    await sock.sendMessage(chatId, {
      text: '⚠️ Error al generar el screenshot'
    }, { quoted: msg })
  }

  return true
}
