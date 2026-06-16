import './OptiShield.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { startConnection } from './conexion.js';
import { loadPlugins, handleEvents, watchPlugins } from './handler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!global.OptiShield?.db) {
  console.error('❌ CRÍTICO: OptiShield.db() no se cargó correctamente en global.OptiShield.');
  process.exit(1);
}
global.owners = [ "523142183828@s.whatsapp.net", "11923030573291@lid" ]

// Ensure required directories exist
const REQUIRED_DIRS = ['tmp', 'session'];
for (const dir of REQUIRED_DIRS) {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Directorio creado: ${dir}`);
  }
}

// Graceful shutdown handler
function gracefulShutdown(signal) {
  console.log(`\n🛑 Recibida señal ${signal}. Cerrando conexiones...`);
  
  if (global.conn?.end) {
    global.conn.end(new Error('Shutdown por señal del sistema'));
  } else if (global.conn?.ws?.close) {
    try { global.conn.ws.close(); } catch {}
  }
  
  if (global.conn?.ev?.removeAllListeners) {
    global.conn.ev.removeAllListeners();
  }
  
  setTimeout(() => {
    console.log('👋 Bot detenido.');
    process.exit(0);
  }, 2000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.warn('⚠️ Unhandled Rejection:', reason?.message || reason);
});

console.log('✅ OptiShield.db() detectado y vinculado a global.OptiShield.');

(async () => {
  try {
    const pluginsDir = path.join(__dirname, 'functions');
    
    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
      console.log('📁 Directorio de plugins creado.');
    }
    
    const commandsMap = await loadPlugins(pluginsDir);
    
    global.commandsMap = commandsMap;
    console.log(`📦 ${commandsMap.size} comandos cargados correctamente.`);
    
    if (commandsMap.size === 0) {
      console.warn('⚠️ No se cargaron comandos. Verifica la carpeta functions/.');
    }
    
    const { sock } = await startConnection();
    console.log('🚀 Conexión con WhatsApp establecida.');
    
    handleEvents(sock, commandsMap);
    watchPlugins(pluginsDir);
    
    console.log('⚡ Eventos configurados y Hot-Reload activado. Bot en línea.');
    
  } catch (error) {
    console.error('❌ Error al iniciar el bot:', error);
    process.exit(1);
  }
})();
