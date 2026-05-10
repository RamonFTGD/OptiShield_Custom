export const meta = {
    name: 'fakeq',
    commands: ['fakeq'],
    priority: 4,
    class: 'Fun',
    description: 'Envía un mensaje con un quoted falso de cualquier usuario'
}

export default async function (msg, sock, ctx) {
    const {
        chatId,
        participants,
        isGroup,
        args,
        text
    } = ctx

    const input = text.replace(/^[.!/#$]?fakeq\s*/i, '').trim()

    if (!input) {
        await sock.sendMessage(chatId, { text: _helpText() }, { quoted: msg })
        return true
    }
    const ctxInfo   = msg.message?.extendedTextMessage?.contextInfo
    const quotedMsg = ctxInfo?.quotedMessage

    const parts = input.split('|').map(p => p.trim())

    if (quotedMsg && !_startsWithUserRef(parts[0])) {
        const senderJid = ctxInfo?.participant || ctxInfo?.remoteJid || msg.key.remoteJid

        let fakeText, botMessage

        if (parts.length >= 2) {
            fakeText   = parts[0] || _extractQuotedText(quotedMsg)
            botMessage = parts[parts.length - 1]
        } else {
            fakeText   = _extractQuotedText(quotedMsg)
            botMessage = parts[0]
        }

        await _sendFakeQuoted(sock, chatId, { senderJid, fakeText, botMessage, originalMsg: msg })
        return true
    }

    const mentionMatch = parts[0].match(/^@(\S+)$/)
    if (mentionMatch) {
        const tag      = mentionMatch[1]
        const fakeText = parts[1] || '...'
        const botMsg   = parts[2] || fakeText

        const senderJid = _resolveJidFromTag(tag, participants)

        if (!senderJid) {
            await sock.sendMessage(chatId, {
                text: `⚠️ No encontré al usuario *@${tag}* en el grupo`
            }, { quoted: msg })
            return true
        }

        await _sendFakeQuoted(sock, chatId, {
            senderJid,
            fakeText,
            botMessage: botMsg,
            originalMsg: msg
        })
        return true
    }

    const numberMatch = parts[0].match(/^(\d{7,15})$/)
    if (numberMatch) {
        const number   = numberMatch[1]
        const fakeText = parts[1] || '...'
        const botMsg   = parts[2] || fakeText

        const senderJid = `${number}@s.whatsapp.net`

        await _sendFakeQuoted(sock, chatId, {
            senderJid,
            fakeText,
            botMessage: botMsg,
            originalMsg: msg
        })
        return true
    }

    await sock.sendMessage(chatId, { text: _helpText() }, { quoted: msg })
    return true
}

async function _sendFakeQuoted(sock, chatId, { senderJid, fakeText, botMessage, originalMsg }) {
    try {
        const fakeQuotedMsg = {
            key: {
                remoteJid:   chatId,
                fromMe:      false,
                id:          _generateFakeId(),
                participant: senderJid
            },
            message: {
                conversation: fakeText
            },
            pushName: _phoneFromJid(senderJid)
        }

        await sock.sendMessage(
            chatId,
            { text: botMessage },
            { quoted: fakeQuotedMsg }
        )

    } catch (err) {
        console.error('❌ fakeq error:', err.message)
        await sock.sendMessage(chatId, {
            text: '❌ Error al enviar el fake quoted: ' + err.message
        }, { quoted: originalMsg })
    }
}

function _startsWithUserRef(segment = '') {
    return /^@\S+$/.test(segment.trim()) || /^\d{7,15}$/.test(segment.trim())
}

function _resolveJidFromTag(tag, participants = []) {
    const clean = tag.replace(/\D/g, '')
    if (!clean) return null

    const found = participants.find(p => {
        const jid = p.id || p.jid || (typeof p === 'string' ? p : '')
        return jid.includes(clean)
    })

    if (found) return found.id || found.jid || found
    if (clean.length >= 7) return `${clean}@s.whatsapp.net`
    return null
}

function _extractQuotedText(quotedMsg) {
    if (!quotedMsg) return '...'
    return (
        quotedMsg.conversation                    ||
        quotedMsg.extendedTextMessage?.text        ||
        quotedMsg.imageMessage?.caption            ||
        quotedMsg.videoMessage?.caption            ||
        '[media]'
    )
}

function _generateFakeId() {
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    return Array.from({ length: 16 }, () => c[Math.floor(Math.random() * c.length)]).join('')
}

function _phoneFromJid(jid = '') {
    return jid.split('@')[0].split(':')[0]
}

function _helpText() {
    return (
        `📋 *Comando: fakeq*\n` +
        `Envía un mensaje citando (fake) a cualquier usuario\n\n` +

        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *MODO 1 — Por mención*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `fakeq @usuario | _texto que "dijo"_ | _mensaje del bot_\n\n` +
        `Ej: fakeq @5219991234 | Hola a todos! | Así es 👋\n\n` +

        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📞 *MODO 2 — Por número*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `fakeq 521234567890 | _texto que "dijo"_ | _mensaje del bot_\n\n` +
        `Ej: fakeq 5219991234 | Buenos días | Igualmente!\n\n` +

        `━━━━━━━━━━━━━━━━━━━━\n` +
        `↩️ *MODO 3 — Respondiendo a un mensaje*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `_(responde a un msg)_ fakeq | _mensaje del bot_\n` +
        `_(responde a un msg)_ fakeq | _texto falso_ | _mensaje del bot_\n\n` +
        `Ej: fakeq | Eso lo dijo él, no yo!\n` +
        `Ej: fakeq | Quiero pizza | Yo también 🍕\n\n` +

        `💡 El separador es *|* entre cada parte`
    )
}
