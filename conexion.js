import fs from 'fs';
import path from 'path';
import url from 'url';

const RE = {
    INVISIBLE: /[\u200e\u200f\u202a-\u202e\u00a0]/g,
    SPLIT: /\s+/,
};

function cleanText(text) {
    return text ? text.replace(RE.INVISIBLE, ' ').trim() : '';
}

function extractMessageContent(msg) {
    if (!msg?.message) return '';

    // 1. Prioridad a respuestas interactivas (Native Flow / Buttons)
    const interactive = msg.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
    if (interactive) {
        try {
            const parsed = JSON.parse(interactive);
            // Si el JSON tiene un "id", lo usamos (standard de botones nativos)
            if (parsed.id) return parsed.id;
        } catch (e) {
            // Si falla el parseo, usamos el string crudo
            return interactive;
        }
    }

    if (msg.message?.buttonsResponseMessage?.selectedButtonId) return msg.message.buttonsResponseMessage.selectedButtonId;
    if (msg.message?.templateButtonReplyMessage?.selectedId) return msg.message.templateButtonReplyMessage.selectedId;
    if (msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId) return msg.message.listResponseMessage.singleSelectReply.selectedRowId;

    // 2. Desenvolver mensajes complejos (ViewOnce, Ephemeral)
    let content = msg.message;
    if (content.viewOnceMessageV2) content = content.viewOnceMessageV2.message;
    else if (content.viewOnceMessage) content = content.viewOnceMessage.message;
    else if (content.ephemeralMessage) content = content.ephemeralMessage.message;

    // 3. Texto normal o captions
    if (content?.conversation) return content.conversation;
    if (content?.extendedTextMessage?.text) return content.extendedTextMessage.text;
    if (content?.imageMessage?.caption) return content.imageMessage.caption;
    if (content?.videoMessage?.caption) return content.videoMessage.caption;

    return '';
}

export async function loadPlugins(dirPath) {
    const commands = new Map();
    if (!fs.existsSync(dirPath)) {
        console.warn(`⚠️ Carpeta de plugins no encontrada: ${dirPath}`);
        return commands;
    }

    const readDir = async (p) => {
        const items = fs.readdirSync(p, { withFileTypes: true });
        for (const item of items) {
            const fullPath = path.join(p, item.name);
            if (item.isDirectory()) {
                await readDir(fullPath);
            } else if (item.name.endsWith('.js')) {
                try {
                    const mod = await import(url.pathToFileURL(fullPath).href + `?t=${Date.now()}`);
                    if (mod.meta?.commands && typeof mod.default === 'function') {
                        mod.meta.commands.forEach(c => {
                            commands.set(c.toLowerCase(), { meta: mod.meta, run: mod.default });
                        });
                        console.log(`✅ Plugin cargado: ${mod.meta.name} [${mod.meta.commands.join(', ')}]`);
                    }
                } catch (e) {
                    console.error(`❌ Error cargando ${item.name}:`, e.message);
                }
            }
        }
    };
    await readDir(dirPath);
    console.log(`🚀 Total comandos cargados: ${commands.size}`);
    return commands;
}

export function handleEvents(sock, commandsMap, options = {}) {
    const { 
        prefixList = ['!', '.', '#', '/'], 
        database = null 
    } = options;
    
    const handler = async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg?.message) return;
        const chatId = msg.key.remoteJid;
        if (chatId === 'status@broadcast') return;

        const rawText = extractMessageContent(msg);
        const text = cleanText(rawText);
        
        if (!text) return;

        const prefix = prefixList.find(p => text.startsWith(p));
        let body = text;
        let usedPrefix = '';

        if (prefix) {
            usedPrefix = prefix;
            body = text.slice(prefix.length).trim();
        } else {
            // LÓGICA IMPORTANTE PARA BOTONES:
            // Si no hay prefijo, verificamos si el texto coincide con un comando conocido.
            // Esto permite que botones que envían solo el ID (ej: "ping") funcionen.
            const parts = text.split(/\s+/);
            const potentialCmd = parts[0]?.toLowerCase();
            
            if (!commandsMap.has(potentialCmd)) {
                // Si no es un comando y no tiene prefijo, lo ignoramos.
                return;
            }
            // Si es un comando válido (ej: "ping"), dejamos que 'body' siga siendo el texto completo.
        }

        const parts = body.split(/\s+/);
        const commandName = parts[0]?.toLowerCase();
        const args = parts.slice(1);

        const cmd = commandsMap.get(commandName);
        if (!cmd) return;

        console.log(`👉 Ejecutando: ${commandName} | Args: ${args.join(' ')}`);

        const ctx = {
            command: commandName,
            args: args, 
            text: args.join(' '),
            body: text,
            prefix: usedPrefix,
            chatId: chatId,
            isGroup: chatId.endsWith('@g.us'),
            sender: msg.key.participant || chatId,
            msg: msg,
            sock: sock,
            db: database,
            info: { user: { apikey: database?.apikey || global.apikey } }
        };

        try {
            await cmd.run(msg, sock, ctx);
        } catch (e) {
            console.error(`Error ejecutando ${commandName}:`, e);
            sock.sendMessage(chatId, { text: `❌ Error: ${e.message}` }, { quoted: msg }).catch(() => {});
        }
    };
    
    sock.ev.on('messages.upsert', handler);
    return handler;
}

export function watchPlugins(dirPath, commandsMap) {
    if (!fs.existsSync(dirPath)) {
        console.warn('⚠️ No se puede observar plugins: carpeta no existe.');
        return;
    }

    fs.watch(dirPath, { recursive: true }, async (eventType, filename) => {
        if (!filename || !filename.endsWith('.js')) return;
        
        const fullPath = path.join(dirPath, filename);
        
        setTimeout(async () => {
            try {
                console.log(`🔄 Detectado cambio en: ${filename}. Recargando...`);
                
                const moduleUrl = url.pathToFileURL(fullPath).href + `?update=${Date.now()}`;
                const mod = await import(moduleUrl);
                
                if (mod.meta?.commands) {
                    mod.meta.commands.forEach(c => {
                        commandsMap.set(c.toLowerCase(), { meta: mod.meta, run: mod.default });
                    });
                    console.log(`✅ Plugin recargado: ${mod.meta.name}`);
                }
            } catch (err) {
                console.error(`❌ Error recargando ${filename}:`, err.message);
            }
        }, 500);
    });
}
