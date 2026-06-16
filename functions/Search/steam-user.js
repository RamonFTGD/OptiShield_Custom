export const meta = {
  name: 'steam-search-user',
  commands: ['steam', 'steamuser', 'steamprofile'],
  priority: 4,
  class: 'Buscadores',
  premium: true,
  description: 'Busca perfiles de Steam por ID o vanity URL',
}

const ID_REGEX = /^\d{17}$/
const VANITY_REGEX = /^[a-zA-Z0-9_-]{2,32}$/

function formatBan(status, label) {
  const icon = status ? '✅' : '❌'
  const text = status ? 'Sin bans' : 'Baneado'
  return `${icon} ${label}: ${text}`
}

function formatHours(h) {
  if (!h || h === 'N/A' || h === '0') return '0 horas'
  const num = typeof h === 'string' ? parseInt(h.replace(/[^0-9]/g, '')) : h
  if (isNaN(num)) return String(h)
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K horas`
  return `${num.toLocaleString()} horas`
}

export default async function (msg, sock, ctx) {
  const { chatId, args, apikey } = ctx
  const query = args.join(' ').trim()

  if (!query) {
    await sock.sendMessage(chatId, {
      text: '╔══════════════════╗\n' +
            '║  🎮 STEAM USER   ║\n' +
            '╚══════════════════╝\n\n' +
            '❌ *Uso:* `.steam <ID o vanity>`\n\n' +
            '📝 *Ejemplos:*\n' +
            '• `.steam 76561199564497299` — Por SteamID64\n' +
            '• `.steam vanish` — Por vanity URL (custom URL)\n\n' +
            '💡 *Tip:* Busca tu perfil en steamcommunity.com\n' +
            'y copia tu SteamID64 o tu custom URL'
    }, { quoted: msg })
    return true
  }

  const isId = ID_REGEX.test(query)
  const isValidVanity = VANITY_REGEX.test(query)

  if (!isId && !isValidVanity) {
    await sock.sendMessage(chatId, {
      text: '❌ *Formato inválido*\n\n' +
            '✅ El SteamID debe ser un número de *17 dígitos*\n' +
            '✅ La vanity URL solo usa letras, números, _ y -\n' +
            '📝 Ejemplo ID: 76561199564497299\n' +
            '📝 Ejemplo vanity: vanish47'
    }, { quoted: msg })
    return true
  }

  const { key: logKey } = await sock.sendMessage(chatId, {
    text: '🔍 *Buscando perfil de Steam...*'
  }, { quoted: msg })

  const edit = async (text) => {
    try { await sock.sendMessage(chatId, { text, edit: logKey }) } catch { }
  }

  try {
    const res = await global.OptiShield.callApi('steam-search-id', {
      id: query,
      apikey,
    })

    if (res.error || !res?.result?.success) {
      await edit('❌ *Perfil no encontrado*\n\n' +
                 'Verifica que el ID o vanity URL sean correctos.\n' +
                 (res.error ? `\n📎 ${res.error}` : ''))
      return true
    }

    const data = res.result
    const profile = data.profile || {}
    const ids = data.ids || {}
    const bans = data.bans || {}
    const hours = data.hours || {}

    const message =
      '🎮 *PERFIL DE STEAM*\n' +
      '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      `👤 *${profile.username || 'Desconocido'}*\n` +
      (profile.nivel ? `⭐ Nivel: ${profile.nivel}\n` : '') +
      (profile.antiguedad ? `📅 Miembro desde: ${profile.antiguedad}\n` : '') +
      (profile.estado ? `🟢 Estado: ${profile.estado}\n` : '') +
      (profile.valorAproximado ? `💰 Valor cuenta: ${profile.valorAproximado}\n` : '') +
      (profile.rating ? `⭐ Rating: ${profile.rating}/5 (${profile.ratingCount || 0} votos)\n` : '') +
      '\n━━━━━━━━━━━━━━━━━━━━━━\n' +
      '🆔 *IDENTIFICADORES*\n' +
      `• SteamID: ${ids.steamId || 'N/A'}\n` +
      `• Steam2: ${ids.steam2Id || 'N/A'}\n` +
      `• Steam3: ${ids.steam3Id || 'N/A'}\n` +
      `• AccountID: ${ids.accountId || 'N/A'}\n` +
      (ids.fivemHex ? `• FiveM Hex: ${ids.fivemHex}\n` : '') +
      '\n━━━━━━━━━━━━━━━━━━━━━━\n' +
      '🔒 *BANS Y RESTRICCIONES*\n' +
      `${formatBan(bans.gameBans, 'Game Bans')}\n` +
      `${formatBan(bans.vacBans, 'VAC Bans')}\n` +
      `${formatBan(bans.communityBan, 'Community Ban')}\n` +
      `${formatBan(bans.tradeBan, 'Trade Ban')}\n` +
      '\n━━━━━━━━━━━━━━━━━━━━━━\n' +
      '⏱️ *HORAS JUGADAS*\n' +
      `• Total: ${formatHours(hours.total)}\n` +
      `• Windows: ${formatHours(hours.windows)}\n` +
      `• Linux: ${formatHours(hours.linux)}\n` +
      `• macOS: ${formatHours(hours.macos)}\n` +
      '\n━━━━━━━━━━━━━━━━━━━━━━\n' +
      (data.ping ? `⏱️ Tiempo: ${data.ping}ms\n` : '') +
      '⚡ OptiShield'

    const avatarUrl = profile.avatarUrl || profile.avatar

    if (avatarUrl) {
      await sock.sendMessage(chatId, {
        image: { url: avatarUrl },
        caption: message,
      }, { quoted: msg })
    } else {
      await edit(message)
    }

  } catch (err) {
    console.error('[steam] Error:', err.message)
    await edit(`❌ *Error al buscar perfil*\n\n${err.message}\n\n🔄 Intenta de nuevo en unos segundos.`)
  }

  return true
}
