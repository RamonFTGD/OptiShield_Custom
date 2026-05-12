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

// Función Avanzada de Obtención de Nombres
// Retorna { text: "Nombre o JID", isNumber: boolean }
async function getName(sock, jid, msg, currentDbName = null) {
    let name = null

    // 1. Si es el remitente, usamos el pushName del mensaje
    if (msg && (msg.key.participant === jid || msg.key.remoteJid === jid)) {
        if (msg.key.pushName) name = msg.key.pushName
    }

    // 2. Si no hay nombre, buscar en la agenda de Baileys (store.contacts)
    if (!name && sock?.store?.contacts && sock.store.contacts[jid]) {
        const c = sock.store.contacts[jid]
        name = c.name || c.notify || c.verifiedName
    }

    // 3. Si aún no hay nombre, usar el que ya está en la DB (si se pasó)
    if (!name && currentDbName) name = currentDbName

    // 4. Último recurso: El número, pero intentaremos ocultarlo si es posible
    if (!name) name = jid.split('@')[0]

    // Detección: ¿Es un número puro?
    const isNumber = /^\d+$/.test(name)

    return { text: name, isNumber }
}

async function getUserStats(db, phone) {
    const res = await db.get(phone)
    let userData = (res && res.data) || {}

    if (!userData.pajas) {
        userData.pajas = {
            name: '',
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
    const userData = { phone, name: name || phone.split('@')[0], sizeCm, updated: Date.now() }

    if (existingIndex !== -1) {
        // Si ya existe, actualizamos SI el nuevo nombre es mejor (no es solo números)
        // o si el viejo también era solo números
        const oldEntry = list[existingIndex]
        const isOldNumber = /^\d+$/.test(oldEntry.name)
        
        if (!userData.isNumber || isOldNumber) {
             list[existingIndex] = userData
        } else {
             // Si el viejo nombre era bonito y el nuevo es un número, conservamos el viejo nombre
             userData.name = oldEntry.name
             list[existingIndex] = userData
        }
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
        
        // Obtener nombre actual
        const nameInfo = await getName(sock, phone, msg, pajaData.name)
        
        // Solo actualizar el nombre en la DB si NO es un número
        // (Si es un número, nos quedamos con el nombre que ya teníamos o dejamos vacío para que use el del store)
        if (!nameInfo.isNumber) {
            pajaData.name = nameInfo.text
        } else if (!pajaData.name) {
            // Si no tenía nombre guardado y es un número, no lo guardamos como nombre fijo
            // Pero para mostrarlo usaremos nameInfo.text temporalmente
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

        // Usamos el nombre para mostrar (priorizando el guardado o el actual)
        const displayName = pajaData.name || nameInfo.text

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
            
            // Si el nombre guardado está vacío o es un número, intentar buscar en la tienda de contacts
            if (!displayName || /^\d+$/.test(displayName)) {
                const contactInfo = await getName(sock, e.phone, msg, null)
                displayName = contactInfo.text
                // Si sigue siendo número y es largo, mostrar "Desconocido" o acortarlo
                if (contactInfo.isNumber && displayName.length > 8) {
                    displayName = "👤 Desconocido"
                }
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
             if (!displayName || /^\d+$/.test(displayName)) {
                const contactInfo = await getName(sock, e.phone, msg, null)
                displayName = contactInfo.isNumber && displayName.length > 8 ? "👤 Desconocido" : contactInfo.text
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
        const infoA = await getName(sock, phone, msg, pajaDataA.name)
        if (!infoA.isNumber) pajaDataA.name = infoA.text
        
        const nameA = pajaDataA.name || infoA.text

        // Obtener nombre B (Rival)
        let nameB = pajaDataB.name
        // Si no tiene nombre guardado, intentamos buscarlo ahora
        if (!nameB || /^\d+$/.test(nameB)) {
            const infoB = await getName(sock, mentioned, msg, null)
            // Si lo encontrado es un número, preferimos "Desconocido" para que se vea mejor
            if (!infoB.isNumber) {
                nameB = infoB.text
                // Actualizar su DB con este nombre
                pajaDataB.name = nameB
                await saveUserStats(db, mentioned, pajaDataB)
            } else {
                nameB = "👤 Desconocido"
            }
        }

        const sizeA = Number(pajaDataA.sizeCm) || BASE_SIZE_CM
        const sizeB = Number(pajaDataB.sizeCm) || BASE_SIZE_CM

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

        pajaDataA.duelos.ganados++
        pajaDataB.duelos.perdidos++

        // Guardar cambios de nombres actualizados
        await saveUserStats(db, phone, pajaDataA)
        await saveUserStats(db, mentioned, pajaDataB)
        
        await updateLeaderboard(db, phone, nameA, pajaDataA.sizeCm)
        await updateLeaderboard(db, mentioned, nameB, pajaDataB.sizeCm)

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
        textMsg += `📊 Duelos de ${tagG}: ✅ ${pajaDataA.duelos.ganados}G / ❌ ${pajaDataA.duelos.perdidos}P`

        await sock.sendMessage(chatId, { text: textMsg }, { quoted: msg })
        return true
    }

    return true
}
