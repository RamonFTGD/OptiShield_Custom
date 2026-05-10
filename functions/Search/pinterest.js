export const meta = {
  name: 'PinterestSearch',
  commands: ['pinterestsearch', 'pinsearch', 'pinsh'],
  priority: 5,
  premium: true,
  class: 'Descargadores',
}

export default async function (msg, sock, ctx) {
  const jid    = msg.key.remoteJid
  const query  = ctx.args.join(' ')
  const apikey = ctx.apikey

  if (!query) {
    await sock.sendMessage(jid, { text: '❌ Debes escribir algo.\nEjemplo: `.pinsearch gatos`' }, { quoted: msg })
    return true
  }
  if (!apikey) {
    await sock.sendMessage(jid, { text: '❌ No tienes API Key válida.' }, { quoted: msg })
    return true
  }

  const statusMsg = await sock.sendMessage(jid, {
    text: `📌 Buscando *"${query}"* en Pinterest...`
  }, { quoted: msg })

  const edit = async (text) => {
    try { await sock.sendMessage(jid, { text, edit: statusMsg.key }) } catch { }
  }

  try {
    const res = await global.OptiShield.callApi('pinterestSearch', { query, apikey })

    if (res.error) { await edit(`❌ ${res.error}`); return true }
    if (!res?.result?.ok || !res.result.results?.length) {
      await edit('❌ Sin resultados.')
      return true
    }

    const results = res.result.results
      .filter(r => typeof r.archivo === 'string' && !r.video)
      .slice(0, 8)

    if (!results.length) {
      await edit('⚠️ No hay imágenes válidas.')
      return true
    }

    await edit(`📌 Encontradas *${results.length}* imágenes. Preparando álbum...`)

    const medias = results.map(r => ({
      image: { url: r.archivo }
    }))
    // [ image: { url: link } ]
    await sock.sendAlbumMessage(jid, medias, {
      quoted: msg,
      delay: 400
    })

    await edit(`✅ ¡Álbum enviado con *${results.length}* imágenes de Pinterest!`)

  } catch (err) {
    console.error('❌ pinsearch error:', err)
    await edit(`❌ Error: ${err.message}`)
  }

  return true
}
