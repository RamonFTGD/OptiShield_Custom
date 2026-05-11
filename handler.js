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
    if (msg.message?.conversation) return msg.message.conversation;
    if (msg.message?.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
    if (msg.message?.imageMessage?.caption) return msg.message.imageMessage.caption;
    if (msg.message?.videoMessage?.caption) return msg.message.videoMessage.caption;

    const btn = msg.message?.buttonsResponseMessage?.selectedButtonId;
    if (btn) return btn;
    const tpl = msg.message?.templateButtonReplyMessage?.selectedId;
    if (tpl) return tpl;
    const lst = msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId;
    if (lst) return lst;
    const int = msg.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
    if (int) return typeof int === 'string' ? int : JSON.stringify(int);

    let c = msg.message.viewOnceMessageV2?.message || msg.message.viewOnceMessage?.message || msg.message.ephemeralMessage?.message;
    if (c?.conversation) return c.conversation;
    if (c?.extendedTextMessage?.text) return c.extendedTextMessage.text;
    if (c?.imageMessage?.caption) return c.imageMessage.caption;
    if (c?.videoMessage?.caption) return c.videoMessage.caption;

    return '';
}

export async function loadPlugins(dirPath) {
    const commands = new Map();
    if (!fs.existsSync(dirPath)) return commands;

    const readDir = async (p) => {
        const items = fs.readdirSync(p, { withFileTypes: true });
        for (const item of items) {
            const fullPath = path.join(p, item.name);
            if (item.isDirectory()) await readDir(fullPath);
            else if (item.name.endsWith('.js')) {
                try {
                    const mod = await import(url.pathToFileURL(fullPath).href + `?t=${Date.now()}`);
                    if (mod.meta?.commands && typeof mod.default === 'function') {
                        mod.meta.commands.forEach(c => commands.set(c.toLowerCase(), { meta: mod.meta, run: mod.default }));
                    }
                } catch (e) {}
            }
        }
    };
    await readDir(dirPath);
    return commands;
}

export function handleEvents(sock, commandsMap, options = {}) {
    const { prefixList = ['!', '.', '#', '/'], database = null } = options;
    const handler = async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg?.message) return;
        const chatId = msg.key.remoteJid;
        if (chatId === 'status@broadcast') return;

        const text = cleanText(extractMessageContent(msg));
        if (!text) return;

        const prefix = prefixList.find(p => text.startsWith(p));
        if (!prefix) return;

        const body = text.slice(prefix.length).trim();
        const parts = body.split(RE.SPLIT);
        const commandName = parts[0]?.toLowerCase();
        const args = parts.slice(1);

        const cmd = commandsMap.get(commandName);
        if (!cmd) return;

        const ctx = {
            command: commandName,
            args: args,
            text: args.join(' '),
            body: text,
            prefix: prefix,
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
            console.error(`[${commandName}]`, e);
        }
    };
    sock.ev.on('messages.upsert', handler);
}

export function watchPlugins(dirPath, commandsMap) {
    if (!fs.existsSync(dirPath)) return;
    fs.watch(dirPath, { recursive: true }, async (e, f) => {
        if (!f || !f.endsWith('.js')) return;
        const p = path.join(dirPath, f);
        setTimeout(async () => {
            try {
                const m = await import(url.pathToFileURL(p).href + `?u=${Date.now()}`);
                if (m.meta?.commands) {
                    m.meta.commands.forEach(c => commandsMap.set(c.toLowerCase(), { meta: m.meta, run: m.default }));
                }
            } catch (err) {}
        }, 500);
    });
}
