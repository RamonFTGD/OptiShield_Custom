import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { sendInteractiveMessage } = require('gifted-btns')

export const meta = {
  name: 'weather',
  commands: ['clima', 'weather', 'tiempo'],
  priority: 4,
  premium: true,
  class: 'Herramientas',
}

export default async function (msg, sock, ctx) {
  const chatId = msg.key.remoteJid
  const { info } = ctx
  const args = ctx.args.join(' ').trim()

  if (!args) {
    await sendInteractiveMessage(sock, chatId, {
      title: '🌤️ Weather',
      text:
        `🌤️ *CLIMA EN TIEMPO REAL*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Obtén el clima actual y pronóstico de 7 días de cualquier ciudad.\n\n` +
        `*Ejemplos:*\n` +
        `• \`.clima Colima\`\n` +
        `• \`.clima Ciudad de México\`\n` +
        `• \`.clima New York\`\n` +
        `• \`.clima Tokyo\``,
      footer: 'OptiShield • Weather',
      interactiveButtons: [
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({ display_text: '🇲🇽 Colima', id: '.clima Colima' })
        },
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({ display_text: '🏙️ CDMX', id: '.clima Ciudad de Mexico' })
        },
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({ display_text: '🗽 New York', id: '.clima New York' })
        }
      ]
    })
    return true
  }

  try {
    await sock.sendMessage(chatId, { react: { text: '🌡️', key: msg.key } })

    const apiResponse = await global.OptiShield.callApi('weather', { city: args, lang: 'es' })
    const r = apiResponse?.result

    if (!r?.ok) throw new Error(r?.error || 'No se pudo obtener el clima')

    const cur = r.current

    const uvText = (uv) => {
      if (uv <= 2)  return `${uv} 🟢 Bajo`
      if (uv <= 5)  return `${uv} 🟡 Moderado`
      if (uv <= 7)  return `${uv} 🟠 Alto`
      if (uv <= 10) return `${uv} 🔴 Muy alto`
      return `${uv} 🟣 Extremo`
    }

    let caption =
      `${cur.icon} *${r.city}, ${r.country}*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🌡️ *Temperatura:* ${cur.temp}°C (sensación ${cur.feels_like}°C)\n` +
      `☁️ *Condición:* ${cur.description}\n` +
      `💧 *Humedad:* ${cur.humidity}%\n` +
      `💨 *Viento:* ${cur.wind_kph} km/h\n` +
      `🌧 *Lluvia:* ${cur.rain_mm} mm\n` +
      `☀️ *UV:* ${uvText(cur.uv_index)}\n\n` +
      `📅 *Pronóstico 7 días*\n` +
      `━━━━━━━━━━━━━━━━━━\n`

    for (const day of r.forecast) {
      caption +=
        `${day.icon} *${day.day}* — ${day.temp_max}°↑ ${day.temp_min}°↓` +
        `${day.rain_mm > 0 ? ` 🌧 ${day.rain_mm}mm` : ''}` +
        `\n`
    }

    caption += `\n📍 _${r.lat}, ${r.lon} · ${r.timezone}_`

    await sock.sendMessage(chatId, { text: caption }, { quoted: msg })

    await sendInteractiveMessage(sock, chatId, {
      title: `${cur.icon} ${r.city}`,
      text:
        `${cur.icon} *${r.city}, ${r.country}*\n` +
        `🌡️ ${cur.temp}°C — ${cur.description}\n\n` +
        `_Ciudades relacionadas o consultar otra:_`,
      footer: 'OptiShield • Weather',
      interactiveButtons: [
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({ display_text: '🔄 Actualizar', id: `.clima ${args}` })
        },
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({ display_text: '🌍 Otra ciudad', id: '.clima' })
        },
        {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: '🗺️ Ver en mapa',
            url: `https://www.google.com/maps?q=${r.lat},${r.lon}`
          })
        }
      ]
    })

    await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } })

  } catch (err) {
    console.error('❌ WEATHER ERROR:', err)
    await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}` }, { quoted: msg })
    await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } })
  }

  return true
}
