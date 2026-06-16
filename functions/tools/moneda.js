import { reply } from '../../lib/utils.js'

export const meta = {
  name: 'Currency',
  commands: ['moneda', 'dolar', 'euro', 'exchange', 'tipoambio'],
  priority: 4,
  premium: true,
  class: 'Herramientas',
  description: 'Consulta el tipo de cambio de monedas en tiempo real'
}

export default async function (msg, sock, ctx) {
  const { chatId } = ctx
  const { key: logKey } = await sock.sendMessage(chatId, { text: '💱 Consultando tipos de cambio...' }, { quoted: msg })

  try {
    const res = await global.OptiShield.callApi('moneda', {})
    if (res.error) { await sock.sendMessage(chatId, { text: `❌ ${res.error}`, edit: logKey }); return true }

    const rates = res.result?.rates || res.result?.data || res.result
    if (!rates || typeof rates !== 'object') { await sock.sendMessage(chatId, { text: '❌ No se pudieron obtener las tasas', edit: logKey }); return true }

    let text = `💱 *Tasas de cambio*
${'━'.repeat(28)}\n\n`

    const currencies = {
      'USD': '🇺🇸 Dólar', 'EUR': '🇪🇺 Euro', 'GBP': '🇬🇧 Libra',
      'JPY': '🇯🇵 Yen', 'CAD': '🇨🇦 Dólar Canadiense', 'AUD': '🇦🇺 Dólar Australiano',
      'CHF': '🇨🇭 Franco Suizo', 'CNY': '🇨🇳 Yuan', 'BRL': '🇧🇷 Real',
      'ARS': '🇦🇷 Peso Argentino', 'CLP': '🇨🇱 Peso Chileno', 'COP': '🇨🇴 Peso Colombiano',
      'PEN': '🇵🇪 Sol', 'UYU': '🇺🇾 Peso Uruguayo', 'MXN': '🇲🇽 Peso Mexicano',
    }

    for (const [code, name] of Object.entries(currencies)) {
      const rate = rates[code] || rates[code.toLowerCase()]
      if (rate) text += `${name}: *${Number(rate).toFixed(4)}*\n`
    }

    text += `\n${'━'.repeat(28)}\n⚡ OptiShield Exchange`
    await sock.sendMessage(chatId, { text, edit: logKey })

  } catch (err) {
    console.error('❌ Moneda error:', err)
    await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}`, edit: logKey })
  }
  return true
}
