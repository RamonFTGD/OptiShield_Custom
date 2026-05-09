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

// Logger completamente silencioso para evitar basura en consola
const logger = pino({ level: 'silent' });

const msgRetryCounterCache = new NodeCache({ stdTTL: 0, checkperiod: 0 });
const userDevicesCache = new NodeCache({ stdTTL: 0, checkperiod: 0 });

async function startConnection() {
  const { state, saveCreds } = await useMultiFileAuthState('./session');
  const { version } = await fetchLatestBaileysVersion();

  let pendingQR = null;
  let waitingDecision = true;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;

  const showQR = (qr) => {
    console.log('═══════════════════════════════════════');
    console.log('📱 Escanea este código QR con WhatsApp:');
    console.log('═══════════════════════════════════════');
    qrcode.generate(qr, { small: true });
  };

  const askPairingCode = () => {
    return new Promise((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question('📱 ¿Quieres vincularte con un código de 8 dígitos? (y/n): ', (answer) => {
        waitingDecision = false;
        if (answer.toLowerCase() === 'y') {
          rl.question('🔢 Escribe tu número de teléfono (con código de país, ej: 521234567890): ', async (number) => {
            rl.close();
            try {
              const cleanNumber = number.replace(/[^0-9]/g, '');
              const code = await global.conn.requestPairingCode(cleanNumber);
              console.log(`\n🟢 Tu código de vinculación es: ${code}\n`);
            } catch (error) {
              console.error('❌ Error al generar el código:', error);
            }
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
      if (waitingDecision) {
        pendingQR = qr;
      } else {
        showQR(qr);
      }
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      
      if (code === DisconnectReason.loggedOut) {
        console.log('❌ Sesión cerrada remotamente, elimina la carpeta /session y vuelve a iniciar.');
        process.exit(1);
        return;
      }
      
      if (reconnectAttempts >= maxReconnectAttempts) {
        console.log(`❌ Máximo de reconexiones alcanzado (${maxReconnectAttempts}). Saliendo...`);
        process.exit(1);
        return;
      }
      
      reconnectAttempts++;
      console.log(`⏳ Conexión cerrada (${code || 'Desconocido'}). Reconectando en 3s... (${reconnectAttempts}/${maxReconnectAttempts})`);
      await new Promise(r => setTimeout(r, 3000));
      global.reloadHandler(true);
    }

    if (connection === 'open') {
      reconnectAttempts = 0;
      console.log('✅ Bot conectado exitosamente a WhatsApp.');
      try {
        await global.conn.sendQueuedMessages();
      } catch (e) {}
    }
  };

  // Función para crear el socket limpiamente sin mutar opciones
  const createSocket = () => makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    browser: ["Ubuntu", "Chrome", "22.04"],
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    getMessage: async () => ({ conversation: '' }),
    msgRetryCounterCache,
    userDevicesCache,
    keepAliveIntervalMs: 55000,
    maxIdleTimeMs: 60000,
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
        try { global.conn?.ws?.close(); } catch {}
        try { global.conn?.ev?.removeAllListeners(); } catch {}
        
        global.conn = createSocket();
        global.conn.ev.on('connection.update', connectionUpdate);
        global.conn.ev.on('creds.update', saveCreds);
      }
      
      handleEvents(global.conn, global.commandsMap);
      return true;
    } catch (e) {
      console.error('❌ Error en reloadHandler:', e.message);
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
