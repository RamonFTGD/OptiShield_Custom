export const meta = {
  name: 'SetBot',
  commands: ['setbot', 'botprincipal'],
  description: 'Define a este bot como el principal del grupo (los demás bots del mismo grupo ignorarán los mensajes)',
  class: 'Otros'
}

export default async function (msg, sock, ctx) {
  const { chatId, isGroup, sender, db } = ctx

  if (!isGroup) {
    return sock.sendMessage(chatId, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: msg })
  }

  // Verificar si quien ejecuta es admin (Opcional pero recomendado)
  const groupMetadata = await sock.groupMetadata(chatId)
  const isAdmin = groupMetadata.participants.find(p => p.id === sender)?.admin

  if (!isAdmin) {
    return sock.sendMessage(chatId, { text: '❌ Solo los administradores pueden configurar el bot principal.' }, { quoted: msg })
  }

  const botNumber = sock.user.id.split(':')[0]

  // Guardar en la base de datos de OptiShield
  const res = await db.set(chatId, { mainBot: botNumber })

  if (res.status === 'ok') {
    await sock.sendMessage(chatId, { 
      text: `✅ *Bot Principal Configurado*\n\nA partir de ahora, soy el único bot que responderá en este grupo. Mis otros clones/secundarios permanecerán en silencio.\n\n📱 Mi ID: ${botNumber}` 
    }, { quoted: msg })
  } else {
    await sock.sendMessage(chatId, { text: '❌ Error al guardar en la base de datos.' }, { quoted: msg })
  }
}