export const meta = {
  name: 'gay-imagen',
  commands: ['gay'],
  priority: 5,
  class: 'Fun',
  premium: true,
}

function normalizeJid(jid = '') {
  return jid.replace(/[^0-9]/g, '') + '@s.whatsapp.net'
}

export default async function (msg, sock, ctx) {

  const { args } = ctx
  const chatId = msg.key.remoteJid
  const sender = msg.key.participant || msg.key.remoteJid

  let targetJid = null

  if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
    targetJid = msg.message.extendedTextMessage.contextInfo.participant
  }
  else if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
    targetJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0]
  }
  else if (args[0]) {
    targetJid = normalizeJid(args[0])
  }
  else {
    targetJid = sender
  }

  try {

    let avatar

    try {
      avatar = await sock.profilePictureUrl(targetJid, 'image')
    } catch {
      avatar = 'https://wallpapers.com/images/hd/profile-picture-vmrnbslcc3uzczsm.jpg'
    }

    let name = targetJid

    try {
      const contact = await sock.onWhatsApp(targetJid)
      if (contact?.[0]?.notify) name = contact[0].notify
    } catch {}

    if (name === 'Ramón Owner - OptiShield') {
      try {
        avatar = await sock.profilePictureUrl(sender, 'image')
      } catch {
        avatar = 'https://wallpapers.com/images/hd/profile-picture-vmrnbslcc3uzczsm.jpg'
      }
    }

    const api = await global.OptiShield.callApi(
      "gay-imagen-quoted",
      {
        apikey: ctx.apikey,
        imageUrl_0: avatar
      }
    )

    if (!api?.result?.url) {
      throw new Error("API_ERROR")
    }

    // 📤 Enviar imagen
    await sock.sendMessage(
      chatId,
      {
        image: { url: api.result.url },
        caption: `🏳️‍🌈 @${targetJid.split('@')[0]}`,
        mentions: [targetJid]
      },
      { quoted: msg }
    )

  } catch (err) {

    await sock.sendMessage(
      chatId,
      {
        text: '❌ No se pudo generar la imagen'
      },
      { quoted: msg }
    )

  }

  return true
}
