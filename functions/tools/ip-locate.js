export const meta = {
    name: 'iplocate',
    commands: ['iplocate', 'ip', 'geoip', 'whois'],
    priority: 4,
    premium: true,
    class: 'Seguridad',
}

const WHOIS_SKIP = new Set([
    'Ref', 'OrgAbuseRef', 'OrgTechRef', 'ResourceLink',
    'ReferralServer', 'OrgAbuseHandle', 'OrgTechHandle',
    'RegDate', 'Updated', 'OriginAS', 'NetHandle', 'Parent'
])

const WHOIS_EMOJI = {
    NetRange:      '📶',
    CIDR:          '🔢',
    NetName:       '🏷️',
    NetType:       '🔌',
    Organization:  '🏢',
    OrgName:       '🏢',
    OrgId:         '🪪',
    Address:       '🏠',
    City:          '🏙️',
    StateProv:     '📍',
    PostalCode:    '📮',
    Country:       '🏳️',
    OrgAbuseName:  '🚨',
    OrgAbusePhone: '📞',
    OrgAbuseEmail: '📧',
    OrgTechName:   '🛠️',
    OrgTechPhone:  '📞',
    OrgTechEmail:  '📧',
    Comment:       '💬',
    descr:         '📝',
    'abuse-mailbox': '📧',
}

function formatWhoisValue(value) {
    if (Array.isArray(value)) {
        return value.length <= 3
            ? value.join(' | ')
            : '\n' + value.map(v => `     • ${v}`).join('\n')
    }
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

    if (risk.is_private) {
        return `🏠 *Tipo:* IP Privada / Local\n🟢 *Nivel:* Sin riesgo`
    }

    const levelEmoji = risk.level === 'high' ? '🔴' : risk.level === 'medium' ? '🟠' : '🟢'
    const levelText  = risk.level === 'high' ? 'ALTO' : risk.level === 'medium' ? 'MEDIO' : 'BAJO'

    const flags = [
        risk.is_tor         && '🕵️ Nodo TOR',
        risk.is_vpn         && '🔒 VPN detectada',
        risk.is_proxy       && '↩️ Proxy',
        risk.is_datacenter  && '🖥️ Datacenter / Hosting',
    ].filter(Boolean)

    const lines = [`${levelEmoji} *Nivel de riesgo:* ${levelText}`]
    if (flags.length > 0) {
        flags.forEach(f => lines.push(`   • ${f}`))
    } else {
        lines.push(`   • ✅ Sin indicadores de riesgo`)
    }

    return lines.join('\n')
}

export default async function (msg, sock, ctx) {
    const chatId = msg.key.remoteJid
    const ip     = ctx.args[0]?.trim()

    if (!ip) {
        await sock.sendMessage(chatId, {
            text:
                '🌐 *IPLocate — Geolocalización & WHOIS*\n\n' +
                'Obtén información detallada de cualquier IP.\n\n' +
                '*Uso:*\n' +
                '• *.ip 8.8.8.8*\n' +
                '• *.whois 1.1.1.1*\n\n' +
                '*Datos obtenidos:*\n' +
                '🔹 País, ciudad, región y timezone\n' +
                '🔹 ISP, organización y ASN\n' +
                '🔹 Detección de VPN / TOR / Proxy\n' +
                '🔹 Rango de red y CIDR (WHOIS)\n' +
                '🔹 Link de ubicación en Google Maps'
        }, { quoted: msg })
        return true
    }

    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
        await sock.sendMessage(chatId, {
            text: '❌ Formato de IP inválido.\n\n*Ejemplo:* .ip 8.8.8.8'
        }, { quoted: msg })
        return true
    }

    try {
        await sock.sendMessage(chatId, { react: { text: '🔍', key: msg.key } })

        const { key: statusKey } = await sock.sendMessage(chatId, {
            text: '🌐 Consultando información...'
        }, { quoted: msg })

        const update = text => sock.sendMessage(chatId, { text, edit: statusKey }).catch(() => {})

        const res = await global.OptiShield.callApi('IPLocate', { ip })

        const r = res?.result?.result

        if (!res?.result?.ok || !r) {
            await update(`❌ ${res?.result?.error || res?.error || 'No se encontró información para esa IP'}`)
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } })
            return true
        }

        const main = [
            `╔══════════════════════`,
            `║  🔍 *IP LOOKUP*`,
            `╚══════════════════════`,
            ``,
            `🌐 *IP:* ${r.ip || ip}`,
            `🏳️ *País:* ${r.country || 'N/A'}${r.country_code ? ` (${r.country_code})` : ''}`,
            r.region && r.region !== 'Unknown'   ? `🗺️ *Región:* ${r.region}`   : null,
            r.city   && r.city   !== 'Unknown'   ? `🏙️ *Ciudad:* ${r.city}`     : null,
            r.isp    && r.isp    !== 'Unknown'   ? `📡 *ISP:* ${r.isp}`         : null,
            r.org                                ? `🏢 *Org:* ${r.org}`         : null,
            r.asn                                ? `🔢 *ASN:* ${r.asn}`         : null,
            r.timezone                           ? `🕐 *Timezone:* ${r.timezone}` : null,
            r.latitude  != null && r.longitude != null
                ? `📍 *Coords:* ${r.latitude}, ${r.longitude}` : null,
            r.locate     ? `🗺️ *Mapa:* ${r.locate}` : null,
            ``,
            `⚡ *Ping:* ${r.ping ?? 'N/A'} ms`,
            `🔎 *Fuente:* ${r.source || 'N/A'}`,
        ].filter(l => l !== null).join('\n')

        const riskSection = buildRiskSection(r.risk)

        const whoisSection = buildWhoisSection(r.whois)

        let text = main

        if (riskSection) {
            text += `\n\n━━━━━━━━━━━━━━━━━━━━━━\n🛡️ *ANÁLISIS DE RIESGO*\n━━━━━━━━━━━━━━━━━━━━━━\n${riskSection}`
        }

        if (whoisSection) {
            text += `\n\n━━━━━━━━━━━━━━━━━━━━━━\n📋 *WHOIS INFO*\n━━━━━━━━━━━━━━━━━━━━━━\n${whoisSection}`
        }

        await update(text.trim())
        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } })

    } catch (err) {
        console.error('❌ IPLOCATE PLUGIN ERROR:', err)
        await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}` }, { quoted: msg })
        await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } })
    }

    return true
}
