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

const ALLOWED_NUMBERS = global.owners

function isOwner(sender) {
    return ALLOWED_NUMBERS.includes(sender);
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
    if (!isOwner(sender)) {
        return sock.sendMessage(
            chatId,
            { text: '❌ *Acceso denegado*\n\nEste comando solo puede ser usado por el owner del bot.' },
            { quoted: msg }
        );
    }

    await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } }).catch(() => { });

    const forceClone = args.includes('--force') || args.includes('-f');
    const noInstall = args.includes('--no-install') || args.includes('-n');
    const repoUrl = args.find(a => a.startsWith('http')) || null;

    let statusMsg = await sock.sendMessage(
        chatId,
        { text: `🔄 *ACTUALIZANDO BOT...*\n\n⏳ Verificando estado del repositorio...` },
        { quoted: msg }
    );

    const gitRepo = isGitRepo();
    const remoteUrl = getGitRemoteUrl();

    let updateText = `🔄 *ACTUALIZANDO BOT...*\n\n`;

    if (!gitRepo || forceClone) {
        // Git Clone
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

        updateText += `📦 *Modo:* Git Clone (forzado)\n`;
        updateText += `🔗 *URL:* ${urlToUse}\n\n`;
        updateText += `⏳ Clonando repositorio...\n`;

        await sock.sendMessage(chatId, { text: updateText, edit: statusMsg.key });

        const cloneResult = executeCommand(`git clone ${urlToUse} . --force 2>&1`);

        if (!cloneResult.success) {
            const altResult = executeCommand(`git clone ${urlToUse} temp_clone 2>&1`);
            if (altResult.success) {
                const cpResult = executeCommand('cp -r temp_clone/* . 2>/dev/null && cp -r temp_clone/.* . 2>/dev/null ; rm -rf temp_clone');
                updateText += `✅ *Clonado exitoso*\n`;
                updateText += `📁 Archivos copiados\n\n`;
            } else {
                updateText += `❌ *Error al clonar:*\n\`\`\`${cloneResult.output}\`\`\`\n\n`;
                await sock.sendMessage(chatId, { text: updateText, edit: statusMsg.key });
                return;
            }
        } else {
            updateText += `✅ *Clonado exitoso*\n\n`;
        }

    } else {
        updateText += `📦 *Modo:* Git Pull\n`;
        updateText += `🔗 *Remote:* ${remoteUrl}\n\n`;
        updateText += `⏳ Obteniendo cambios...\n`;

        await sock.sendMessage(chatId, { text: updateText, edit: statusMsg.key });

        const pullResult = executeCommand('git pull origin $(git rev-parse --abbrev-ref HEAD) 2>&1');

        if (pullResult.success) {
            updateText += `✅ *Pull exitoso*\n`;
            updateText += `📝 *Cambios:*\n\`\`\`${pullResult.output || 'Sin cambios nuevos'}\`\`\`\n\n`;
        } else {
            updateText += `⚠️ Pull normal falló, intentando reset...\n`;
            await sock.sendMessage(chatId, { text: updateText, edit: statusMsg.key });

            const resetResult = executeCommand('git fetch --all && git reset --hard origin/$(git rev-parse --abbrev-ref HEAD) 2>&1');

            if (resetResult.success) {
                updateText += `✅ *Reset exitoso*\n`;
                updateText += `📝 *Output:*\n\`\`\`${resetResult.output}\`\`\`\n\n`;
            } else {
                updateText += `❌ *Error al actualizar:*\n\`\`\`${resetResult.output}\`\`\`\n\n`;
                await sock.sendMessage(chatId, { text: updateText, edit: statusMsg.key });
                return;
            }
        }
    }

    if (!noInstall && fs.existsSync(path.join(process.cwd(), 'package.json'))) {
        updateText += `📦 *Instalando dependencias...*\n`;
        await sock.sendMessage(chatId, { text: updateText, edit: statusMsg.key });

        const installResult = executeCommand('npm install --production 2>&1', { timeout: 120000 });

        if (installResult.success) {
            updateText += `✅ *Dependencias instaladas*\n\n`;
        } else {
            updateText += `⚠️ *Error en npm install:*\n\`\`\`${installResult.output.slice(-200)}\`\`\`\n\n`;
        }
    } else if (noInstall) {
        updateText += `⏭️ *Instalación de dependencias omitida*\n\n`;
    }

    updateText +=
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `✅ *Actualización completada*\n\n` +
        `🔄 *Reiniciando bot en 3 segundos...*\n` +
        `🛡️ OptiShield System`;

    await sock.sendMessage(chatId, { text: updateText, edit: statusMsg.key });
    await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } }).catch(() => { });

    setTimeout(() => {
        console.log('🔄 Reiniciando bot por actualización...');
        process.exit(1);
    }, 3000);
}
