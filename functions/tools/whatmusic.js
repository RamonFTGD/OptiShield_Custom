import { createRequire } from 'module'
import { downloadMediaMessage } from '@whiskeysockets/baileys'
const require = createRequire(import.meta.url)
const { sendInteractiveMessage } = require('gifted-btns')

export const meta = {
  name: 'whatmusic',
  commands: ['whatmusic', 'quecancion', 'shazam'],
  priority: 4,
  premium: true,
  class: 'Herramientas'
}

export default async function (msg, sock, ctx) {
  const chatId = msg.key.remoteJid
  const { info } = ctx

  const fullText =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    msg.message?.audioMessage?.caption ||
    ''

  if (!/^\.?(whatmusic|quecancion|quécanción|shazam)$/i.test(fullText.trim())) {
    return false
  }

  const quoted = msg.message?.extendedTextMessage?.contextInfo
  const messageTypes = quoted?.quotedMessage || msg.message
  const hasMedia = !!(messageTypes.audioMessage || messageTypes.videoMessage)

  if (!hasMedia) {
    await sock.sendMessage(chatId, {
      text:
        '📌 *Responde a un audio/video/nota de voz* o envía uno junto con el comando.\n\n' +
        'Ejemplo: .whatmusic (respondiendo a un audio)\no envía el audio con el comando.'
    }, { quoted: msg })
    return true
  }

  await sock.sendMessage(chatId, { react: { text: '🎵', key: msg.key } })

  const { key: statusKey } = await sock.sendMessage(chatId, {
    text: '⏳ Subiendo archivo y analizando...'
  }, { quoted: msg })

  const update = text => sock.sendMessage(chatId, { text, edit: statusKey }).catch(() => { })

  try {
    const buffer = await downloadMediaMessage(
      quoted?.quotedMessage ? { message: quoted.quotedMessage } : msg,
      'buffer',
      {}
    )
    if (!buffer || buffer.length === 0) throw new Error('No se pudo descargar el archivo')

    await update('⏳ Analizando con Shazam...')

    const uploadResponse = await global.OptiShield.uploadFile(buffer)
    const mediaUrl = uploadResponse.archivo

    const apiResponse = await global.OptiShield.callApi('whatmusic', { url: mediaUrl })

    if (!apiResponse.result?.success) throw new Error('No se pudo reconocer la canción')

    const song = apiResponse.result
    const yt = song.youtube

    let infoText = `🎵 *${song.title || 'Canción reconocida'}*\n`
    infoText += `🎤 *${song.artist || 'Artista desconocido'}*\n`
    infoText += `━━━━━━━━━━━━━━━━━━\n`
    if (song.album) infoText += `💿 *Álbum:* ${song.album}\n`
    if (song.releaseDate) infoText += `📅 *Fecha:* ${song.releaseDate}\n`
    if (song.label) infoText += `🏷️ *Sello:* ${song.label}\n`
    if (yt?.url) {
      infoText += `\n📺 *YouTube*\n`
      if (yt.channel) infoText += `   📡 ${yt.channel}\n`
      if (yt.duration) infoText += `   ⏱️ ${yt.duration}\n`
      infoText += `   🔗 ${yt.url}\n`
    }
    infoText += `\n⚡ *Método:* ${song.recognitionMethod || 'Shazam'} • ${song.ping}ms`

    const buttons = []
    if (yt?.url) {
      buttons.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🎵 Descargar MP3', id: `.play ${yt.url}` }) })
      buttons.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🎬 Descargar MP4', id: `.play2 ${yt.url}` }) })
    }
    if (song.spotify) {
      buttons.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🟢 Descargar Spotify', id: `.spotify ${song.spotify}` }) })
    }

    await update('✅ ¡Canción reconocida!')

    if (buttons.length > 0) {
      const opts = {
        title: `🎵 ${song.title || 'Canción reconocida'}`,
        text: infoText,
        footer: 'OptiShield • WhatMusic',
        interactiveButtons: buttons
      }
      if (yt?.thumbnail) opts.image = { url: yt.thumbnail }
      await sendInteractiveMessage(sock, chatId, opts)
    } else {

      if (yt?.thumbnail) {
        await sock.sendMessage(chatId, { image: { url: yt.thumbnail }, caption: infoText }, { quoted: msg })
      } else {
        await sock.sendMessage(chatId, { text: infoText }, { quoted: msg })
      }
    }

    await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } })

  } catch (err) {
    console.error('❌ WHATMUSIC ERROR:', err)
    await update(`❌ Error: ${err.message || 'No se pudo reconocer la canción'}`)
    await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } })
  }

  return true
}
