export const meta = {
    name: 'minecraft-user-search',
    commands: ['mcuser', 'minecraft'],
    priority: 4,
    class: 'Herramientas',
    premium: true,
    description: 'Busca información de un usuario de Minecraft por su nombre'
}

export default async function (msg, sock, ctx) {
    const chatId = msg.key.remoteJid
    const username = ctx.args[0]
    const apikey = ctx?.info?.user?.apikey

    if (!username) {
        await sock.sendMessage(chatId, { text: '❌ Usa: mcuser <usuario>' }, { quoted: msg })
        return true
    }

    if (!apikey) {
        await sock.sendMessage(chatId, { text: '❌ API key no configurada' }, { quoted: msg })
        return true
    }

    const res = await global.OptiShield.callApi('minecraft-user-search', { user: username, apikey })
    console.log(res)

    if (res.error) {
        await sock.sendMessage(
            chatId,
            { text: `❌ ${res?.error || 'Error desconocido en la API'}` },
            { quoted: msg }
        )
        return true
    }

    if (!res?.result) {
        await sock.sendMessage(
            chatId,
            { text: '❌ No se encontró información para ese usuario de Minecraft' },
            { quoted: msg }
        )
        return true
    }

    const r = res.result

    const skin = r.skin
    const avatars = r.avatars

    const text = [
        `╔══════════════════════`,
        `║  ⛏️ *MINECRAFT USER*`,
        `╚══════════════════════`,
        ``,
        `👤 *Usuario:* ${r.username || 'N/A'}`,
        `🪪 *UUID:* ${r.uuid || 'N/A'}`,
        `🔑 *UUID Raw:* ${r.uuidRaw || 'N/A'}`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `🎨 *SKIN*`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `👕 *Modelo:* ${skin?.model || 'N/A'}`,
        `✏️ *Personalizada:* ${skin?.isCustom ? 'Sí' : 'No'}`,
        skin?.url ? `🔗 *Skin URL:* ${skin.url}` : null,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `🖼️ *AVATARES*`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        avatars?.face    ? `😊 *Cara:* ${avatars.face}` : null,
        avatars?.head3D  ? `🗿 *Cabeza 3D:* ${avatars.head3D}` : null,
        avatars?.body3D  ? `🧍 *Cuerpo 3D:* ${avatars.body3D}` : null,
        avatars?.skin    ? `👔 *Skin:* ${avatars.skin}` : null,
        avatars?.cape    ? `🧣 *Capa:* ${avatars.cape}` : null,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `🔗 *LINKS*`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        r.namemc ? `🌐 *NameMC:* ${r.namemc}` : null,
    ].filter(l => l !== null).join('\n')

    await sock.sendMessage(chatId, { text: text.trim() }, { quoted: msg })
    return true
}
