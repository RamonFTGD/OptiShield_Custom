import axios from 'axios'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { sendInteractiveMessage } = require('gifted-btns')

export const meta = {
  name: 'github',
  commands: ['github', 'gh', 'gitdl', 'githubdl'],
  priority: 3,
  premium: true,
  class: 'Descargadores',
}

function isGitHubUrl(text = '') {
  return /^https?:\/\/(www\.)?github\.com\//i.test(text)
}

function extractOwner(repoUrl) {
  try {
    const parts = new URL(repoUrl).pathname.split('/').filter(Boolean)
    return parts[0] || null
  } catch { return null }
}

function getAvatarUrl(owner) {
  return `https://github.com/${owner}.png`
}

export default async function (msg, sock, ctx) {
  const { apikey, text } = ctx
  const chatId = msg.key.remoteJid
  const args = text.trim().split(/\s+/)

  if (!args.length || !args[0]) {
    await sock.sendMessage(chatId, {
      text: '📂 *GitHub Buscador & Descargador*\n\n*Comandos:*\n• `.githubdl <texto>` — Busca repositorios\n• `.githubdl <url>` — Descarga directo\n\n*Ejemplos:*\n`.githubdl HutaoBot`\n`.githubdl https://github.com/iBotPeaches/Apktool`'
    }, { quoted: msg })
    return true
  }

  // ── Descarga directa por URL ──
  if (isGitHubUrl(args[0])) {
    return await handleDownload(args[0], sock, msg, chatId, apikey)
  }

  // ── Búsqueda ──
  const query = args.join(' ')
  const statusMsg = await sock.sendMessage(chatId, { text: `🔍 Buscando: *${query}*...` }, { quoted: msg })
  const edit = async (text) => { try { await sock.sendMessage(chatId, { text, edit: statusMsg.key }) } catch { } }

  try {
    const searchData = await global.OptiShield.callApi('github', { query, apikey })

    if (searchData.error || !searchData?.result?.results?.length) {
      await edit(`❌ ${searchData?.error || 'No se encontraron repositorios'}`)
      return true
    }

    const results = searchData.result.results

    let menuText = `📂 *Búsqueda GitHub:* ${query}\n`
    menuText += `📊 *Resultados:* ${results.length}\n\n`

    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      const desc = (r.description || 'Sin descripción').substring(0, 60)
      menuText += `*${i + 1}.* ${r.name}\n`
      menuText += `   👤 ${r.owner} • ${desc}\n\n`
    }

    menuText += `_Selecciona un repositorio para descargarlo_`

    const rows = results.map((r, i) => ({
      id: `.githubdl ${r.link}`,
      title: `⬇️ ${r.name}`,
      description: `👤 ${r.owner} • ${(r.description || '').substring(0, 40)}`
    }))

    await edit('✅ Resultados listos...')

    await sendInteractiveMessage(sock, chatId, {
      title: '📂 GitHub Search',
      text: menuText,
      footer: `OptiShield • ${results.length} repositorios`,
      interactiveButtons: [
        {
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '⬇️ Seleccionar repositorio',
            sections: [{ title: '📂 Repositorios encontrados', rows }]
          })
        },
        {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: '🔍 Ver en GitHub',
            url: `https://github.com/search?q=${encodeURIComponent(query)}`
          })
        }
      ]
    })

  } catch (e) {
    await edit(`⚠️ Error: ${e.message}`)
  }

  return true
}

async function handleDownload(repoUrl, sock, msg, chatId, apikey) {
  await sock.sendMessage(chatId, { text: '⏳ Descargando repositorio...' }, { quoted: msg })

  try {
    const dlData = await global.OptiShield.callApi('github', { repository: repoUrl, apikey })

    if (dlData.error || !dlData?.result) {
      await sock.sendMessage(chatId, { text: `❌ ${dlData?.error || 'Error al descargar'}` }, { quoted: msg })
      return true
    }

    const { url, filename, size, repository } = dlData.result
    const owner = extractOwner(repoUrl)
    const thumbnailUrl = owner ? getAvatarUrl(owner) : null

    let thumbnailBuffer = null
    if (thumbnailUrl) {
      try {
        const { data } = await axios.get(thumbnailUrl, { responseType: 'arraybuffer', timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } })
        thumbnailBuffer = Buffer.from(data)
      } catch { }
    }

    await sock.sendMessage(chatId, {
      document: { url },
      mimetype: 'application/zip',
      fileName: repository,
      caption: `✅ *Repositorio descargado*\n\n📂 *${repository}*\n📦 ${filename}\n📊 ${size}`,
      contextInfo: thumbnailUrl ? { thumbnailUrl } : {}
    }, { quoted: msg })

  } catch (e) {
    await sock.sendMessage(chatId, { text: `⚠️ Error: ${e.message}` }, { quoted: msg })
  }

  return true
}
