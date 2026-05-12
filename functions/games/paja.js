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

function getSafeName(msg, jid, isSender = false) {
    if (isSender && msg) {
        if (msg.pushName) return msg.pushName
    }
    return null
}

async function getUserStats(db, phone) {
    console.log(`[DB LOG] Leyendo stats para: ${phone}`)
    const res = await db.get(phone)
    let userData = (res && res.data) ? res.data : {}

    if (!userData.pajas) {
        console.log(`[DB LOG] Usuario nuevo o sin datos de pajas, inicializando...`)
        userData.pajas = {
            name: '',
            sizeCm: BASE_SIZE_CM,
            lastPajaTimestamp: 0, // <--- Timestamp explícito
            sesiones: 0,
            mayorAlza: 0,
            mayorBaja: 0,
            duelos: { ganados: 0, perdidos: 0 }
        }
    } else {
        // Asegurar compatibilidad si venía de versiones viejas
        if (!userData.pajas.lastPajaTimestamp && userData.pajas.lastPaja) {
             userData.pajas.lastPajaTimestamp = userData.pajas.lastPaja
        }
    }

    const p = userData.pajas
    p.sizeCm = isNaN(p.sizeCm) ? BASE_SIZE_CM : Number(p.sizeCm)
    p.lastPajaTimestamp = Number(p.lastPajaTimestamp) || 0
    p.sesiones = Number(p.sesiones) || 0
    p.mayorAlza = Number(p.mayorAlza) || 0
    p.mayorBaja = Number(p.mayorBaja) || 0
    p.duelos.ganados = Number(p.duelos?.ganados) || 0
    p.duelos.perdidos = Number(p.duelos?.perdidos) || 0

    return userData.pajas
}

async function saveUserStats(db, phone, pajaData) {
    console.log(`[DB LOG] === INICIANDO GUARDADO ===`)
    console.log(`[DB LOG] Usuario: ${phone}`)
    console.log(`[DB LOG] Datos a guardar (pajas):`, JSON.stringify(pajaData))

    // 1. Obtenemos datos actuales para no borrar otros módulos
    const res = await db.get(phone)
    const existingData = (res && res.data) ? res.data : {}
    console.log(`[DB LOG] Datos previos en DB:`, existingData ? 'Existentes' : 'Vacíos')

    // 2. Fusionamos (Merge)
    existingData.pajas = pajaData

    // 3. Guardamos en la nube
    console.log(`[DB LOG] Enviando comando db.set...`)
    const setResult = await db.set(phone, existingData)

    // 4. Verificación del resultado
    if (setResult && setResult.status === 'ok') {
        console.log(`[DB LOG] ✅ EXITO: db.set retornó 'ok'. Datos guardados.`)
    } else {
        console.error(`[DB LOG] ❌ ERROR: db.set falló. Respuesta:`, setResult)
    }
}

async function updateLeaderboard(db, phone, name, sizeCm) {
    const lbKey = 'pajas_leaderboard'
    console.log(`[DB LOG] Actualizando Leaderboard para ${phone}...`)
    
    const res = await db.get(lbKey)
    let list = (res && res.data && res.data.list) ? res.data.list : []

    const existingIndex = list.findIndex(u => u.phone === phone)
    const userData = { phone, name: name || phone.split('@')[0], sizeCm, updated: Date.now() }

    if (existingIndex !== -1) {
        const oldEntry = list[existingIndex]
        const isOldNumber = /^\d+$/.test(oldEntry.name)
        const isNewNumber = /^\d+$/.test(userData.name)

        if (!isOldNumber && isNewNumber) {
            userData.name = oldEntry.name
        }
        list[existingIndex] = userData
    } else {
        list.push(userData)
    }

    list.sort((a, b) => b.sizeCm - a.sizeCm)
    
    const lbSetRes = await db.set(lbKey, { list: list.slice(0, 50) })
    if (lbSetRes && lbSetRes.status === 'ok') {
        console.log(`[DB LOG] ✅ Leaderboard actualizado correctamente.`)
    } else {
        console.error(`[DB LOG] ❌ Error al actualizar Leaderboard:`, lbSetRes)
    }
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
        console.log(`[CMD] Ejecutando !paja para ${sender}`)
        
        // 1. Leer
        let pajaData = await getUserStats(db, phone)
        
        // 2. Nombre
        const currentName = getSafeName(msg, phone, true)
        if (currentName && !/^\d+$/.test(currentName)) {
            pajaData.name = currentName
        }

        // 3. Cooldown (Usando el nuevo nombre de variable)
        const cd = COOLDOWN_MS - (now - pajaData.lastPajaTimestamp)

        if (cd > 0) {
            console.log(`[CMD] Usuario en cooldown. Faltan ${cd}ms`)
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
        pajaData.lastPajaTimestamp = now // <--- ACTUALIZAMOS EL TIMESTAMP AQUI
        pajaData.sesiones++
        if (delta > pajaData.mayorAlza) pajaData.mayorAlza = delta
        if (delta < pajaData.mayorBaja) pajaData.mayorBaja = delta

        // 4. Guardar
        await saveUserStats(db, phone, pajaData)
        await updateLeaderboard(db, phone, pajaData.name, pajaData.sizeCm)

        const signo = delta >= 0 ? `+${delta}` : `${delta}`
        const comentario = comentarioDelta(delta)
        const displayName = pajaData.name || currentName || phone.split('@')[0]

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
        console.log(`[CMD] Ejecutando !ptop`)
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
            
            if (!displayName || /^\d+$/.test(displayName)) {
                try {
                    const userStats = await getUserStats(db, e.phone)
                    if (userStats.name && !/^\d+$/.test(userStats.name)) {
                        displayName = userStats.name
                    }
                } catch (err) {
                    console.log("[DB LOG] Error buscando nombre para top:", err)
                }
            }

            if (!displayName || /^\d+$/.test(displayName)) {
                const shortNum = e.phone.split('@')[0]
                displayName = shortNum.length > 8 ? `...${shortNum.slice(-4)}` : shortNum
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
                try {
                    const userStats = await getUserStats(db, e.phone)
                    if (userStats.name && !/^\d+$/.test(userStats.name)) {
                        displayName = userStats.name
                    }
                } catch (err) {}
            }
             if (!displayName || /^\d+$/.test(displayName)) {
                const shortNum = e.phone.split('@')[0]
                displayName = shortNum.length > 8 ? `...${shortNum.slice(-4)}` : shortNum
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

        console.log(`[CMD] Ejecutando !pduelo entre ${phone} y ${mentioned}`)
        
        const pajaDataA = await getUserStats(db, phone)
        const pajaDataB = await getUserStats(db, mentioned)

        const nameA_raw = getSafeName(msg, phone, true)
        if (nameA_raw && !/^\d+$/.test(nameA_raw)) pajaDataA.name = nameA_raw
        const nameA = pajaDataA.name || nameA_raw || phone.split('@')[0]

        let nameB = pajaDataB.name
        
        if (!nameB || /^\d+$/.test(nameB)) {
            const shortNumB = mentioned.split('@')[0]
            nameB = shortNumB.length > 8 ? `...${shortNumB.slice(-4)}` : shortNumB
            if (!pajaDataB.name) pajaDataB.name = nameB
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

        console.log(`[CMD] Guardando resultados de duelo...`)
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
        textMsg += `📊 Duelos de ${tagG}: ✅ ${statsG.duelos.ganados}G / ❌ ${statsG.duelos.perdidos}P`

        await sock.sendMessage(chatId, { text: textMsg }, { quoted: msg })
        return true
    }

    return true
}
