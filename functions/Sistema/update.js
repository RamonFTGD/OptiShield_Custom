import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { isOwner, reply, editLog } from '../../lib/utils.js'

export const meta = {
  name: 'update',
  commands: ['update', 'actualizar', 'gitpull'],
  priority: 0,
  class: 'Sistema',
  ownerOnly: true,
  description: 'Actualiza el bot desde el repositorio Git (solo owners)'
}

const ALLOWED_REMOTES = ['github.com', 'gitlab.com', 'bitbucket.org']

function isSafeUrl(url) {
  try {
    const parsed = new URL(url)
    return ALLOWED_REMOTES.some(r => parsed.hostname.includes(r))
  } catch {
    // SSH URLs like git@github.com:user/repo.git
    return ALLOWED_REMOTES.some(r => url.includes(r))
  }
}

function execSafe(cmd, options = {}) {
  try {
    const result = execSync(cmd, {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 60000,
      ...options,
    })
    return { success: true, output: result.trim() }
  } catch (error) {
    return { success: false, output: error.stderr?.trim() || error.message }
  }
}

function protectConfig() {
  const configPath = path.join(process.cwd(), 'optishield.json')
  let backupConfig = null
  if (fs.existsSync(configPath)) {
    try {
      backupConfig = fs.readFileSync(configPath, 'utf-8')
    } catch {}
  }
  return { configPath, backupConfig }
}

function restoreConfig({ configPath, backupConfig }) {
  if (backupConfig) {
    try {
      fs.writeFileSync(configPath, backupConfig, 'utf-8')
      return true
    } catch {}
  }
  return false
}

export default async function (msg, sock, ctx) {
  const { chatId, sender, args } = ctx

  // 🔒 SOLO OWNERS
  if (!isOwner(sender)) {
    await reply(sock, chatId, '❌ *Acceso denegado.* Solo el owner del bot puede actualizar.', msg)
    return true
  }

  await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } }).catch(() => {})

  const forceClone = args.includes('--force') || args.includes('-f')
  const noInstall = args.includes('--no-install') || args.includes('-n')
  const repoUrl = args.find(a => a.startsWith('http') || a.includes('@'))

  // 🔒 Validar URL del repo
  if (repoUrl && !isSafeUrl(repoUrl)) {
    await reply(sock, chatId, '❌ Solo se permiten repositorios de GitHub, GitLab o Bitbucket.', msg)
    return true
  }

  const { key: statusKey } = await sock.sendMessage(chatId, { text: '🔄 *ACTUALIZANDO BOT...*\n\n⏳ Verificando...' }, { quoted: msg })
  const edit = (text) => sock.sendMessage(chatId, { text, edit: statusKey }).catch(() => {})

  const configBackup = protectConfig()
  const gitRepo = fs.existsSync(path.join(process.cwd(), '.git'))

  if (!gitRepo || forceClone) {
    const urlToUse = repoUrl || execSafe('git remote get-url origin 2>/dev/null').output
    if (!urlToUse) {
      await edit('❌ No hay repositorio configurado.\nUsa: .update https://github.com/user/repo.git')
      return
    }

    await edit(`📦 Clonando repositorio...\n🔗 ${urlToUse}`)
    if (forceClone) execSafe('rm -rf .git 2>/dev/null')

    const clone = execSafe(`git clone ${urlToUse} . --force 2>&1`)
    if (!clone.success) {
      await edit(`❌ Error al clonar:\n${clone.output.slice(-300)}`)
      return
    }

    if (restoreConfig(configBackup)) await edit(`✅ Clonado exitoso\n🛡️ Config protegido\n\n📦 Instalando dependencias...`)
    else await edit(`✅ Clonado exitoso\n\n📦 Instalando dependencias...`)
  } else {
    const branch = execSafe('git rev-parse --abbrev-ref HEAD').output || 'main'
    await edit(`📦 Git Pull (${branch})\n⏳ Obteniendo cambios...`)

    const pull = execSafe(`git pull origin ${branch} 2>&1`)
    if (!pull.success) {
      await edit(`⚠️ Pull falló, forzando...\n⏳ git fetch --all && git reset --hard`)
      execSafe('git fetch --all 2>&1')
      execSafe(`git reset --hard origin/${branch} 2>&1`)
      if (restoreConfig(configBackup)) await edit(`✅ Forzado exitoso\n🛡️ Config protegido\n\n📦 Instalando dependencias...`)
      else await edit(`✅ Forzado exitoso\n\n📦 Instalando dependencias...`)
    } else {
      if (restoreConfig(configBackup)) await edit(`✅ Pull exitoso\n🛡️ Config protegido\n\n📦 Instalando dependencias...`)
      else await edit(`✅ Pull exitoso\n\n📦 Instalando dependencias...`)
    }
  }

  // 🔒 Instalar solo --production para evitar scripts maliciosos
  if (!noInstall) {
    await edit('📦 Instalando dependencias (solo producción)...')
    const install = execSafe('npm install --production --no-audit --no-fund 2>&1', { timeout: 120000 })
    if (!install.success) {
      await edit(`⚠️ npm install con problemas:\n${install.output.slice(-200)}`)
    } else {
      await edit('✅ Dependencias instaladas correctamente')
    }
  }

  await edit('✅ *Actualización completada*\n\n🔄 *Reiniciando en 3 segundos...*')
  await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } }).catch(() => {})

  setTimeout(() => {
    console.log('🔄 Reiniciando bot por actualización...')
    process.exit(1)
  }, 3000)
}
