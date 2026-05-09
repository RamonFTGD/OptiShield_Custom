import './OptiShield.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { startConnection } from './conexion.js';
import { loadPlugins, handleEvents, watchPlugins } from './handler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!global.OptiShield?.db) {
  console.error('❌ CRÍTICO: OptiShield.db() no se cargó correctamente en global.OptiShield.');
  process.exit(1);
}

console.log('✅ OptiShield.db() detectado y vinculado a global.OptiShield.');

(async () => {
  try {
    const pluginsDir = path.join(__dirname, 'functions');
    const commandsMap = await loadPlugins(pluginsDir);
    
    global.commandsMap = commandsMap;
    console.log(`📦 ${commandsMap.size} comandos cargados correctamente.`);
    
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