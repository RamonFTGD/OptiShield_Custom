import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export const meta = {
  name: 'update',
  commands: ['update', 'actualizar'],
  priority: 0,
  class: 'Sistema',
  desc: 'Actualiza el bot desde el repositorio y lo reinicia',
}

// Lista de números permitidos (OWNER) - Cambia esto por tu número
const ALLOWED_NUMBERS = global.owners

function isOwner(sender) {
  if (!sender) return false;
  const number = sender.split(':')[0]; // Quita :0 o :1 del final
  return ALLOWED_NUMBERS.some(n => n.split(':')[0] === number);
}

function getGitRemoteUrl() {
  try {
    return execSync('git remote get-url origin 2>/dev/null', { 
      encoding: 'utf8' 
    }).trim();
  } catch {
    return null;
  }
}

function isGitRepo() {
  try {
    execSync('git rev-parse --is-inside-work-tree 2>/dev/null', { 
      encoding: 'utf8' 
    });
    return true;
  } catch {
    return false;
  }
}

function executeCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 60000,
      ...options
    });
    return { success: true, output: result.trim() };
  } catch (error) {
    return { 
      success: false, 
      output: error.stderr?.trim() || error.message 
    };
  }
}

export default async function (msg, sock, ctx) {
  const { chatId, sender, args } = ctx;

  // Verificar si es owner (con protección contra undefined)
  if (!isOwner(sender)) {
    return sock.sendMessage(
      chatId, 
      { text: '❌ *Acceso denegado*\n\nEste comando solo puede ser usado por el owner del bot.' }, 
      { quoted: msg }
    );
  }

  await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } }).catch(() => {});

  // Verificar flags
  const forceClone = args.includes('--force') || args.includes('-f');
  const noInstall = args.includes('--no-install') || args.includes('-n');
  const repoUrl = args.find(a => a.startsWith('http')) || null;

  // === FASE 1: Verificación ===
  let statusMsg = await sock.sendMessage(
    chatId,
    { text: `🔄 *ACTUALIZANDO BOT...*\n\n⏳ Verificando estado del repositorio...` },
    { quoted: msg }
  );

  const gitRepo = isGitRepo();
  const remoteUrl = getGitRemoteUrl();

  let updateText = `🔄 *ACTUALIZANDO BOT...*\n\n`;

  // === FASE 2: Git Pull o Git Clone ===
  if (!gitRepo || forceClone) {
    const urlToUse = repoUrl || remoteUrl;
    
    if (!urlToUse) {
      await sock.sendMessage(
        chatId,
        { 
          text: '❌ *Error*\n\nNo se encontró URL del repositorio.\n\n💡 Usa: `.update <url-del-repo>`\nO agrega el remote con: `git remote add origin <url>`',
          edit: statusMsg.key
        }
      );
      return;
    }

    updateText += `📦 *Modo:* Git Clone${forceClone ? ' (forzado)' : ''}\n`;
    updateText += `🔗 *URL:* ${urlToUse}\n\n`;
    updateText += `⏳ Clonando repositorio...\n`;
    
    await sock.sendMessage(chatId, { text: updateText, edit: statusMsg.key });

    // Limpiar directorio primero si es forzado
    if (forceClone) {
      executeCommand('rm -rf .git 2>/dev/null');
    }

    const cloneResult = executeCommand(`git clone ${urlToUse} . --force 2>&1`);
    
    if (!cloneResult.success) {
      // Intentar clonar en carpeta temporal y copiar
      executeCommand('rm -rf temp_update_clone 2>/dev/null');
      const altResult = executeCommand(`git clone ${urlToUse} temp_update_clone 2>&1`);
      
      if (altResult.success) {
        executeCommand('cp -rf temp_update_clone/. . 2>/dev/null');
        executeCommand('rm -rf temp_update_clone');
        updateText += `✅ *Clonado exitoso (método alternativo)*\n\n`;
      } else {
        updateText += `❌ *Error al clonar:*\n\`\`\`${cloneResult.output.slice(-300)}\`\`\`\n\n`;
        await sock.sendMessage(chatId, { text: updateText, edit: statusMsg.key });
        return;
      }
    } else {
      updateText += `✅ *Clonado exitoso*\n\n`;
    }

  } else {
    // Git Pull normal
    updateText += `📦 *Modo:* Git Pull\n`;
    updateText += `🔗 *Remote:* ${remoteUrl}\n\n`;
    updateText += `⏳ Obteniendo cambios...\n`;
    
    await sock.sendMessage(chatId, { text: updateText, edit: statusMsg.key });

    // Obtener rama actual
    const branchResult = executeCommand('git rev-parse --abbrev-ref HEAD');
    const branch = branchResult.success ? branchResult.output : 'main';

    const pullResult = executeCommand(`git pull origin ${branch} 2>&1`);
    
    if (pullResult.success && !pullResult.output.includes('error') && !pullResult.output.includes('conflict')) {
      updateText += `✅ *Pull exitoso*\n`;
      if (pullResult.output && pullResult.output !== 'Already up to date.') {
        updateText += `📝 *Cambios:*\n\`\`\`${pullResult.output.slice(-200)}\`\`\`\n\n`;
      } else {
        updateText += `📝 *Sin cambios nuevos*\n\n`;
      }
    } else {
      // Intentar reset hard si falla el pull
      updateText += `⚠️ Pull con problemas, forzando actualización...\n`;
      await sock.sendMessage(chatId, { text: updateText, edit: statusMsg.key });
      
      const fetchResult = executeCommand('git fetch --all 2>&1');
      const resetResult = executeCommand(`git reset --hard origin/${branch} 2>&1`);
      
      if (resetResult.success) {
        updateText += `✅ *Forzado exitoso*\n\n`;
      } else {
        updateText += `❌ *Error al actualizar:*\n\`\`\`${resetResult.output.slice(-300)}\`\`\`\n\n`;
        await sock.sendMessage(chatId, { text: updateText, edit: statusMsg.key });
        return;
      }
    }
  }

  // === FASE 3: Instalar dependencias ===
  if (!noInstall && fs.existsSync(path.join(process.cwd(), 'package.json'))) {
    updateText += `📦 *Instalando dependencias...*\n`;
    await sock.sendMessage(chatId, { text: updateText, edit: statusMsg.key });

    const installResult = executeCommand('npm install --production 2>&1', { timeout: 120000 });
    
    if (installResult.success) {
      updateText += `✅ *Dependencias instaladas*\n\n`;
    } else {
      updateText += `⚠️ *Advertencia en npm install:*\n\`\`\`${installResult.output.slice(-200)}\`\`\`\n\n`;
    }
  } else if (noInstall) {
    updateText += `⏭️ *Instalación omitida (--no-install)*\n\n`;
  } else {
    updateText += `⏭️ *No se encontró package.json*\n\n`;
  }

  // === FASE 4: Reinicio ===
  updateText += 
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ *Actualización completada*\n\n` +
    `🔄 *Reiniciando en 3 segundos...*\n` +
    `🛡️ OptiShield System`;

  await sock.sendMessage(chatId, { text: updateText, edit: statusMsg.key });
  await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } }).catch(() => {});

  // Reiniciar
  setTimeout(() => {
    console.log('🔄 Reiniciando bot por actualización...');
    process.exit(1);
  }, 3000);
}
