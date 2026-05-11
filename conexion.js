import pino from 'pino';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { 
  makeWASocket, 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion, 
  DisconnectReason,
  makeCacheableSignalKeyStore 
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import NodeCache from 'node-cache';

const logger = pino({ level: 'silent' });
const msgRetryCounterCache = new NodeCache({ stdTTL: 0, checkperiod: 0 });
const userDevicesCache = new NodeCache({ stdTTL: 0, checkperiod: 0 });

const STORE_FILE = './session/store.json';

const store = {
  chats: {},
  messages: {},
  load() {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
        this.chats = data.chats || {};
        this.messages = data.messages || {};
      }
    } catch {}
  },
  save() {
    try {
      fs.writeFileSync(STORE_FILE, JSON.stringify({ chats: this.chats, messages: this.messages }));
    } catch {}
  },
  bind(ev) {
    ev.on('chats.set', ({ chats }) => {
      for (const c of chats) this.chats[c.id] = c;
    });
    ev.on('chats.update', (updates) => {
      for (const u of updates) {
        if (!this.chats[u.id]) this.chats[u.id] = { id: u.id };
        Object.assign(this.chats[u.id], u);
      }
    });
    ev.on('chats.delete', (deletions) => {
      for (const id of deletions) delete this.chats[id];
    });
    ev.on('messages.set', ({ messages }) => {
      for (const m of messages) {
        const jid = m.key.remoteJid;
        if (!jid) continue;
        if (!this.messages[jid]) this.messages[jid] = {};
        this.messages[jid][m.key.id] = m;
      }
    });
    ev.on('messages.upsert', ({ messages, type }) => {
      for (const m of messages) {
        const jid = m.key.remoteJid;
        if (!jid) continue;
        if (!this.messages[jid]) this.messages[jid] = {};
        this.messages[jid][m.key.id] = m;
      }
    });
    ev.on('messages.update', (updates) => {
      for (const u of updates) {
        const jid = u.key.remoteJid;
        const id = u.key.id;
        if (!jid || !id || !this.messages[jid]?.[id]) continue;
        Object.assign(this.messages[jid][id], u.update);
      }
    });
    ev.on('messages.delete', (deletions) => {
      for (const d of deletions) {
        if (d.keys) {
          for (const k of d.keys) {
            if (this.messages[k.remoteJid]?.[k.id]) delete this.messages[k.remoteJid][k.id];
          }
        } else if (d.jid) {
          delete this.messages[d.jid];
        }
      }
    });
  },
  loadMessage(jid, id) {
    return this.messages[jid]?.[id] || null;
  }
};

store.load();
setInterval(() => store.save(), 10000);

function purgeClosedSessions(keys) {
  if (!keys?.sessions) return;
  for (const jid in keys.sessions) {
    if (Array.isArray(keys.sessions[jid])) {
      keys.sessions[jid] = keys.sessions[jid].filter(s => !s?.indexInfo?.closed || s.indexInfo.closed <= 0);
    }
  }
}

async function startConnection() {
  const { state, saveCreds } = await useMultiFileAuthState('./session');
  purgeClosedSessions(state.keys);
  
  const { version } = await fetchLatestBaileysVersion();
  let pendingQR = null;
  let waitingDecision = true;
  let reconnecting = false;

  const showQR = (qr) => {
    console.log('═══════════════════════════════════════');
    console.log('📱 Escanea este código QR con WhatsApp:');
    console.log('═══════════════════════════════════════');
    qrcode.generate(qr, { small: true });
  };

  const askPairingCode = () => {
    return new Promise((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question('📱 ¿Vincular con código de 8 dígitos? (y/n): ', (answer) => {
        waitingDecision = false;
        if (answer.toLowerCase() === 'y') {
          rl.question('🔢 Número con código de país (ej: 521234567890): ', async (number) => {
            rl.close();
            try {
              const code = await global.conn.requestPairingCode(number.replace(/[^0-9]/g, ''));
              console.log(`\n🟢 Código: ${code}\n`);
            } catch (e) { console.error('❌ Error:', e.message); }
            resolve(false);
          });
        } else {
          rl.close();
          if (pendingQR) showQR(pendingQR);
          resolve(true);
        }
      });
    });
  };

  const connectionUpdate = async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      if (waitingDecision) pendingQR = qr;
      else showQR(qr);
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      
      if (code === DisconnectReason.loggedOut) {
        console.log('❌ Sesión cerrada. Elimina /session y reinicia.');
        process.exit(1);
        return;
      }

      if (!reconnecting) {
        reconnecting = true;
        purgeClosedSessions(state.keys);
        console.log(`⏳ Reconectando... (${code || 'Desconocido'})`);
        setTimeout(() => global.reloadHandler(true), 1000);
      }
    }

    if (connection === 'open') {
      reconnecting = false;
      console.log('✅ Conectado. Sincronizando historial...');
      try { await global.conn.sendQueuedMessages(); } catch {}
    }
  };

  const createSocket = () => {
    const sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      browser: ["Ubuntu", "Chrome", "22.04"],
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      syncFullHistory: true,
      getMessage: async (key) => {
        const msg = store.loadMessage(key.remoteJid, key.id);
        return msg || { conversation: '' };
      },
      msgRetryCounterCache,
      userDevicesCache,
      keepAliveIntervalMs: 25000,
      maxIdleTimeMs: 120000,
      retryRequestDelayMs: 100,
      maxMsgRetryCount: 3,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
    });

    store.bind(sock.ev);
    return sock;
  };

  global.reloadHandler = async (restartConn) => {
    try {
      const { handleEvents, loadPlugins } = await import(`./handler.js?update=${Date.now()}`);
      
      // Asegurar que los plugins estén cargados (Fix para respuesta nula)
      if (!global.commandsMap) {
        console.log('📦 Cargando plugins iniciales...');
        global.commandsMap = await loadPlugins('./plugins');
      }
      
      if (restartConn) {
        const oldChats = global.conn?.chats || {};
        try { global.conn?.ev?.removeAllListeners(); } catch {}
        try { global.conn?.ws?.close(); } catch {}
        
        global.conn = createSocket();
        global.conn.ev.on('connection.update', connectionUpdate);
        global.conn.ev.on('creds.update', saveCreds);
        global.conn.chats = oldChats;
      }
      
      global.store = store;
      
      // Limpiar listeners antiguos de mensajes antes de volver a adjuntar para evitar duplicados
      global.conn.ev.off('messages.upsert', global.conn.handler);
      
      handleEvents(global.conn, global.commandsMap);
      return true;
    } catch (e) {
      console.error('❌ reloadHandler:', e.message);
      setTimeout(() => global.reloadHandler(true), 2000);
      return false;
    }
  };

  global.conn = createSocket();
  global.conn.ev.on('connection.update', connectionUpdate);
  global.conn.ev.on('creds.update', saveCreds);

  // CORRECCIÓN CRÍTICA: Forzar la carga inicial del handler
  setTimeout(() => {
    global.reloadHandler(false).catch(e => console.error('Error inicial:', e));
  }, 2000);

  if (!state.creds.registered) {
    await askPairingCode();
  }

  return { sock: global.conn, store };
}

export { startConnection };
