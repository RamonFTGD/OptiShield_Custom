export const meta = {
    name: 'iplocate',
    commands: ['iplocate', 'ip', 'geoip', 'whois'],
    priority: 4,
    premium: true,
    class: 'Seguridad',
    description: 'Geolocalización, WHOIS y análisis de riesgo de IPs',
}

const WHOIS_SKIP = new Set(['Ref', 'OrgAbuseRef', 'OrgTechRef', 'ResourceLink', 'ReferralServer', 'OrgAbuseHandle', 'OrgTechHandle', 'RegDate', 'Updated', 'OriginAS', 'NetHandle', 'Parent'])
const WHOIS_EMOJI = {
    NetRange: '📶', CIDR: '🔢', NetName: '🏷️', NetType: '🔌', Organization: '🏢', OrgName: '🏢', OrgId: '🪪',
    Address: '🏠', City: '🏙️', StateProv: '📍', PostalCode: '📮', Country: '🏳️',
    OrgAbuseName: '🚨', OrgAbusePhone: '📞', OrgAbuseEmail: '📧', OrgTechName: '🛠️', OrgTechPhone: '📞', OrgTechEmail: '📧',
    Comment: '💬', descr: '📝', 'abuse-mailbox': '📧',
}

function formatWhoisValue(value) {
    if (Array.isArray(value)) return value.length <= 3 ? value.join(' | ') : '\n' + value.map(v => `     • ${v}`).join('\n')
    return value || 'N/A'
}

function buildWhoisSection(whois) {
    if (!whois || typeof whois !== 'object' || Object.keys(whois).length === 0) return ''
    const lines = []
    for (const [key, value] of Object.entries(whois)) {
        if (WHOIS_SKIP.has(key)) continue
        if (!value || (Array.isArray(value) && value.length === 0) || value === '') continue
        const emoji = WHOIS_EMOJI[key] || '▪️'
        lines.push(`${emoji} *${key}:* ${formatWhoisValue(value)}`)
    }
    return lines.join('\n')
}

function buildRiskSection(risk) {
    if (!risk) return null
    if (risk.is_private) return `🏠 *Tipo:* IP Privada\n🟢 *Nivel:* Sin riesgo`
    const levelEmoji = risk.level === 'high' ? '🔴' : risk.level === 'medium' ? '🟠' : '🟢'
    const levelText  = risk.level === 'high' ? 'ALTO' : risk.level === 'medium' ? 'MEDIO' : 'BAJO'
    const flags = [risk.is_tor && '🕵️ TOR', risk.is_vpn && '🔒 VPN', risk.is_proxy && '↩️ Proxy', risk.is_datacenter && '🖥️ Datacenter'].filter(Boolean)
    const lines = [`${levelEmoji} *Riesgo:* ${levelText}`]
    if (flags.length > 0) flags.forEach(f => lines.push(`   • ${f}`))
    else lines.push(`   • ✅ Sin indicadores`)
    return lines.join('\n')
}

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/

export default async function (msg, sock, ctx) {
    const chatId = msg.key.remoteJid
    const ip = ctx.args[0]?.trim()

    if (!ip) {
        await sock.sendMessage(chatId, {
            text:
                `🌐 *IPLocate*
${'─'.repeat(28)}
Geolocalización, WHOIS y análisis de riesgo.

◆ ${'.ip <dirección IP>'}

◆ .ip 8.8.8.8

◦ País, ciudad, ISP y ASN
◦ VPN / TOR / Proxy
◦ WHOIS completo
◦ Google Maps

⚡ OptiShield`
        }, { quoted: msg })
        return true
    }

    if (!IP_REGEX.test(ip)) {
        await sock.sendMessage(chatId, { text: '❌ Formato inválido. Ejemplo: .ip 8.8.8.8' }, { quoted: msg })
        return true
    }

    try {
        await sock.sendMessage(chatId, { react: { text: '🔍', key: msg.key } })
        const { key: statusKey } = await sock.sendMessage(chatId, { text: '🌐 Consultando...' }, { quoted: msg })
        const update = text => sock.sendMessage(chatId, { text, edit: statusKey }).catch(() => {})
        const res = await global.OptiShield.callApi('IPLocate', { ip })
        const r = res?.result?.result

        if (!res?.result?.ok || !r) {
            await update(`❌ ${res?.result?.error || res?.error || 'No se encontró información'}`)
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } })
            return true
        }

        const lines = [
            `╔══════════════════════`,
            `║  🔍 *IP LOOKUP*`,
            `╚══════════════════════`,
            ``,
            `🌐 *IP:* ${r.ip || ip}`,
            `🏳️ *País:* ${r.country || 'N/A'}${r.country_code ? ` (${r.country_code})` : ''}`,
            r.region && r.region !== 'Unknown' && `🗺️ *Región:* ${r.region}`,
            r.city && r.city !== 'Unknown' && `🏙️ *Ciudad:* ${r.city}`,
            r.isp && r.isp !== 'Unknown' && `📡 *ISP:* ${r.isp}`,
            r.org && `🏢 *Org:* ${r.org}`,
            r.asn && `🔢 *ASN:* ${r.asn}`,
            r.timezone && `🕐 *Timezone:* ${r.timezone}`,
            r.latitude != null && r.longitude != null && `📍 *Coords:* ${r.latitude}, ${r.longitude}`,
            r.locate && `🗺️ *Mapa:* ${r.locate}`,
            ``,
            `⚡ *Ping:* ${r.ping ?? 'N/A'} ms`,
        ].filter(l => l !== null).join('\n')

        let text = lines
        const riskSection = buildRiskSection(r.risk)
        const whoisSection = buildWhoisSection(r.whois)

        if (riskSection) text += `\n\n${'━'.repeat(28)}\n🛡️ *Riesgo*\n${'━'.repeat(28)}\n${riskSection}`
        if (whoisSection) text += `\n\n${'━'.repeat(28)}\n📋 *WHOIS*\n${'━'.repeat(28)}\n${whoisSection}`

        await update(text.trim())
        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } })

    } catch (err) {
        console.error('❌ IPLOCATE ERROR:', err)
        await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}` }, { quoted: msg })
        await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } })
    }
    return true
}
