import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { sendInteractiveMessage } = require('gifted-btns')

export const meta = {
  name: 'Waifu',
  commands: ['waifu', 'waifus'],
  priority: 5,
  class: 'Buscadores',
  public: true,
  premium: true
}

const WAIFUS = [
  { name: 'Rem',              series: 'Re:Zero',                      age: 17           },
  { name: 'Ram',              series: 'Re:Zero',                      age: 17           },
  { name: 'Asuna',            series: 'Sword Art Online',             age: 17           },
  { name: 'Nezuko',           series: 'Demon Slayer',                 age: 14           },
  { name: 'Hinata',           series: 'Naruto',                       age: 16           },
  { name: 'Mikasa',           series: 'Attack on Titan',              age: 19           },
  { name: 'Zero Two',         series: 'Darling in the FranXX',        age: 17           },
  { name: 'Marin Kitagawa',   series: 'My Dress-Up Darling',          age: 15           },
  { name: 'Yor Forger',       series: 'Spy x Family',                 age: 27           },
  { name: 'Makima',           series: 'Chainsaw Man',                 age: 'Desconocida'},
  { name: 'Power',            series: 'Chainsaw Man',                 age: 'Desconocida'},
  { name: 'Mai Sakurajima',   series: 'Bunny Girl Senpai',            age: 16           },
  { name: 'Kaguya Shinomiya', series: 'Kaguya-sama',                  age: 17           },
  { name: 'Chika Fujiwara',   series: 'Kaguya-sama',                  age: 16           },
  { name: 'Nami',             series: 'One Piece',                    age: 20           },
  { name: 'Nico Robin',       series: 'One Piece',                    age: 30           },
  { name: 'Emilia',           series: 'Re:Zero',                      age: 18           },
  { name: 'Kurisu Makise',    series: 'Steins;Gate',                  age: 18           },
  { name: 'Violet Evergarden',series: 'Violet Evergarden',            age: 14           },
  { name: 'C.C.',             series: 'Code Geass',                   age: 'Inmortal'   },
  { name: 'Erza Scarlet',     series: 'Fairy Tail',                   age: 19           },
  { name: 'Lucy Heartfilia',  series: 'Fairy Tail',                   age: 17           },
  { name: 'Miku Nakano',      series: 'The Quintessential Quintuplets', age: 17         },
  { name: 'Nino Nakano',      series: 'The Quintessential Quintuplets', age: 17         },
  { name: 'Itsuki Nakano',    series: 'The Quintessential Quintuplets', age: 17         },
  { name: 'Shoko Nishimiya',  series: 'A Silent Voice',               age: 17           },
  { name: 'Rias Gremory',     series: 'High School DxD',              age: 18           },
  { name: 'Aqua',             series: 'KonoSuba',                     age: 'Diosa'      },
  { name: 'Megumin',          series: 'KonoSuba',                     age: 14           },
  { name: 'Darkness',         series: 'KonoSuba',                     age: 18           },
]

export default async function (msg, sock, ctx) {
  const jid    = msg.key.remoteJid
  const query  = ctx.args.join(' ').trim()
  const apikey = ctx?.info?.user?.apikey

  if (!apikey) {
    await sock.sendMessage(jid, { text: '❌ No tienes API Key válida.' })
    return true
  }

  if (!query) {
    const chunkSize = 10
    const sections  = []

    for (let i = 0; i < WAIFUS.length; i += chunkSize) {
      const chunk = WAIFUS.slice(i, i + chunkSize)
      sections.push({
        title: `💕 Waifus ${i + 1}–${i + chunk.length}`,
        rows: chunk.map(w => ({
          id: `.waifu ${w.name}`,
          title: `💕 ${w.name}`,
          description: `${w.series} • 🎂 ${w.age}`
        }))
      })
    }

    await sendInteractiveMessage(sock, jid, {
      title: '💕 Waifu List',
      text:
        `💕 *LISTA DE WAIFUS*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📊 *${WAIFUS.length} waifus disponibles*\n\n` +
        `Selecciona una para ver su imagen o escribe:\n` +
        `*.waifu <nombre>* para búsqueda personalizada`,
      footer: 'OptiShield • Waifu Search ❤️',
      interactiveButtons: [
        {
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '💕 Elegir waifu',
            sections
          })
        }
      ]
    })

    return true
  }

  const statusMsg = await sock.sendMessage(jid, {
    text: `⏳ Buscando a *${query}*...`
  }, { quoted: msg })
  const edit = async (text) => { try { await sock.sendMessage(jid, { text, edit: statusMsg.key }) } catch { } }

  try {
    const res = await global.OptiShield.callApi('pinterestSearch', { query: `${query} anime waifu`, apikey })

    if (res.error || !res?.result?.ok || !res.result.results?.length) {
      await edit(`❌ No se encontraron resultados para *"${query}"*\n\n💡 Usa *.waifu* para ver la lista`)
      return true
    }

    const images = res.result.results.filter(r => typeof r.archivo === 'string' && !r.video)
    if (!images.length) {
      await edit(`⚠️ No hay imágenes válidas para *"${query}"*`)
      return true
    }

    const randomImage = images[Math.floor(Math.random() * images.length)]
    const waifuInfo   = WAIFUS.find(w =>
      w.name.toLowerCase().includes(query.toLowerCase()) ||
      query.toLowerCase().includes(w.name.toLowerCase())
    )

    await edit('✅ Imagen encontrada...')

    await sendInteractiveMessage(sock, jid, {
      title: waifuInfo ? waifuInfo.name : query,
      text:
        `💕 *${waifuInfo ? waifuInfo.name : query}*\n\n` +
        `${waifuInfo ? `📺 *Serie:* ${waifuInfo.series}\n🎂 *Edad:* ${waifuInfo.age}\n` : `🔍 Búsqueda personalizada\n`}\n` +
        `_¿Qué quieres hacer con esta imagen?_`,
      footer: 'OptiShield • Waifu Search ❤️',
      interactiveButtons: [
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({
            display_text: '📷 Ver imagen',
            id: `.pin_image ${randomImage.archivo}`
          })
        },
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({
            display_text: '🎨 Hacer sticker',
            id: `.sticker ${randomImage.archivo}`
          })
        },
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({
            display_text: '🔁 Otra imagen',
            id: `.waifu ${query}`
          })
        }
      ]
    })

  } catch (err) {
    console.error('❌ waifu error:', err)
    await edit(`❌ Error: ${err.message}`)
  }

  return true
}
