import fs from 'fs';
import path from 'path';
import url from 'url';

export async function loadPlugins(dirPath) {
  const commands = new Map();
  
  if (!fs.existsSync(dirPath)) {
    console.warn(`⚠️ No se encontró la carpeta: ${dirPath}`);
    return commands;
  }

  const readDir = async (currentPath) => {
    const items = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(currentPath, item.name);
      
      if (item.isDirectory()) {
        await readDir(fullPath);
      } else if (item.name.endsWith('.js')) {
        try {
          console.log(`🔍 Intentando cargar: ${item.name}...`);
          
          const module = await import(url.pathToFileURL(fullPath).href);
          const meta = module.meta;
          const run = module.default;

          if (meta && meta.commands && typeof run === 'function') {
            for (const cmd of meta.commands) {
              commands.set(cmd.toLowerCase(), { meta, run });
            }
            console.log(`📦 Plugin cargado: ${meta.name} [${meta.commands.join(', ')}]`);
          } else {
             console.log(`⚠️ ${item.name} no tiene exportación válida (meta/run)`);
          }
        } catch (error) {
          console.error(`\n❌❌❌ ERROR CRÍTICO EN EL ARCHIVO: ${item.name} ❌❌❌`);
          console.error(`Detalle del error en ${item.name}:`, error.message);
          console.error(`Pila de errores:\n`, error.stack);
          console.log('--------------------------------------------------\n');
        }
      }
    }
  };

  await readDir(dirPath);
  console.log(`🚀 Total de comandos cargados: ${commands.size}\n`);
  return commands;
}

export function watchPlugins(dirPath) {
  if (!fs.existsSync(dirPath)) return;

  fs.watch(dirPath, { recursive: true }, async (eventType, filename) => {
    if (!filename || !filename.endsWith('.js')) return;

    const fullPath = path.join(dirPath, filename);
    
    setTimeout(async () => {
      try {
        const fileUrl = url.pathToFileURL(fullPath).href + `?update=${Date.now()}`;
        const module = await import(fileUrl);
        const meta = module.meta;
        const run = module.default;

        if (meta && meta.commands && typeof run === 'function') {
          for (const cmd of meta.commands) {
            global.commandsMap.set(cmd.toLowerCase(), { meta, run });
          }
          console.log(`🔄 Plugin actualizado en caliente: ${meta.name} [${meta.commands.join(', ')}]`);
        } else {
          console.log(`⚠️ ${filename} editado pero no tiene exportación válida.`);
        }
      } catch (error) {
        console.error(`❌ Error recargando ${filename}:`, error.message);
      }
    }, 500);
  });
}

export function handleEvents(sock, commandsMap) {
  const db = global.OptiShield?.db;
  const prefixList = ['!', '.', '#', '/'];

  sock.handler = async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg?.message || msg.key.remoteJid === 'status@broadcast') return;

    const chatId = msg.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    const botNumber = sock.user?.id?.split(':')[0];

    if (isGroup && botNumber) {
      try {
        const groupData = await db.get(chatId, ['mainBot']);
        const mainBot = groupData?.data?.mainBot;
        if (mainBot && mainBot !== botNumber) return; 
      } catch (e) {}
    }

    let text = '';
    try {
      const msgType = Object.keys(msg.message)[0];
      if (msgType === 'conversation') text = msg.message.conversation;
      else if (msgType === 'extendedTextMessage') text = msg.message.extendedTextMessage.text;
      else if (msgType === 'viewOnceMessageV2' || msgType === 'viewOnceMessage') {
        const innerMsg = msg.message[msgType].message;
        const innerType = Object.keys(innerMsg)[0];
        if (innerType === 'conversation') text = innerMsg.conversation;
        else if (innerType === 'extendedTextMessage') text = innerMsg.extendedTextMessage.text;
      }
    } catch (e) {}

    const prefix = prefixList.find(p => text.startsWith(p));
    if (!prefix) return;

    const args = text.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = commandsMap.get(commandName);
    if (!command) return;

    const ctx = {
      chatId,
      isGroup,
      args,
      prefix,
      sender: msg.key.participant || chatId,
      db
    };

    try {
      await command.run(msg, sock, ctx);
    } catch (error) {
      console.error(`❌ Error ejecutando ${commandName}:`, error);
      sock.sendMessage(chatId, { text: '❌ Ocurrió un error interno.' }, { quoted: msg }).catch(() => {});
    }
  };

  sock.ev.on('messages.upsert', sock.handler);

  sock.ev.on('groups.update', (updates) => {
    for (const update of updates) {
      console.log(`👥 Grupo actualizado ${update.id}:`, update.update);
    }
  });

  sock.ev.on('group-participants.update', (data) => {
    const { id, participants, action } = data;
    console.log(`🚪 Acción [${action}] en grupo ${id} - Usuarios: ${participants.join(', ')}`);
  });
}