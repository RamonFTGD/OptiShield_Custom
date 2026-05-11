import fs from 'fs';
import path from 'path';
import url from 'url';

const RE = Object.freeze({
    INVISIBLE: /[\u200e\u200f\u202a-\u202e\u00a0]/g,
    SPLIT: /\s+/,
});

function cleanText(text) {
    return text ? text.replace(RE.INVISIBLE, ' ').trim() : '';
}

function extractMessageContent(msg) {
    if (!msg?.message) return '';

    const buttonResponse = msg.message?.buttonsResponseMessage?.selectedButtonId;
    if (buttonResponse) return buttonResponse;

    const templateResponse = msg.message?.templateButtonReplyMessage?.selectedId;
    if (templateResponse) return templateResponse;

    const listResponse = msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId;
    if (listResponse) return listResponse;

    const interactiveResponse = msg.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
    if (interactiveResponse) {
        try {
            const parsed = JSON.parse(interactiveResponse);
            return parsed.id || interactiveResponse;
        } catch {
            return interactiveResponse;
        }
    }

    let messageContent = msg.message;
    
    if (messageContent.viewOnceMessageV2) {
        messageContent = messageContent.viewOnceMessageV2.message;
    } else if (messageContent.viewOnceMessage) {
        messageContent = messageContent.viewOnceMessage.message;
    } else if (messageContent.ephemeralMessage) {
        messageContent = messageContent.ephemeralMessage.message;
    }

    if (messageContent?.conversation) return messageContent.conversation;
    if (messageContent?.extendedTextMessage?.text) return messageContent.extendedTextMessage.text;
    
    if (messageContent?.imageMessage?.caption) return messageContent.imageMessage.caption;
    if (messageContent?.videoMessage?.caption) return messageContent.videoMessage.caption;

    return '';
}

export async function loadPlugins(dirPath) {
    const commands = new Map();
    if (!fs.existsSync(dirPath)) {
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
                    const module = await import(url.pathToFileURL(fullPath).href + `?t=${Date.now()}`);
                    const meta = module.meta;
                    const run = module.default;
                    
                    if (meta && meta.commands && typeof run === 'function') {
                        for (const cmd of meta.commands) {
                            commands.set(cmd.toLowerCase(), { meta, run });
                        }
                    }
                } catch (error) {
                    console.error(`ERROR cargando ${item.name}:`, error.message);
                }
            }
        }
    };

    await readDir(dirPath);
    return commands;
}

export function handleEvents(sock, commandsMap, options = {}) {
    const {
        prefixList = ['!', '.', '#', '/'],
        database = null 
    } = options;

    const messageHandler = async ({ messages, type }) => {
        if (type !== 'notify') return;
        
        const msg = messages[0];
        if (!msg?.message) return;
        if (msg.key.remoteJid === 'status@broadcast') return;

        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const sender = msg.key.participant || chatId;
        const botNumber = sock.user?.id.split(':')[0];

        const rawText = extractMessageContent(msg);
        const text = cleanText(rawText);
        
        if (!text) return;

        const prefix = prefixList.find(p => text.startsWith(p));
        let commandText = text;
        let usedPrefix = '';

        if (prefix) {
            usedPrefix = prefix;
            commandText = text.slice(prefix.length).trim();
        }

        const args = commandText.split(RE.SPLIT);
        const commandName = args.shift().toLowerCase();

        const commandObj = commandsMap.get(commandName);
        if (!commandObj) return;

        const ctx = {
            command: commandName,
            args: args,
            text: args.join(' '),
            body: text,
            prefix: usedPrefix,
            chatId: chatId,
            isGroup: isGroup,
            sender: sender,
            botNumber: botNumber,
            msg: msg,
            sock: sock,
            db: database,
            info: { 
                user: { apikey: database?.apikey || global.apikey } 
            }
        };

        try {
            await commandObj.run(msg, sock, ctx);
        } catch (error) {
            console.error(`Error en [${commandName}]:`, error);
            sock.sendMessage(chatId, { text: `❌ Error: ${error.message}` }, { quoted: msg });
        }
    };

    sock.ev.on('messages.upsert', messageHandler);
}

export function watchPlugins(dirPath, commandsMap) {
    if (!fs.existsSync(dirPath)) return;
    
    fs.watch(dirPath, { recursive: true }, async (eventType, filename) => {
        if (!filename || !filename.endsWith('.js')) return;
        
        const fullPath = path.join(dirPath, filename);
        
        setTimeout(async () => {
            try {
                const moduleUrl = url.pathToFileURL(fullPath).href + `?update=${Date.now()}`;
                const module = await import(moduleUrl);
                
                if (module.meta && module.commands) {
                    for (const cmd of module.commands) {
                        commandsMap.set(cmd.toLowerCase(), { meta: module.meta, run: module.default });
                    }
                }
            } catch (error) {
                console.error(`Error recargando ${filename}:`, error.message);
            }
        }, 500);
    });
}
