import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { sendInteractiveMessage } = require('gifted-btns')

export const meta = {
    name: 'soundcloud',
    commands: ['soundcloud', 'sc', 'scdl', 'soundclouddl', 'sc_download', 'sc_audio'],
    priority: 3,
    premium: true,
    class: 'Descargadores',
}

const SC_REGEX = /soundcloud\.com/i
const URL_REGEX = /^https?:\/\//i
const MAX_TITLE = 80

const isSoundCloudUrl = (url = '') => SC_REGEX.test(url)
const isUrl = (url = '') => URL_REGEX.test(url)
const clamp = (str, n) => str?.length > n ? str.slice(0, n) + '…' : str

function bar(step, total = 4) {
    const pct = Math.round((step / total) * 100)
    const filled = Math.round((step / total) * 12)
    const track = '▰'.repeat(filled) + '▱'.repeat(12 - filled)
    return `${track} ${pct}%`
}

async function log(sock, jid, key, text) {
    try { await sock.sendMessage(jid, { text, edit: key }) } catch (_) { }
}

function buildInteractive(links, downloadUrl, originalUrl) {
    const rows = links.map((link, i) => ({
        id: `.sc_download ${downloadUrl} ${link.type}`,
        title: `📥 ${link.type}`,
        description: link.url.substring(0, 50) + '...'
    }))

    return [
        {
            name: 'single_select',
            buttonParamsJson: JSON.stringify({
                title: '📥 Elegir formato',
                sections: [
                    {
                        title: '🎵 Opciones de descarga',
                        rows: rows
                    }
                ]
            })
        },
        {
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
                display_text: '🔗 Ver en SoundCloud',
                url: originalUrl,
                merchant_url: originalUrl
            })
        }
    ]
}

async function handleDownload(msg, sock, ctx) {
    const jid = msg.key.remoteJid
    const [downloadUrl, ...formatParts] = ctx.text.trim().split(' ')
    const format = formatParts.join(' ') || 'MP3'

    if (!downloadUrl) return true

    const { key: logKey } = await sock.sendMessage(jid,
        { text: `🎵 *Descargando…*\n\n${bar(2)}` },
        { quoted: msg }
    )

    try {
        await log(sock, jid, logKey, `📤 Enviando ${format}…\n\n${bar(3)}`)

        const isAudio = format.toLowerCase().includes('mp3') || format.toLowerCase().includes('audio')

        if (isAudio) {
            await sock.sendMessage(jid, {
                audio: { url: downloadUrl },
                mimetype: 'audio/mpeg',
                ptt: false,
            }, { quoted: msg })
        } else {
            await sock.sendMessage(jid, {
                document: { url: downloadUrl },
                mimetype: 'image/jpeg',
                fileName: format + '.jpg'
            }, { quoted: msg })
        }

        await log(sock, jid, logKey, `${bar(4)}\n\n✅ ¡Descarga completada!`)
    } catch (err) {
        await log(sock, jid, logKey, `❌ Error al descargar\n\n_${err.message}_`)
    }

    return true
}

async function handleMain(msg, sock, ctx) {
    const { args, info } = ctx
    const jid = msg.key.remoteJid
    const apikey = info?.user?.apikey
    const url = args.join(' ').trim()

    if (!url || !isUrl(url)) {
        await sock.sendMessage(jid, {
            text:
                `╔═══════════════════╗\n` +
                `║ 🎵 SoundCloud DL  ║\n` +
                `╚═══════════════════╝\n\n` +
                `❌ Necesitas enviar un link válido\n\n` +
                `*Uso:*\n` +
                `› \`.sc https://soundcloud.com/user/track\``
        }, { quoted: msg })
        return true
    }

    if (!isSoundCloudUrl(url)) {
        await sock.sendMessage(jid, {
            text:
                `❌ El link no es de SoundCloud\n\n` +
                `*Dominio válido:*\n` +
                `• soundcloud.com`
        }, { quoted: msg })
        return true
    }

    if (!apikey) {
        await sock.sendMessage(jid, {
            text: `⚠️ Sin APIKEY — contacta al administrador`
        }, { quoted: msg })
        return true
    }

    const { key: logKey } = await sock.sendMessage(jid,
        { text: `⏳ *Analizando link…*\n\n${bar(0)}` },
        { quoted: msg }
    )

    try {
        await log(sock, jid, logKey, `🔗 Obteniendo información…\n\n${bar(1)}`)

        const res = await global.OptiShield.callApi('soundcloud-dl', { url, apikey })
        const result = res?.result

        if (!result?.success || res?.error) {
            await log(sock, jid, logKey,
                `❌ ${res?.error || 'No se pudo procesar la canción'}\n\n` +
                `💡 Verifica que el link sea público y válido`
            )
            return true
        }

        const trackInfo = result.trackInfo || {}
        const links = result.links || []
        const title = clamp(trackInfo.name || 'SoundCloud Track', MAX_TITLE)
        const artist = trackInfo.artist || ''
        const cover = trackInfo.cover || null
        const primaryLink = links[0]?.url || ''

        if (!primaryLink || links.length === 0) {
            await log(sock, jid, logKey, `❌ No se recibieron enlaces de descarga`)
            return true
        }

        await log(sock, jid, logKey,
            `🎵 *${title}*\n` +
            `${artist ? `👤 ${artist}\n` : ''}` +
            `\n${bar(3)}\n\n🎬 Preparando opciones…`
        )

        const body =
            `🎵 *${title}*\n` +
            `${artist ? `👤 ${artist}\n` : ''}` +
            `\n_Elige el formato de descarga:_`

        const interactiveButtons = buildInteractive(links, primaryLink, url)

        try {
            await sendInteractiveMessage(sock, jid, {
                title: '🎵 SoundCloud Downloader',
                text: body,
                footer: 'OptiShield • SoundCloud DL',
                interactiveButtons,
            })
        } catch (interactiveErr) {
            console.warn('[SoundCloud] interactivo falló:', interactiveErr.message)
            const artistLine = artist ? '👤 ' + artist + '\n' : ''
            let commandList = '*Opciones de descarga:*\n'
            links.forEach((link, i) => {
                commandList += `.sc_download ${link.url} ${link.type}\n`
            })

            await sock.sendMessage(jid, {
                text:
                    '🎵 *SoundCloud Downloader*\n' +
                    '━━━━━━━━━━━━━━━━━━━━━\n' +
                    '🎵 *' + title + '*\n' +
                    artistLine +
                    '\n' + commandList
            }, { quoted: msg })
        }

        await log(sock, jid, logKey,
            `🎵 *${title}*\n` +
            `${artist ? `👤 ${artist}\n` : ''}` +
            `\n${bar(4)}\n\n✅ ¡Selecciona una opción!`
        )

    } catch (err) {
        console.error('[SoundCloud]', err.message)
        await log(sock, jid, logKey,
            `❌ Error inesperado\n\n_${err.message}_\n\n💡 Intenta de nuevo en unos segundos`
        )
    }

    return true
}

export default async function handler(msg, sock, ctx) {
    switch (ctx.command) {
        case 'sc_download': return handleDownload(msg, sock, ctx)
        default: return handleMain(msg, sock, ctx)
    }
}
