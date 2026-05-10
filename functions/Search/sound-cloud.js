import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { sendInteractiveMessage } = require('gifted-btns')

export const meta = {
    name: 'SoundCloudSearch',
    commands: ['soundcloudsearch', 'scs', 'buscarsoundcloud', 'scc'],
    priority: 5,
    premium: true,
    class: 'Buscadores',
}

function formatNum(num) {
    if (!num && num !== 0) return '?'
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return String(num)
}

function formatDuration(ms) {
    if (!ms) return '0:00'
    const seconds = Math.floor(ms / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default async function (msg, sock, ctx) {
    const jid = msg.key.remoteJid
    const query = ctx.args.join(' ')
    const apikey = ctx?.info?.user?.apikey

    if (!query) {
        await sock.sendMessage(jid, { text: '❌ Debes escribir algo.\nEjemplo: `.scs Ghost Mary On A Cross`' })
        return true
    }

    if (!apikey) {
        await sock.sendMessage(jid, { text: '❌ No tienes API Key válida.' })
        return true
    }

    const statusMsg = await sock.sendMessage(jid, {
        text: `🎵 Buscando en SoundCloud: *${query}*...`
    }, { quoted: msg })

    const edit = async (text) => { try { await sock.sendMessage(jid, { text, edit: statusMsg.key }) } catch { } }

    try {
        const res = await global.OptiShield.callApi('soundcloud-search', { query, apikey })

        if (res.error) { await edit(`❌ ${res.error}`); return true }
        if (!res?.result?.ok || !res?.result?.songs?.length) { await edit('❌ Sin resultados.'); return true }

        const results = res.result.songs.slice(0, 10)

        let menuText = `🎵 *Búsqueda SoundCloud:* ${query}\n`
        menuText += `📊 *Resultados:* ${results.length}\n\n`

        for (let i = 0; i < results.length; i++) {
            const r = results[i]
            const titulo = (r.titulo || 'Sin título').substring(0, 50)
            menuText += `*${i + 1}.* ${titulo}${r.titulo?.length > 50 ? '...' : ''}\n`
            menuText += `   👤 ${r.artista || '?'} • ❤️ ${formatNum(r.likes)} • ⏱️ ${formatDuration(r.duracion)}\n\n`
        }

        menuText += `_Selecciona una canción para descargarla_`

        const rows = results.map((r, i) => {
            const titulo = (r.titulo || 'Sin título').substring(0, 22)
            return {
                id: `scdl ${r.url}`,
                title: `🎵 ${titulo}${(r.titulo?.length || 0) > 22 ? '...' : ''}`,
                description: `👤 ${r.artista || '?'} • ❤️ ${formatNum(r.likes)} • ⏱️ ${formatDuration(r.duracion)}`
            }
        })

        await edit('✅ Resultados listos...')

        await sendInteractiveMessage(sock, jid, {
            title: '🎵 SoundCloud Search',
            text: menuText,
            footer: `OptiShield • ${results.length} canciones`,
            interactiveButtons: [
                {
                    name: 'single_select',
                    buttonParamsJson: JSON.stringify({
                        title: '🎵 Seleccionar canción',
                        sections: [{ title: '🎵 Canciones encontradas', rows }]
                    })
                },
                {
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                        display_text: '🎵 Ver en SoundCloud',
                        url: `https://soundcloud.com/search?q=${encodeURIComponent(query)}`
                    })
                }
            ]
        })
    } catch (err) {
        console.error('❌ soundcloud search error:', err)
        await edit(`❌ Error: ${err.message}`)
    }

    return true
}
