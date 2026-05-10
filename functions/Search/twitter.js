import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { sendInteractiveMessage } = require('gifted-btns')

export const meta = {
  name: 'TwitterSearch',
  commands: ['twittersearch', 'xsearch', 'xsh'],
  priority: 5,
  premium: true,
  class: 'Buscadores',
}

export default async function (msg, sock, ctx) {
  const jid    = msg.key.remoteJid
  const query  = ctx.args.join(' ')
  const apikey = ctx.apikey

  if (!query) {
    await sock.sendMessage(jid, { text: '❌ *Debes escribir algo.*\n\nEjemplo: `.xsh futbol`' }, { quoted: msg })
    return true
  }

  if (!apikey) {
    await sock.sendMessage(jid, { text: '❌ *No tienes API Key válida.*' }, { quoted: msg })
    return true
  }

  const statusMsg = await sock.sendMessage(jid, { text: `🔎 *Buscando "${query}" en X/Twitter...*` }, { quoted: msg })
  const edit = async (text) => { try { await sock.sendMessage(jid, { text, edit: statusMsg.key }) } catch { } }

  try {
    const res = await global.OptiShield.callApi('twitter-search', { apikey, query, limit: 10 })

    if (res.error) { await edit(`❌ *Error: ${res.error}*`); return true }

    const results = res?.result
    if (!Array.isArray(results) || !results.length) {
      await edit(`❌ *Sin resultados para "${query}"*`)
      return true
    }

    let menuText = `🐦 *Búsqueda:* ${query}\n`
    menuText += `📊 *Resultados:* ${results.length}\n\n`

    for (let i = 0; i < results.length; i++) {
      menuText += `*${i + 1}.* Resultado ${i + 1}\n\n`
    }

    menuText += `_Selecciona para ver el tweet_`

    const rows = results.map((r, i) => {
      return {
        id: `.tw ${r.linkReal}`,
        title: `🐦 Resultado ${i + 1}`,
        description: r.linkReal?.substring(0, 50) || '—'
      }
    })

    await edit('✅ *Resultados listos...*')

    await sendInteractiveMessage(sock, jid, {
      title: '🐦 *X / Twitter Search*',
      text: menuText,
      footer: `OptiShield • ${results.length} resultados`,
      interactiveButtons: [
        {
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '🐦 *Seleccionar tweet*',
            sections: [{ title: '🐦 Resultados de X', rows }]
          })
        },
        {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: '🐦 *Ver en X*',
            url: `https://twitter.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=top`
          })
        }
      ]
    })

    await edit(`✅ *${results.length} resultados* para *"${query}"*`)

  } catch (err) {
    console.error('❌ twitter-search error:', err)
    await edit(`❌ *Error: ${err.message}*`)
  }

  return true
}
