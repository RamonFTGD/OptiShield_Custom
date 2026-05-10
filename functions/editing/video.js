import { downloadMediaMessage } from '@whiskeysockets/baileys'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { sendInteractiveMessage } = require('gifted-btns')

export const meta = {
  name: 'EditVid',
  commands: ['editvid', 'editvideo', 'videdit'],
  priority: 5,
  premium: true,
  class: 'Editores'
}

export default async function (msg, sock, ctx) {
  try {
    const jid    = msg.key.remoteJid
    const quoted = msg.message?.extendedTextMessage?.contextInfo
    const args   = ctx.args.join(' ')

    const urlMatch = args.match(/https?:\/\/[^\s|]+/)

    if (urlMatch) {
      const videoUrl = urlMatch[0]
      const restArgs = args.replace(videoUrl, '').trim()
      if (!restArgs.includes('|')) {
        await sock.sendMessage(jid, { text: '❌ Formato: URL | param valor | ...' }, { quoted: msg })
        return true
      }
      const parts = restArgs.split('|').map(p => p.trim()).filter(p => p)
      if (!parts.length) {
        await sock.sendMessage(jid, { text: '❌ Especifica al menos un efecto' }, { quoted: msg })
        return true
      }
      return await applyEffects(msg, sock, videoUrl, parts, ctx)
    }

    if (!quoted?.quotedMessage) {
      await sock.sendMessage(jid, {
        text: '❌ Responde a un video con .editvid\n\nO usa: `.editvid URL | efecto valor`'
      }, { quoted: msg })
      return true
    }

    if (!quoted?.quotedMessage?.videoMessage) {
      await sock.sendMessage(jid, { text: '❌ El mensaje citado no es un video.' }, { quoted: msg })
      return true
    }

    await sock.sendMessage(jid, { text: '⏳ Procesando video...' }, { quoted: msg })

    const buffer = await downloadMediaMessage({ message: quoted.quotedMessage }, 'buffer', {})
    const res = await global.OptiShield.uploadFile(buffer)
    const videoUrl = res.archivo

    if (!args.includes('|')) return await showMenu(msg, sock, videoUrl)

    const parts = args.split('|').map(p => p.trim()).filter(p => p)
    if (!parts.length) return await showMenu(msg, sock, videoUrl)

    return await applyEffects(msg, sock, videoUrl, parts, ctx)

  } catch (err) {
    console.error('❌ editvid error:', err)
    await sock.sendMessage(msg.key.remoteJid, { text: '❌ Error: ' + err.message }, { quoted: msg })
    return true
  }
}

async function showMenu(msg, sock, videoUrl) {
  const jid = msg.key.remoteJid

  await sendInteractiveMessage(sock, jid, {
    title: '🎬 Editor de Videos',
    text: '🎥 *Video listo para editar*\n\nSelecciona los efectos que quieres aplicar.\n⚠️ El procesamiento puede tardar varios minutos.',
    footer: 'OptiShield • Video Editor Pro',
    interactiveButtons: [
      {
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: '🎬 Elegir efecto',
          sections: [
            {
              title: '🎨 Ajustes de Color',
              rows: [
                { id: `.editvid ${videoUrl} | brightness 0.1`,              title: '☀️ Más Brillo',       description: 'Brillo +10%'             },
                { id: `.editvid ${videoUrl} | brightness -0.1`,             title: '🌙 Menos Brillo',     description: 'Brillo -10%'             },
                { id: `.editvid ${videoUrl} | contrast 1.3`,                title: '🎭 Más Contraste',    description: 'Contraste +30%'          },
                { id: `.editvid ${videoUrl} | saturation 1.5`,              title: '🎨 Más Saturación',   description: 'Colores más vivos'       },
                { id: `.editvid ${videoUrl} | grayscale true`,              title: '🖤 Escala de Grises', description: 'Blanco y negro'          },
                { id: `.editvid ${videoUrl} | negate true`,                 title: '🔄 Invertir Colores', description: 'Negativo del video'      },
                { id: `.editvid ${videoUrl} | saturation 1.4 | contrast 1.2`, title: '🎬 Vivid',         description: 'Saturado + contraste'   },
                { id: `.editvid ${videoUrl} | brightness 0.05 | saturation 1.2`, title: '🌅 Cálido',     description: 'Tonos cálidos'          },
              ]
            },
            {
              title: '✨ Filtros',
              rows: [
                { id: `.editvid ${videoUrl} | blur 2`,                            title: '🌫️ Blur Suave',    description: 'Desenfoque ligero'     },
                { id: `.editvid ${videoUrl} | blur 5`,                            title: '💨 Blur Intenso',  description: 'Desenfoque fuerte'     },
                { id: `.editvid ${videoUrl} | sharpen 1.5`,                       title: '⚡ Más Nitidez',    description: 'Imagen más nítida'     },
                { id: `.editvid ${videoUrl} | gamma 1.5`,                         title: '🔆 Gamma Alto',    description: 'Gamma 1.5'             },
                { id: `.editvid ${videoUrl} | gamma 0.8`,                         title: '🔅 Gamma Bajo',    description: 'Gamma 0.8'             },
                { id: `.editvid ${videoUrl} | gamma 1.2 | contrast 1.1 | saturation 0.9`, title: '🎬 Cinematic', description: 'Efecto cinematográfico' },
                { id: `.editvid ${videoUrl} | sharpen 1.2 | contrast 1.1 | saturation 1.1`, title: '🌟 HD Enhanced', description: 'Calidad mejorada'  },
                { id: `.editvid ${videoUrl} | contrast 1.4 | saturation 1.3 | sharpen 1.1`, title: '🌈 Dramatic',    description: 'Efecto dramático'   },
              ]
            },
            {
              title: '🔄 Transformaciones',
              rows: [
                { id: `.editvid ${videoUrl} | rotate 90`,    title: '🔄 Rotar 90°',          description: 'Girar 90 grados'       },
                { id: `.editvid ${videoUrl} | rotate 180`,   title: '🔁 Rotar 180°',         description: 'Girar 180 grados'      },
                { id: `.editvid ${videoUrl} | rotate 270`,   title: '↩️ Rotar 270°',         description: 'Girar 270 grados'      },
                { id: `.editvid ${videoUrl} | hflip true`,   title: '🌀 Voltear Horizontal', description: 'Espejo horizontal'     },
                { id: `.editvid ${videoUrl} | vflip true`,   title: '↕️ Voltear Vertical',   description: 'Espejo vertical'       },
                { id: `.editvid ${videoUrl} | hflip true | scale 1920`, title: '🪞 Espejo HD', description: 'Espejo + 1080p'      },
              ]
            },
            {
              title: '📏 Resolución',
              rows: [
                { id: `.editvid ${videoUrl} | scale 1280`,  title: '📱 720p HD',      description: '1280px ancho'  },
                { id: `.editvid ${videoUrl} | scale 1920`,  title: '🖥️ 1080p Full HD', description: '1920px ancho'  },
                { id: `.editvid ${videoUrl} | scale 2560`,  title: '🎬 2K QHD',       description: '2560px ancho'  },
                { id: `.editvid ${videoUrl} | scale 3840`,  title: '🎥 4K UHD',       description: '3840px ancho'  },
              ]
            },
            {
              title: '⚡ Velocidad y Audio',
              rows: [
                { id: `.editvid ${videoUrl} | speed 0.5`,  title: '🐌 Cámara Lenta 0.5x', description: 'La mitad de velocidad'   },
                { id: `.editvid ${videoUrl} | speed 0.75`, title: '🐢 Lento 0.75x',        description: '75% de velocidad'       },
                { id: `.editvid ${videoUrl} | speed 1.5`,  title: '🏃 Rápido 1.5x',        description: '150% de velocidad'      },
                { id: `.editvid ${videoUrl} | speed 2.0`,  title: '🚀 Muy Rápido 2x',      description: 'Doble velocidad'        },
                { id: `.editvid ${videoUrl} | speed 3.0`,  title: '⚡ Ultra Rápido 3x',    description: 'Triple velocidad'       },
                { id: `.editvid ${videoUrl} | volume 1.5`, title: '🔊 Volumen 150%',        description: 'Subir volumen'          },
                { id: `.editvid ${videoUrl} | volume 2.0`, title: '📢 Volumen 200%',        description: 'Volumen al doble'       },
                { id: `.editvid ${videoUrl} | fps 30`,     title: '🎬 30 FPS',              description: '30 fotogramas/seg'      },
                { id: `.editvid ${videoUrl} | fps 60`,     title: '🎮 60 FPS',              description: '60 fotogramas/seg'      },
                { id: `.editvid ${videoUrl} | speed 1.5 | scale 1920 | fps 30`, title: '🌟 Rápido + HD', description: '1.5x + 1080p + 30fps' },
              ]
            }
          ]
        })
      }
    ]
  })

  return true
}

async function applyEffects(msg, sock, videoUrl, effectParts, ctx) {
  const jid = msg.key.remoteJid
  try {
    const effectsList = effectParts.map(part => {
      const [param, value] = part.split(' ').map(p => p.trim())
      return `${param}${value ? ` ${value}` : ''}`
    }).join(', ')

    await sock.sendMessage(jid, {
      text: `⏳ Aplicando: *${effectsList}*\n\n⚠️ El procesamiento puede tardar varios minutos...`
    }, { quoted: msg })

    let params = { url: videoUrl, apikey: ctx.apikey }
    for (const part of effectParts) {
      const [param, value] = part.split(' ').map(p => p.trim())
      if (param && value) params[param] = value
    }

    const res = await global.OptiShield.callApi('editvid', params)
    delete params.apikey

    if (!res.result?.url) {
      await sock.sendMessage(jid, { text: `❌ ${res.result?.error || 'Error al procesar el video'}` }, { quoted: msg })
      return true
    }

    const r = res.result
    await sock.sendMessage(jid, {
      video: { url: r.url },
      caption: `✅ *Video editado*\n\n🎬 Efectos: ${r.effects?.join(', ') || effectsList}\n📐 ${r.size || '—'} • ⏱️ ${r.duration || '—'}\n\n💡 Responde con .editvid para más efectos`,
      gifPlayback: false
    }, { quoted: msg })

    return true
  } catch (err) {
    await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` }, { quoted: msg })
    return true
  }
}
