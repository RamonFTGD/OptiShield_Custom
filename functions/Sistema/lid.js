import { getUserLevel, getLevelName } from '../../lib/security.js'

export const meta = {
  name: 'lid',
  commands: ['lid', 'userinfo', 'me'],
  priority: 5,
  class: 'Sistema',
  desc: 'Muestra la información del usuario que utilizó el comando',
}

export default async function (msg, sock, ctx) {
  const { sender, chatId } = ctx
  const name = msg.pushName || 'Desconocido'
  const jid = sender
  const number = jid.split('@')[0]
  const level = getUserLevel(jid)
  const levelName = getLevelName(level)

  const text = `
╔════════════════════════╗
      👤 *PERFIL DE USUARIO*
╚════════════════════════╝

◆ *Nombre:* ${name}
◆ *Número:* ${number}
◆ *ID:* ${jid}
◆ *Rango:* ${levelName}

✨ *OptiShield Custom*`.trim()

  await sock.sendMessage(chatId, { text }, { quoted: msg })
  return true
}
