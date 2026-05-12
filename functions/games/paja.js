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

// Función mejorada para obtener nombres
// isSender: true si es el que envió el mensaje (podemos usar msg.pushName)
async function getName(sock, jid, msg = null, isSender = false) {
    let name = null

    // 1. Si es el remitente, intentamos usar el pushName del mensaje (la forma más fiable en Baileys)
    if (isSender && msg) {
        // msg.pushName suele estar en el root del objeto mensaje
        if (msg.pushName) name = msg.pushName
    }

    // 2. Si no hay nombre, buscar en la agenda de Baileys (store.contacts)
    if (!name && sock?.store?.contacts && sock.store.contacts[jid]) {
        const c = sock.store.contacts[jid]
        name = c.name || c.notify || c.verifiedName
    }

    // 3. Último recurso: El número
    if (!name) name = jid.split('@')[0]

    return name
}

async function getUserStats(db, phone) {
    const res = await db.get(phone)
    let userData = (res && res.data) || {}

    if (!userData.pajas) {
        userData.pajas = {
            name: '', // Guardamos el nombre aquí para evitar usar números en el top
            sizeCm: BASE_SIZE_CM,
            lastPaja: 0,
            sesiones: 0,
            mayorAlza: 0,
            mayorBaja: 0,
            duelos: { ganados: 0, perdidos: 0 }
        }
    }

    const p = userData.pajas
    p.sizeCm = isNaN(p.sizeCm) ? BASE_SIZE_CM : Number(p.sizeCm)
    p.lastPaja = Number(p.lastPaja) || 0
    p.sesiones = Number(p.sesiones) || 0
    p.mayorAlza = Number(p.mayorAlza) || 0
    p.mayorBaja = Number(p.mayorBaja) || 0
    p.duelos.ganados = Number(p.duelos?.ganados) || 0
    p.duelos.perdidos = Number(p.duelos?.perdidos) || 0

    await db.set(phone, userData)
    return userData.pajas
}

async function saveUserStats(db, phone, pajaData) {
    const res = await db.get(phone)
    let userData = (res && res.data) || {}
    userData.pajas = pajaData
    await db.set(phone, userData)
}

async function updateLeaderboard(db, phone, name, sizeCm) {
    const lbKey = 'pajas_leaderboard'
    const res = await db.get(lbKey)
    let list = (res && res.data && res.data.list) ? res.data.list : []

    const existingIndex = list.findIndex(u => u.phone === phone)
    
    // Si no tenemos nombre (es número), tratamos de no actualizarlo a uno peor si ya había uno guardado, 
    // pero por defecto usamos el que llega.
    const userData = { phone, name: name || phone.split('@')[0], sizeCm, updated: Date.now() }

    if (existingIndex !== -1) {
        const oldEntry = list[existingIndex]
        const isOldNumber = /^\d+$/.test(oldEntry.name)
        const isNewNumber = /^\d+$/.test(userData.name)

        // Si el viejo era nombre y el nuevo es número, conservamos el viejo
        if (!isOldNumber && isNewNumber) {
            userData.name = oldEntry.name
        }
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

    if (command === 'paja') {
        const pajaData = await getUserStats(db, phone)
        
        // Obtener nombre del remitente
        const currentName = await getName(sock, phone, msg, true)
        
        // Si no es número, guardamos el nombre en su perfil para el Top
        if (!/^\d+$/.test(currentName)) {
            pajaData.name = currentName
        }

        const cd = COOLDOWN_MS - (now - pajaData.lastPaja)

        if (cd > 0) {
            await sock.sendMessage(chatId, {
                text: `⏳ *Aún no puedes, necesitas recuperarte*\n\n` +
                    `🕐 Tiempo restante: *${formatCooldown(cd)}*\n\n` +
                    `_Descansa un poco campeón..._`
            }, { quoted: msg })
            return true
        }

        const delta = rnd(MIN_DELTA, MAX_DELTA)
        let anterior = Number(pajaData.sizeCm) || BASE_SIZE_CM
        if (isNaN(anterior)) anterior = BASE_SIZE_CM
        
        let nuevoSize = anterior + delta
        if (isNaN(nuevoSize)) nuevoSize = BASE_SIZE_CM

        pajaData.sizeCm = nuevoSize
        pajaData.lastPaja = now
        pajaData.sesiones++
        if (delta > pajaData.mayorAlza) pajaData.mayorAlza = delta
        if (delta < pajaData.mayorBaja) pajaData.mayorBaja = delta

        await saveUserStats(db, phone, pajaData)
        await updateLeaderboard(db, phone, pajaData.name, pajaData.sizeCm)

        const signo = delta >= 0 ? `+${delta}` : `${delta}`
        const comentario = comentarioDelta(delta)

        // Usamos el nombre para mostrar
        const displayName = pajaData.name || currentName

        let textMsg = `🍆 *RESULTADO DE LA SESIÓN*\n`
        textMsg += `━━━━━━━━━━━━━━━━━━━━\n\n`
        textMsg += `📏 Antes:  *${formatSize(anterior)}*\n`
        textMsg += `📐 Cambio: *${signo} cm*\n`
        textMsg += `📏 Ahora:  *${formatSize(pajaData.sizeCm)}*\n\n`
        textMsg += `${comentario}\n\n`
        textMsg += `🗓️ Sesión #${pajaData.sesiones} · ⏰ Próxima en *23h*`

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

        for (const e of top) {
            let displayName = e.name
            
            // --- SOLUCIÓN AL ERROR "DESCONOCIDO" ---
            // 1. Si el nombre del leaderboard está vacío o es un número, intentamos buscar en su DB personal.
            if (!displayName || /^\d+$/.test(displayName)) {
                try {
                    const userStats = await getUserStats(db, e.phone)
                    if (userStats.name && !/^\d+$/.test(userStats.name)) {
                        displayName = userStats.name
                    }
                } catch (err) {
                    console.log("Error fetching user stats for name:", err)
                }
            }

            // 2. Si sigue siendo número o vacío, buscar en la agenda de contactos del bot.
            if (!displayName || /^\d+$/.test(displayName)) {
                const contact = sock.store.contacts[e.phone]
                if (contact) {
                    displayName = contact.name || contact.notify
                }
            }

            // 3. Si falla todo, mostrar "Desconocido" o el número corto
            if (!displayName || /^\d+$/.test(displayName)) {
                const shortNum = e.phone.split('@')[0]
                displayName = shortNum.length > 8 ? "👤 Desconocido" : shortNum
            }

            textMsg += `${medal(top.indexOf(e))} *${displayName}*\n`
            textMsg += `   📏 ${formatSize(e.sizeCm)}\n\n`
        }

        const losers = [...list].sort((a, b) => a.sizeCm - b.sizeCm).slice(0, 3)

        textMsg += `━━━━━━━━━━━━━━━━━━━━\n`
        textMsg += `🪦 *El podio de los penudos:*\n`
        for (const e of losers) {
            const i = losers.indexOf(e)
            const suffix = i === 0 ? ' 👑 *(Rey penudo)*' : ''
            let displayName = e.name
            
            // Aplicamos la misma lógica de nombres para los perdedores
            if (!displayName || /^\d+$/.test(displayName)) {
                try {
                    const userStats = await getUserStats(db, e.phone)
                    if (userStats.name && !/^\d+$/.test(userStats.name)) {
                        displayName = userStats.name
                    } else if (sock.store.contacts[e.phone]) {
                        displayName = sock.store.contacts[e.phone].name || sock.store.contacts[e.phone].notify
                    }
                } catch (err) {}
            }
             if (!displayName || /^\d+$/.test(displayName)) {
                const shortNum = e.phone.split('@')[0]
                displayName = shortNum.length > 8 ? "👤 Desconocido" : shortNum
            }

            textMsg += `  ${i + 1}. ${displayName} — ${formatSize(e.sizeCm)}${suffix}\n`
        }

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

        const pajaDataA = await getUserStats(db, phone)
        const pajaDataB = await getUserStats(db, mentioned)

        // Obtener nombre A
        const nameA_raw = await getName(sock, phone, msg, true)
        if (!/^\d+$/.test(nameA_raw)) pajaDataA.name = nameA_raw
        const nameA = pajaDataA.name || nameA_raw

        // Obtener nombre B (Rival) - Aplicamos misma lógica que en ptop
        let nameB = pajaDataB.name
        if (!nameB || /^\d+$/.test(nameB)) {
            // Buscar en contacts si no tenemos nombre bonito
            const contactB = sock.store.contacts[mentioned]
            const contactNameB = contactB ? (contactB.name || contactB.notify) : null
            
            if (contactNameB && !/^\d+$/.test(contactNameB)) {
                nameB = contactNameB
                // Guardamos el nombre descubierto en su DB para el futuro
                pajaDataB.name = nameB
                await saveUserStats(db, mentioned, pajaDataB)
            } else {
                // Si no hay nada, usar el nombre descubierto o desconocido
                nameB = contactNameB || "👤 Rival"
            }
        }

        const sizeA = Number(pajaDataA.sizeCm) || BASE_SIZE_CM
        const sizeB = Number(pajaDataB.sizeCm) || BASE_SIZE_CM

        let ganadorPhone, perdedorPhone, tagG, tagP, sizeG, sizeP, statsG, statsP
        
        if (sizeA > sizeB) {
            ganadorPhone = phone; perdedorPhone = mentioned
            tagG = nameA; tagP = nameB
            sizeG = sizeA; sizeP = sizeB
            statsG = pajaDataA; statsP = pajaDataB
        } else if (sizeB > sizeA) {
            ganadorPhone = mentioned; perdedorPhone = phone
            tagG = nameB; tagP = nameA
            sizeG = sizeB; sizeP = sizeA
            statsG = pajaDataB; statsP = pajaDataA
        } else {
            await sock.sendMessage(chatId, {
                text: `⚔️ *DUELO DE PIJAS*\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `🅰️ ${nameA}: ${formatSize(sizeA)}\n` +
                    `🅱️ ${nameB}: ${formatSize(sizeB)}\n\n` +
                    `🤝 *¡EMPATE PERFECTO!*\n_Son iguales. Qué rareza del universo._`
            }, { quoted: msg })
            return true
        }

        statsG.duelos.ganados++
        statsP.duelos.perdidos++

        await saveUserStats(db, phone, pajaDataA)
        await saveUserStats(db, mentioned, pajaDataB)
        
        await updateLeaderboard(db, phone, pajaDataA.name, pajaDataA.sizeCm)
        await updateLeaderboard(db, mentioned, pajaDataB.name, pajaDataB.sizeCm)

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
        // Corrección pequeña: statsG puede ser A o B dependiendo quien ganó
        textMsg += `📊 Duelos de ${tagG}: ✅ ${statsG.duelos.ganados}G / ❌ ${statsG.duelos.perdidos}P`

        await sock.sendMessage(chatId, { text: textMsg }, { quoted: msg })
        return true
    }

    return true
}
