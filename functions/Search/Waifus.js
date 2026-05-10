import sharp from 'sharp'
import { spawn } from 'child_process'
import { downloadContentFromMessage } from '@whiskeysockets/baileys'

async function downloadMedia(message, type) {
    try {
        const stream = await downloadContentFromMessage(message, type, {}, { timeoutMs: 120_000 })
        const chunks = []
        for await (const chunk of stream) chunks.push(chunk)
        const buffer = Buffer.concat(chunks)
        if (!buffer.length) throw new Error('Buffer vacío')
        return buffer
    } catch (err) {
        console.error('❌ Error descargando media:', err.message)
        throw new Error('NO_DOWNLOAD')
    }
}

function runFfmpeg(args, inputBuffer) {
    return new Promise((resolve, reject) => {
        const proc = spawn('ffmpeg', args)
        
        const chunks = []
        proc.stdout.on('data', (chunk) => chunks.push(chunk))
        
        let stderr = ''
        proc.stderr.on('data', (data) => {
            stderr += data.toString()
        })
        
        proc.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`FFmpeg code ${code}: ${stderr.slice(-500)}`))
            } else {
                resolve(Buffer.concat(chunks))
            }
        })
        
        proc.on('error', reject)
        

        proc.stdin.on('error', () => {})
        
        proc.stdin.write(inputBuffer)
        proc.stdin.end()
    })
}

export const meta = {
    name: 'ver',
    commands: ['ver', 'revelar'],
    priority: 4,
    class: 'Herramientas',
}

function getQuoted(msg) {
    return msg.message?.extendedTextMessage?.contextInfo || null
}

export default async function (msg, sock, ctx) {
    const chatId = msg.key.remoteJid

    const context = getQuoted(msg)
    if (!context?.quotedMessage) {
        await sock.sendMessage(chatId, { text: '❌ Debes responder a una imagen, video o audio' }, { quoted: msg })
        return true
    }

    let quoted = context.quotedMessage
    if (quoted.viewOnceMessageV2) quoted = quoted.viewOnceMessageV2.message
    else if (quoted.viewOnceMessage) quoted = quoted.viewOnceMessage.message

    const quotedText =
        quoted.imageMessage?.caption ||
        quoted.videoMessage?.caption ||
        quoted.extendedTextMessage?.text || ''

    
    if (quoted.imageMessage) {
        try {
            const buffer = await downloadMedia(quoted.imageMessage, 'image')
            const output = await sharp(buffer).jpeg({ quality: 90 }).toBuffer()
            await sock.sendMessage(chatId, { image: output, caption: quotedText }, { quoted: msg })
        } catch (e) {
            console.error(e)
            await sock.sendMessage(chatId, { text: '❌ Error revelando imagen' }, { quoted: msg })
        }
        return true
    }

    
    if (quoted.videoMessage) {
        try {
            const buffer = await downloadMedia(quoted.videoMessage, 'video')

            const output = await runFfmpeg([
                '-y',
                '-i', 'pipe:0',
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '23',
                '-c:a', 'aac',
                '-b:a', '128k',
                '-movflags', '+frag_keyframe+empty_moov+default_base_moof',
                '-pix_fmt', 'yuv420p',
                '-f', 'mp4',
                'pipe:1'
            ], buffer)

            await sock.sendMessage(chatId, { video: output, caption: quotedText || '' }, { quoted: msg })
        } catch (e) {
            console.error(e)
            await sock.sendMessage(chatId, {
                text: '❌ No se pudo revelar el video\n⚠️ Posibles causas:\n• El video expiró\n• Es demasiado pesado\n• WhatsApp bloqueó la descarga'
            }, { quoted: msg })
        }
        return true
    }

    
    if (quoted.audioMessage) {
        try {
            const buffer = await downloadMedia(quoted.audioMessage, 'audio')

            const output = await runFfmpeg([
                '-y',
                '-i', 'pipe:0',
                '-vn',
                '-ar', '44100',
                '-ac', '2',
                '-b:a', '192k',
                '-f', 'mp3',
                'pipe:1'
            ], buffer)

            await sock.sendMessage(chatId, { audio: output, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg })
        } catch (e) {
            console.error(e)
            await sock.sendMessage(chatId, { text: '❌ Error revelando audio' }, { quoted: msg })
        }
        return true
    }

    await sock.sendMessage(chatId, { text: '❌ El mensaje no contiene media compatible' }, { quoted: msg })
    return true
}
