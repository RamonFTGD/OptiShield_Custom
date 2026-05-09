export const meta = {
  name: 'menu',
  commands: ['menu', 'help', 'comandos'],
  priority: 1,
  class: 'Sistema',
}

export default async function (msg, sock, ctx) {
  const { chatId, prefix, args } = ctx;
  const commandsMap = global.commandsMap;

  if (!commandsMap || commandsMap.size === 0) {
    return sock.sendMessage(chatId, { text: '❌ No hay comandos disponibles.' }, { quoted: msg });
  }

  if (args[0]) {
    const cmdName = args[0].toLowerCase();
    const cmdData = commandsMap.get(cmdName);
    
    if (!cmdData) {
      return sock.sendMessage(
        chatId, 
        { text: `❌ El comando "${prefix}${cmdName}" no existe.` }, 
        { quoted: msg }
      );
    }

    const info = 
      `🛡️ *INFORMACIÓN DEL COMANDO* 🛡️\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📌 *Nombre:* ${cmdData.meta.name}\n` +
      `🏷️ *Comandos:* ${cmdData.meta.commands.map(c => `${prefix}${c}`).join(', ')}\n` +
      `📁 *Categoría:* ${cmdData.meta.class || 'Sin categoría'}\n` +
      `⚡ *Prioridad:* ${cmdData.meta.priority || 'N/A'}\n` +
      `${cmdData.meta.desc ? `📝 *Descripción:* ${cmdData.meta.desc}\n` : ''}`;

    return sock.sendMessage(chatId, { text: info }, { quoted: msg });
  }

  const categories = new Map();
  let totalCmds = 0;

  for (const [cmdName, cmdData] of commandsMap) {
    const category = cmdData.meta?.class || 'Otros';
    if (!categories.has(category)) {
      categories.set(category, []);
    }

    const categoryCmds = categories.get(category);
    if (!categoryCmds.includes(cmdName)) {
      categoryCmds.push(cmdName);
      totalCmds++;
    }
  }

  const sortedCategories = [...categories.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  let menuText = 
    `╭━━━〔 🛡️ OPTISHIELD 〕━━━╮\n` +
    `│                         │\n` +
    `│  📋 *MENÚ DE COMANDOS*  │\n` +
    `│                         │\n` +
    `╰━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
    `📊 Total: *${totalCmds}* comandos\n\n`;

  for (const [category, cmds] of sortedCategories) {
    menuText += `┌─▸ *${category}*\n`;
    const sortedCmds = cmds.sort();
    
    for (let i = 0; i < sortedCmds.length; i++) {
      const cmd = sortedCmds[i];
      const isLast = i === sortedCmds.length - 1;
      menuText += `│  ⌁ ${prefix}${cmd}\n`;
    }
    menuText += `└──────────────────\n\n`;
  }

  menuText += 
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 Usa *${prefix}menu <comando>* para más info\n` +
    `🛡️ OptiShield System`;

  await sock.sendMessage(chatId, { text: menuText }, { quoted: msg });
  

  await sock.sendMessage(chatId, { react: { text: '📋', key: msg.key } }).catch(() => {});
}
