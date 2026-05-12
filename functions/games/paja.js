export const meta = {
    name: 'Pajas',
    commands: ['paja', 'ptop', 'pduelo'],
    priority: 5,
    class: 'Game'
}

const COOLDOWN_MS = 23 * 60 * 60 * 1000
const BASE_SIZE_CM = 15
const MIN_DELTA = -20
const MAX_DELTA = 20

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

function formatCooldown(ms) {
    if (ms <= 0) return '0s'
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
}

function formatSize(cm) {

    if (isNaN(cm) || cm === null || cm === undefined) cm = BASE_SIZE_CM
    
    const abs = Math.abs(cm)
    if (abs === 0) return '0 cm (literalmente invisible 🔬)'
    if (cm < 0) return `${Math.abs(cm)} cm (está al revés wey 🙃)`
    if (abs < 1) return `${(abs * 10).toFixed(1)} mm (¿eso es un grano de arroz? 🍚)`
    if (abs < 100) return `${abs} cm`
    if (abs < 10000) return `${(abs / 100).toFixed(2)} m (ya es peligrosa 😳)`
    if (abs < 1e7) return `${(abs / 1e5).toFixed(2)} km (bro para 💀)`
    return `${(abs / 1e8).toFixed(2)} km (esto ya es un crimen contra la humanidad 🌍)`
}

function comentarioDelta(delta) {
    if (delta >= 18) return '📈 ¡DIOS MÍO, crecimiento histórico! ¿Eres un caballo?'
    if (delta >= 10) return '🚀 ¡Qué sesión tan productiva hermano!'
    if (delta >= 5) return '😏 Nada mal, el entrenamiento está dando resultados'
    if (delta >= 1) return '🙂 Algo es algo, no te quejes'
    if (delta === 0) return '😐 No pasó nada... literalmente nada'
    if (delta >= -5) return '😬 Parece que hoy no fue tu día'
    if (delta >= -10) return '😰 Bro... eso duele más que el regaño de tu mamá'
    if (delta >= -18) return '💀 Houston, tenemos un problema SERIO'
    return '🪦 Requiescat in pace. Que descanse en paz lo que tenías'
}

function medal(i) {
    return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
}

function getPushName(msg, fallbackJid) {
    if (msg?.key?.pushName) return msg.key.pushName

    const mentioned = msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    if (mentioned && mentioned === fallbackJid) {

    }
    return fallbackJid ? fallbackJid.split('@')[0] : 'Desconocido'
}

async function getUserStats(db, phone) {
    const key = `pajas_${phone}`
    const res = await db.get(key)
    

    let data = {
        name: '',
        sizeCm: BASE_SIZE_CM,
        lastPaja: 0,
        sesiones: 0,
        mayorAlza: 0,
        mayorBaja: 0,
        duelos: { ganados: 0, perdidos: 0 }
    }

    if (res && res.data) {

        const saved = res.data
        data = {
            name: saved.name || '',
            sizeCm: isNaN(saved.sizeCm) ? BASE_SIZE_CM : saved.sizeCm,
            lastPaja: Number(saved.lastPaja) || 0,
            sesiones: Number(saved.sesiones) || 0,
            mayorAlza: Number(saved.mayorAlza) || 0,
            mayorBaja: Number(saved.mayorBaja) || 0,
            duelos: {
                ganados: Number(saved.duelos?.ganados) || 0,
                perdidos: Number(saved.duelos?.perdidos) || 0
            }
        }
    } else {

        await db.set(key, data)
    }
    return data
}

async function updateLeaderboard(db, phone, name, sizeCm) {
    const lbKey = 'pajas_leaderboard'
    const res = await db.get(lbKey)
    let list = (res && res.data && res.data.list) ? res.data.list : []

    const existingIndex = list.findIndex(u => u.phone === phone)

    const userData = { phone, name: name || phone.split('@')[0], sizeCm, updated: Date.now() }

    if (existingIndex !== -1) {
        list[existingIndex] = userData
    } else {
        list.push(userData)
    }

    list.sort((a, b) => b.sizeCm - a.sizeCm)
    
    await db.set(lbKey, { list: list.slice(0, 50) })
}

export default async function (msg, sock, ctx) {
    const { chatId, isGroup, sender } = ctx
    const db = global.OptiShield?.db

    if (!db) {
        await sock.sendMessage(chatId, { text: '❌ La base de datos no está disponible.' }, { quoted: msg })
        return true
    }

    if (!isGroup) {
        await sock.sendMessage(chatId, { text: '❌ Solo funciona en grupos' }, { quoted: msg })
        return true
    }

    const phone = sender
    if (!phone) return true

    const fullText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const args = fullText.trim().split(/\s+/)
    const command = args[0].toLowerCase().replace(/^[.!/#$]/, '')
    const now = Date.now()

    const currentPushName = getPushName(msg, phone)

    if (command === 'paja') {
        const stat = await getUserStats(db, phone)
        

        if (!stat.name || stat.name !== currentPushName) {
            stat.name = currentPushName
        }

        const cd = COOLDOWN_MS - (now - stat.lastPaja)

        if (cd > 0) {
            await sock.sendMessage(chatId, {
                text: `⏳ *Aún no puedes, necesitas recuperarte*\n\n` +
                    `🕐 Tiempo restante: *${formatCooldown(cd)}*\n\n` +
                    `_Descansa un poco campeón..._`
            }, { quoted: msg })
            return true
        }

        const delta = rnd(MIN_DELTA, MAX_DELTA)

        let anterior = Number(stat.sizeCm) || BASE_SIZE_CM
        if (isNaN(anterior)) anterior = BASE_SIZE_CM
        
        let nuevoSize = anterior + delta
        if (isNaN(nuevoSize)) nuevoSize = BASE_SIZE_CM

        stat.sizeCm = nuevoSize
        stat.lastPaja = now
        stat.sesiones++
        if (delta > stat.mayorAlza) stat.mayorAlza = delta
        if (delta < stat.mayorBaja) stat.mayorBaja = delta

        await db.set(`pajas_${phone}`, stat)
        await updateLeaderboard(db, phone, stat.name, stat.sizeCm)

        const signo = delta >= 0 ? `+${delta}` : `${delta}`
        const comentario = comentarioDelta(delta)

        let textMsg = `🍆 *RESULTADO DE LA SESIÓN*\n`
        textMsg += `━━━━━━━━━━━━━━━━━━━━\n\n`
        textMsg += `📏 Antes:  *${formatSize(anterior)}*\n`
        textMsg += `📐 Cambio: *${signo} cm*\n`
        textMsg += `📏 Ahora:  *${formatSize(stat.sizeCm)}*\n\n`
        textMsg += `${comentario}\n\n`
        textMsg += `🗓️ Sesión #${stat.sesiones} · ⏰ Próxima en *23h*`

        await sock.sendMessage(chatId, { text: textMsg }, { quoted: msg })
        return true
    }

    if (command === 'ptop') {
        const lbRes = await db.get('pajas_leaderboard')
        const list = (lbRes && lbRes.data && lbRes.data.list) ? lbRes.data.list : []

        if (!list.length) {
            await sock.sendMessage(chatId, {
                text: '🍆 Nadie ha jalado todavía. Sean los primeros!'
            }, { quoted: msg })
            return true
        }

        let textMsg = `🍆 *TOP 10 — LOS MÁS DOTADOS DEL GRUPO*\n`
        textMsg += `_"Porque en este grupo lo que importa es el tamaño"_\n`
        textMsg += `━━━━━━━━━━━━━━━━━━━━\n\n`

        const top = list.slice(0, 10)

        top.forEach((e, i) => {
            const displayName = e.name || e.phone.split('@')[0]
            textMsg += `${medal(i)} *${displayName}*\n`
            textMsg += `   📏 ${formatSize(e.sizeCm)}\n\n`
        })

        const losers = [...list].sort((a, b) => a.sizeCm - b.sizeCm).slice(0, 3)

        textMsg += `━━━━━━━━━━━━━━━━━━━━\n`
        textMsg += `🪦 *El podio de los penudos:*\n`
        losers.forEach((e, i) => {
            const suffix = i === 0 ? ' 👑 *(Rey penudo)*' : ''
            const displayName = e.name || e.phone.split('@')[0]
            textMsg += `  ${i + 1}. ${displayName} — ${formatSize(e.sizeCm)}${suffix}\n`
        })

        await sock.sendMessage(chatId, { text: textMsg }, { quoted: msg })
        return true
    }

    if (command === 'pduelo') {
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
        if (!mentioned) {
            await sock.sendMessage(chatId, {
                text: `⚔️ *DUELO DE PIJAS*\n\n` +
                    `Menciona a tu rival para duelos:\n` +
                    `*.pduelo @usuario*\n\n` +
                    `_El que la tenga más grande gana... matemáticamente hablando._`
            }, { quoted: msg })
            return true
        }

        if (mentioned === phone) {
            await sock.sendMessage(chatId, {
                text: '🤦 No puedes duelarte contigo mismo, eso se llama de otra forma...'
            }, { quoted: msg })
            return true
        }

        const statA = await getUserStats(db, phone)
        const statB = await getUserStats(db, mentioned)

        if (!statA.name || statA.name !== currentPushName) {
            statA.name = currentPushName
        }

        let nameB = statB.name
        

        if (!nameB) {

            const ctxInfo = msg.message?.extendedTextMessage?.contextInfo
            nameB = ctxInfo?.participantName || mentioned.split('@')[0]
        }
        

        if (nameB && nameB !== statB.name) {
            statB.name = nameB
        }

        const nameA = statA.name

        const sizeA = Number(statA.sizeCm) || BASE_SIZE_CM
        const sizeB = Number(statB.sizeCm) || BASE_SIZE_CM

        const frames = [
            `⚔️ *DUELO DE PIJAS INICIADO*\n━━━━━━━━━━━━━━━━━━━━\n\n🅰️ ${nameA}: *${formatSize(sizeA)}*\n🅱️ ${nameB}: *${formatSize(sizeB)}*\n\n🥁 _Preparando espadas..._`,
            `🅰️ ${nameA}  🍆━━━━━━━━💥━━━━━━━━🍆  🅱️ ${nameB}\n\n_¡Chocando!_`,
        ]

        let ganadorPhone, perdedorPhone, tagG, tagP, sizeG, sizeP
        if (sizeA > sizeB) {
            ganadorPhone = phone; perdedorPhone = mentioned
            tagG = nameA; tagP = nameB
            sizeG = sizeA; sizeP = sizeB
        } else if (sizeB > sizeA) {
            ganadorPhone = mentioned; perdedorPhone = phone
            tagG = nameB; tagP = nameA
            sizeG = sizeB; sizeP = sizeA
        } else {
            await sock.sendMessage(chatId, {
                text: `⚔️ *DUELO DE PIJAS*\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `🅰️ ${nameA}: ${formatSize(sizeA)}\n` +
                    `🅱️ ${nameB}: ${formatSize(sizeB)}\n\n` +
                    `🤝 *¡EMPATE PERFECTO!*\n_Son iguales. Qué rareza del universo._`
            }, { quoted: msg })
            return true
        }

        statA.duelos.ganados++
        statB.duelos.perdidos++

        await db.set(`pajas_${phone}`, statA)
        await db.set(`pajas_${mentioned}`, statB)
        

        await updateLeaderboard(db, phone, nameA, statA.sizeCm)
        await updateLeaderboard(db, mentioned, nameB, statB.sizeCm)

        const diferencia = Math.abs(sizeG - sizeP)
        const frases = [
            `💀 ${tagP} quedó en el suelo llorando`,
            `${tagP} va a necesitar terapia después de esto`,
            `Que alguien le mande condolencias a ${tagP}`,
            `${tagP} debería buscarse otro hobby`,
            `${tagP} fue aplastado como hormiga 🐜`,
        ]
        const frase = frases[rnd(0, frases.length - 1)]

        let textMsg = `⚔️ *RESULTADO DEL DUELO*\n`
        textMsg += `━━━━━━━━━━━━━━━━━━━━\n\n`
        textMsg += `🅰️ ${nameA}: *${formatSize(sizeA)}*\n`
        textMsg += `🅱️ ${nameB}: *${formatSize(sizeB)}*\n\n`
        textMsg += `🏆 *¡GANADOR: ${tagG}!*\n`
        textMsg += `📏 Ganó por *${diferencia} cm* de diferencia\n\n`
        textMsg += `💬 _${frase}_\n\n`
        textMsg += `📊 Duelos de ${tagG}: ✅ ${statA.duelos.ganados}G / ❌ ${statA.duelos.perdidos}P`

        await sock.sendMessage(chatId, { text: textMsg }, { quoted: msg })
        return true
    }

    return true
}
