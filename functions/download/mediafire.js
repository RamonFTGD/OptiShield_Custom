import https from 'https'
import http from 'http'

export const meta = {
    name: 'mediafire',
    commands: ['mediafire', 'mf'],
    priority: 3,
    premium: true,
    class: 'Descargadores',
}

const MEDIAFIRE_REGEX = /https?:\/\/(www\.)?mediafire\.com\/(file|download|view)\/[^\s]+/i

function downloadToBuffer(url, maxGB = 2.5) {
    return new Promise((resolve, reject) => {
        const maxBytes = maxGB * 1024 * 1024 * 1024
        let received   = 0
        const chunks   = []

        const get = (urlStr) => {
            const lib = urlStr.startsWith('https') ? https : http
            const req = lib.get(urlStr, {
                timeout: 30 * 60 * 1000, // 30 min para archivos grandes
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }, (res) => {
                // Seguir redirecciones
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return get(res.headers.location)
                }

                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP ${res.statusCode}`))
                }

                const contentLength = parseInt(res.headers['content-length'] || '0')
                if (contentLength > maxBytes) {
                    res.destroy()
                    return reject(new Error(`FILE_TOO_LARGE:${contentLength}`))
                }

                res.on('data', chunk => {
                    received += chunk.length
                    if (received > maxBytes) {
                        res.destroy()
                        return reject(new Error(`FILE_TOO_LARGE:${received}`))
                    }
                    chunks.push(chunk)
                })

                res.on('end', () => resolve(Buffer.concat(chunks)))
                res.on('error', reject)
            })

            req.on('error', reject)
            req.on('timeout', () => {
                req.destroy()
                reject(new Error('TIMEOUT'))
            })
        }

        get(url)
    })
}

function formatBytes(bytes) {
    if (!bytes || isNaN(bytes)) return 'N/A'
    const units = ['B', 'KB', 'MB', 'GB']
    let i = 0, val = Number(bytes)
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++ }
    return `${val.toFixed(2)} ${units[i]}`
}

export default async function (msg, sock, ctx) {
    const chatId = msg.key.remoteJid
    const { args } = ctx
    const url = args[0]

    if (!url) {
        await sock.sendMessage(chatId, {
            text:
                '❌ Debes enviar un link de MediaFire\n\n' +
                '📌 *Uso:* .mediafire <url>\n\n' +
                '📎 *Ejemplo:*\n' +
                '.mediafire https://www.mediafire.com/file/abc123/archivo.zip'
        }, { quoted: msg })
        return true
    }

    if (!MEDIAFIRE_REGEX.test(url)) {
        await sock.sendMessage(chatId, {
            text:
                '❌ La URL no es de MediaFire\n\n' +
                '✅ *URLs válidas:*\n' +
                '• https://www.mediafire.com/file/...\n' +
                '• https://mediafire.com/file/...'
        }, { quoted: msg })
        return true
    }

    const { key: logKey } = await sock.sendMessage(chatId, {
        text: '⏳ Obteniendo información del archivo...'
    }, { quoted: msg })

    const updateLog = async (text) => {
        try {
            await sock.sendMessage(chatId, { text, edit: logKey })
        } catch { }
    }

    let res
    try {
        res = await global.OptiShield.callApi('mediafiredl', { url })
    } catch (e) {
        await updateLog(`❌ Error al contactar la API: ${e?.message || 'Error desconocido'}`)
        return true
    }

    if (!res?.result?.file) {
        await updateLog(
            '❌ No se pudo obtener el archivo\n\n' +
            '⚠️ Posibles causas:\n' +
            '• El archivo fue eliminado\n' +
            '• El link es inválido o privado\n' +
            '• Error temporal del servidor'
        )
        return true
    }

    const { file: fileUrl, info } = res.result
    const fileName = info?.nombre  || fileUrl.split('/').pop()
    const fileSize = info?.size    || null
    const mimeType = info?.mimetype || 'application/octet-stream'
    const titulo   = info?.titulo  || fileName

    const MAX_BYTES = 2.5 * 1024 * 1024 * 1024 // 2.5GB

    // Bloquear antes de descargar si ya sabemos que es muy grande
    if (fileSize && Number(fileSize) > MAX_BYTES) {
        await updateLog(
            `⚠️ *Archivo supera el límite de WhatsApp*\n\n` +
            `📦 ${titulo}\n` +
            `💾 Tamaño: ${formatBytes(fileSize)}\n` +
            `🚫 Límite máximo: 2.5GB\n\n` +
            `🔗 Descarga directa:\n${fileUrl}`
        )
        return true
    }

    await updateLog(
        `📥 Descargando *${titulo}*\n` +
        `💾 Tamaño: ${formatBytes(fileSize)}\n\n` +
        `⏳ Esto puede tardar varios minutos para archivos grandes...`
    )

    let buffer
    try {
        buffer = await downloadToBuffer(fileUrl, 2.5)
    } catch (e) {
        if (e.message.startsWith('FILE_TOO_LARGE')) {
            const bytes = e.message.split(':')[1]
            await updateLog(
                `⚠️ *Archivo demasiado grande*\n\n` +
                `📦 ${titulo}\n` +
                `💾 Tamaño real: ${formatBytes(bytes)}\n` +
                `🚫 Límite máximo: 2.5GB\n\n` +
                `🔗 Descarga directa:\n${fileUrl}`
            )
        } else if (e.message === 'TIMEOUT') {
            await updateLog(
                `⏰ *Timeout de descarga*\n\n` +
                `El archivo tardó más de 30 minutos\n\n` +
                `🔗 Descarga directa:\n${fileUrl}`
            )
        } else {
            await updateLog(`❌ Error descargando: ${e.message}\n\n🔗 ${fileUrl}`)
        }
        return true
    }

    await updateLog(
        `📤 Enviando *${titulo}*\n` +
        `💾 ${formatBytes(buffer.length)}\n\n` +
        `⏳ Subiendo a WhatsApp, puede tardar...`
    )

    try {
        await sock.sendMessage(chatId, {
            document: buffer,
            fileName,
            mimetype: mimeType,
            caption:
                `📦 *${titulo}*\n\n` +
                `📄 *Archivo:* ${fileName}\n` +
                `💾 *Tamaño:* ${formatBytes(buffer.length)}\n` +
                `📅 *Fecha:* ${info?.fecha || 'N/A'}\n` +
                `🌍 *Origen:* ${info?.from || 'N/A'}`
        }, { quoted: msg })

        await updateLog(`✅ *${titulo}* enviado correctamente`)

    } catch (e) {
        console.error('❌ Error enviando archivo:', e.message)
        await updateLog(
            `⚠️ *Error al subir a WhatsApp*\n\n` +
            `📦 ${titulo}\n` +
            `💾 ${formatBytes(buffer.length)}\n` +
            `❌ ${e.message}\n\n` +
            `🔗 Descarga directa:\n${fileUrl}`
        )
    }

    buffer = null

    return true
}
