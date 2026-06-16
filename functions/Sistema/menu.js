import { generateCategoryMenu, getCommandHelp, TUTORIALS, getTutorialList } from '../../lib/help.js'

export const meta = {
  name: 'menu',
  commands: ['menu', 'help', 'comandos', 'ayuda', 'tutorial'],
  priority: 1,
  class: 'Sistema',
  description: 'Muestra el menú de comandos, ayuda detallada y tutoriales',
}

export default async function (msg, sock, ctx) {
  const { chatId, prefix, args, command } = ctx
  const commandsMap = global.commandsMap

  if (!commandsMap || commandsMap.size === 0) {
    return sock.sendMessage(chatId, { text: '❌ No hay comandos cargados.' }, { quoted: msg })
  }

  // ── TUTORIAL ──────────────────────────────────────────────────────────
  if (command === 'tutorial' || args[0]?.toLowerCase() === 'tutorial') {
    const topic = args[1]?.toLowerCase()
    if (topic && TUTORIALS[topic]) {
      return sock.sendMessage(chatId, { text: TUTORIALS[topic] }, { quoted: msg })
    }
    return sock.sendMessage(chatId, { text: getTutorialList(prefix) }, { quoted: msg })
  }

  // ── HELP <comando> ────────────────────────────────────────────────────
  if (command === 'help' || command === 'ayuda') {
    const targetCmd = args[0]?.toLowerCase()

    if (!targetCmd) {
      return sock.sendMessage(chatId, { text: getTutorialList(prefix) }, { quoted: msg })
    }

    // Check if it's a tutorial topic
    if (TUTORIALS[targetCmd]) {
      return sock.sendMessage(chatId, { text: TUTORIALS[targetCmd] }, { quoted: msg })
    }

    // Check if it's a known command
    const cmdData = commandsMap.get(targetCmd)
    if (cmdData) {
      const canonicalName = cmdData.meta?.commands?.[0] || targetCmd
      const helpText = getCommandHelp(canonicalName, prefix)
      return sock.sendMessage(chatId, { text: helpText }, { quoted: msg })
    }

    // Check against all commands in the map
    for (const [name, data] of commandsMap) {
      const aliases = data.meta?.commands || []
      if (aliases.includes(targetCmd) || aliases.some(a => a.toLowerCase() === targetCmd)) {
        const helpText = getCommandHelp(name, prefix)
        return sock.sendMessage(chatId, { text: helpText }, { quoted: msg })
      }
    }

    return sock.sendMessage(chatId, {
      text: `❌ El comando "${prefix}${targetCmd}" no existe.\n\n${getTutorialList(prefix)}`
    }, { quoted: msg })
  }

  // ── MENU [categoría] ─────────────────────────────────────────────────
  const filterCategory = args[0] ? args.join(' ') : null

  let menuText
  if (filterCategory) {
    // Normalize category name
    const catMap = {
      'ia': 'IA', 'inteligencia': 'IA', 'artificial': 'IA',
      'busqueda': 'Buscadores', 'buscar': 'Buscadores', 'search': 'Buscadores',
      'descarga': 'Descargadores', 'descargar': 'Descargadores', 'download': 'Descargadores',
      'herramientas': 'Herramientas', 'tools': 'Herramientas', 'utilidades': 'Herramientas',
      'sistema': 'Sistema', 'system': 'Sistema',
      'editores': 'Editores', 'editar': 'Editores', 'edit': 'Editores',
      'diversion': 'Fun', 'fun': 'Fun', 'entretenimiento': 'Fun',
      'juegos': 'Game', 'games': 'Game', 'game': 'Game',
      'anime': 'Anime',
      'seguridad': 'Seguridad', 'security': 'Seguridad',
    }
    const normalizedCat = catMap[filterCategory.toLowerCase()] || filterCategory

    menuText = generateCategoryMenu(commandsMap, prefix, normalizedCat)
    if (!menuText) {
      menuText = `❌ Categoría "${filterCategory}" no encontrada.\n\nUsa .menu para ver todas las categorías.`
    }
  } else {
    menuText = generateCategoryMenu(commandsMap, prefix)
  }

  await sock.sendMessage(chatId, { text: menuText }, { quoted: msg })
  await sock.sendMessage(chatId, { react: { text: '📋', key: msg.key } }).catch(() => {})
}
