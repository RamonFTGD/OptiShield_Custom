import pino from 'pino';
import readline from 'readline';
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
      console.log('✅ Conectado.');
      try { await global.conn.sendQueuedMessages(); } catch {}
    }
  };

  const createSocket = () => makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    browser: ["Ubuntu", "Chrome", "22.04"],
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    getMessage: async () => ({ conversation: '' }),
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

  global.reloadHandler = async (restartConn) => {
    try {
      const { handleEvents } = await import(`./handler.js?update=${Date.now()}`);
      
      if (restartConn) {
        const oldChats = global.conn?.chats || {};
        try { global.conn?.ev?.removeAllListeners(); } catch {}
        try { global.conn?.ws?.close(); } catch {}
        
        global.conn = createSocket();
        global.conn.ev.on('connection.update', connectionUpdate);
        global.conn.ev.on('creds.update', saveCreds);
        global.conn.chats = oldChats;
      }
      
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

  if (!state.creds.registered) {
    await askPairingCode();
  }

  return { sock: global.conn, store: {} };
}

export { startConnection };
