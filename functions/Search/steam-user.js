export const meta = {
  name: 'steam-search-id',
  commands: ['steamplayer', 'steamid'],
  priority: 5,
  premium: true,
  class: 'Herramientas'
}

export default async function (msg, sock, ctx) {
  try {
    const jid = msg.key.remoteJid
    const { args } = ctx

    if (!args[0]) {
      await sock.sendMessage(jid, {
        text: '❌ *Uso incorrecto*\n\n' +
              '📝 *Ejemplo:*\n' +
              '.steamid 76561199564497299\n\n' +
              '💡 *Tip:* Usa tu SteamID64 para ver tu perfil'
      }, { quoted: msg })
      return true
    }

    const steamid = args[0]

    if (!/^\d{17}$/.test(steamid)) {
      await sock.sendMessage(jid, {
        text: '❌ *SteamID inválido*\n\n' +
              '✅ Debe ser un número de 17 dígitos\n' +
              '📝 Ejemplo: 76561199564497299'
      }, { quoted: msg })
      return true
    }

    await sock.sendMessage(jid, {
      text: '🔍 Buscando información de Steam...'
    }, { quoted: msg })

    const result = await global.OptiShield.callApi("steam-search-id", { 
      id: steamid,
      apikey: ctx.apikey
    })

    if (result.error || !result.result?.success) {
      await sock.sendMessage(jid, {
        text: '❌ *Error al buscar el perfil*\n\n' +
              (result.error || 'No se encontró información para este SteamID')
      }, { quoted: msg })
      return true
    }

    const data = result.result
    const profile = data.profile
    const ids = data.ids
    const bans = data.bans
    const hours = data.hours

    const banStatus = (status) => status ? '✅ Sin bans' : '❌ Baneado'

    const message = 
      `🎮 *PERFIL DE STEAM*\n\n` +
      `👤 *${profile.username}*\n` +
      `⭐ Nivel: ${profile.nivel}\n` +
      `📅 Antigüedad: ${profile.antiguedad}\n` +
      `🟢 Estado: ${profile.estado}\n` +
      `💰 Valor aproximado: ${profile.valorAproximado}\n` +
      `⭐ Rating: ${profile.rating}/5 (${profile.ratingCount} votos)\n\n` +
      
      `🆔 *IDENTIFICADORES*\n` +
      `• SteamID: ${ids.steamId}\n` +
      `• Steam2: ${ids.steam2Id}\n` +
      `• Steam3: ${ids.steam3Id}\n` +
      `• AccountID: ${ids.accountId}\n` +
      `• FiveM: ${ids.fivemHex}\n\n` +
      
      `🔒 *BANS Y RESTRICCIONES*\n` +
      `• Game Bans: ${banStatus(bans.gameBans)}\n` +
      `• VAC Bans: ${banStatus(bans.vacBans)}\n` +
      `• Community: ${banStatus(bans.communityBan)}\n` +
      `• Trade: ${banStatus(bans.tradeBan)}\n\n` +
      
      `⏱️ *HORAS JUGADAS*\n` +
      `• Total: ${hours.total}\n` +
      `• Windows: ${hours.windows}\n` +
      `• Linux: ${hours.linux}\n` +
      `• MacOS: ${hours.macos}\n\n` +
      
      `🔗 *ENLACES*\n` +
      `• Invitar: ${ids.inviteUrlShort}\n\n` +
      
      `⏱️ Tiempo de respuesta: ${data.ping}ms`

    await sock.sendMessage(jid, {
      image: { url: profile.avatarUrl },
      caption: message
    }, { quoted: msg })

    return true

  } catch (err) {
    console.error('❌ steamid error:', err)
    await sock.sendMessage(msg.key.remoteJid, {
      text: '❌ *Error al procesar la solicitud*\n\n' +
            err.message + '\n\n' +
            '🔄 Intenta nuevamente en unos segundos.'
    }, { quoted: msg })
    return true
  }
}
