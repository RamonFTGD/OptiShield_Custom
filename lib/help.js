// ═══════════════════════════════════════════════════════════════════════════
//  OptiShield Help System — Professional text-only design
// ═══════════════════════════════════════════════════════════════════════════

// ─── Design tokens ─────────────────────────────────────────────────────────
export const DESIGN = {
  SEP: '━'.repeat(32),
  SEP_SHORT: '─'.repeat(24),
  BULLET: '•',
  ARROW: '▸',
  INDENT: '  ',
  SUB_INDENT: '    ',
  LINE: '│',
  TOP: '┌',
  BOT: '└',
}

// ─── Category config ──────────────────────────────────────────────────────
export const CATEGORIES = {
  'IA':              { emoji: '🤖', name: 'Inteligencia Artificial' },
  'Buscadores':      { emoji: '🔍', name: 'Búsqueda' },
  'Descargadores':   { emoji: '📥', name: 'Descargas' },
  'Herramientas':    { emoji: '🛠️',  name: 'Herramientas' },
  'Sistema':         { emoji: '⚙️',  name: 'Sistema' },
  'Editores':        { emoji: '🎨', name: 'Editores' },
  'Fun':             { emoji: '🎭', name: 'Diversión' },
  'Game':            { emoji: '🎮', name: 'Juegos' },
  'Anime':           { emoji: '🎌', name: 'Anime' },
  'Seguridad':       { emoji: '🛡️',  name: 'Seguridad' },
  'Otros':           { emoji: '📦', name: 'Otros' },
}

// ─── Help data for every command ──────────────────────────────────────────
export const COMMAND_HELP = {
  // ── Sistema ──────────────────────────────────────────────────────────
  menu: {
    desc: 'Muestra este menú de comandos',
    usage: '.menu | .menu <comando>',
    example: '.menu ia',
    tips: ['Usa .menu <categoría> para filtrar', 'Usa .menu <comando> para ayuda detallada'],
  },
  ping: {
    desc: 'Muestra estado del servidor, latencia y recursos',
    usage: '.ping',
    example: '.ping',
  },
  update: {
    desc: 'Actualiza el bot desde el repositorio Git',
    usage: '.update | .update --force',
    example: '.update',
    ownerOnly: true,
  },
  setbot: {
    desc: 'Configura este bot como principal del grupo',
    usage: '.setbot',
    example: '.setbot',
    groupOnly: true,
  },

  // ── IA ──────────────────────────────────────────────────────────────
  ai: {
    desc: 'Lista y usa modelos de IA disponibles (24 modelos)',
    usage: '.ai | .ai <modelo> <mensaje>',
    example: '.ai gemini ¿Qué es un agujero negro?',
    tips: ['24 modelos: ChatGPT, Gemini, Llama, Qwen, Mistral y más'],
  },
  chatgpt: {
    desc: 'Chat rápido con ChatGPT Nano 4.1',
    usage: '.gpt <pregunta>',
    example: '.gpt ¿Cuál es la capital de Francia?',
  },
  gemini: {
    desc: 'Google Gemini con memoria de sesión (30 min)',
    usage: '.gemini <mensaje> | .gemini reset',
    example: '.gemini Explica la teoría de la relatividad',
    tips: ['Usa .gemini reset para reiniciar la conversación'],
  },
  gpt5: {
    desc: 'GPT-5 Mini — el modelo más rápido',
    usage: '.gpt5 <pregunta>',
    example: '.gpt5 Dame un resumen de la Segunda Guerra Mundial',
  },
  glm5: {
    desc: 'GLM-5 Turbo con memoria persistente por chat',
    usage: '.glm5 <mensaje> | .glm5 reset',
    example: '.glm5 ¿Cuál es el sentido de la vida?',
    tips: ['La memoria persiste hasta que uses .glm5 reset'],
  },
  models: {
    desc: 'Lista los 24 modelos de IA disponibles',
    commands: ['ai', 'modelo', 'model'],
  },

  // ── Búsqueda ─────────────────────────────────────────────────────────
  ytsearch: {
    desc: 'Busca videos en YouTube con resultados interactivos',
    usage: '.yts <búsqueda>',
    example: '.yts Ghost Mary On A Cross',
  },
  tiktoksearch: {
    desc: 'Busca videos en TikTok',
    usage: '.tks <búsqueda>',
    example: '.tks Gojo edits',
  },
  facebooksearch: {
    desc: 'Busca videos públicos en Facebook',
    usage: '.fbsh <búsqueda>',
    example: '.fbsh gatos graciosos',
  },
  instagramsearch: {
    desc: 'Busca posts públicos en Instagram',
    usage: '.igsh <búsqueda>',
    example: '.igsh viajes',
  },
  twittersearch: {
    desc: 'Busca tweets en X / Twitter',
    usage: '.xsh <búsqueda>',
    example: '.xsh futbol',
  },
  pinterestsearch: {
    desc: 'Busca imágenes en Pinterest',
    usage: '.pinsearch <búsqueda>',
    example: '.pinsearch paisajes 4k',
  },
  soundcloudsearch: {
    desc: 'Busca canciones en SoundCloud',
    usage: '.scs <búsqueda>',
    example: '.scs Ghost',
  },
  apple_music: {
    desc: 'Busca canciones en Apple Music',
    usage: '.am <búsqueda>',
    example: '.am Blinding Lights',
  },
  bandcampsearch: {
    desc: 'Busca música en Bandcamp',
    usage: '.bcsearch <búsqueda>',
    example: '.bcsearch Carpenter Brut',
  },
  grupos: {
    desc: 'Busca grupos públicos de WhatsApp',
    usage: '.grupos <búsqueda>',
    example: '.grupos anime',
  },
  memes: {
    desc: 'Genera memes por categoría (30+ categorías)',
    usage: '.meme <categoría> | .meme',
    example: '.meme programación',
  },
  waifu: {
    desc: 'Muestra imágenes de waifus anime (30 personajes)',
    usage: '.waifu <nombre> | .waifu',
    example: '.waifu Rem',
  },
  gif: {
    desc: 'Busca y descarga GIFs animados',
    usage: '.gif <búsqueda>',
    example: '.gif gato bailando',
  },
  images: {
    desc: 'Busca imágenes en Google',
    usage: '.images <búsqueda>',
    example: '.images paisajes 4k',
  },
  steam: {
    desc: 'Busca perfiles de Steam por ID o vanity URL',
    usage: '.steam <ID o vanity>',
    example: '.steam 76561199564497299',
  },
  bedrock: {
    desc: 'Busca, info y descarga addons de Minecraft Bedrock',
    usage: '.bedrock <búsqueda> | .bedrock info <url> | .bedrock dl <url>',
    example: '.bedrock furniture',
  },
  r34: {
    desc: 'Busca imágenes en Rule34 o descarga videos',
    usage: '.r34 <tags> | .r34 video <url>',
    example: '.r34 naruto',
    nsfw: true,
  },
  anime: {
    desc: 'Busca información de animes',
    usage: '.anime <nombre> | .animeinfo <slug>',
    example: '.anime One Piece',
  },

  // ── Descargas ────────────────────────────────────────────────────────
  tiktok: {
    desc: 'Descarga videos de TikTok (video o solo audio)',
    usage: '.tt <url>',
    example: '.tt https://vm.tiktok.com/xxx',
  },
  facebook: {
    desc: 'Descarga videos de Facebook',
    usage: '.fb <url>',
    example: '.fb https://facebook.com/watch/xxx',
  },
  twitter: {
    desc: 'Descarga videos/imágenes de Twitter/X',
    usage: '.tw <url>',
    example: '.tw https://twitter.com/user/status/xxx',
    tips: ['Usa .tw <url> | audio para solo MP3'],
  },
  instagram: {
    desc: 'Descarga contenido de Instagram',
    usage: '.igdl <url>',
    example: '.igdl https://instagram.com/p/xxx',
  },
  pinterest: {
    desc: 'Descarga imágenes o videos de Pinterest',
    usage: '.pin <url>',
    example: '.pin https://pin.it/abc123',
  },
  youtube: {
    desc: 'Descarga audio MP3 de YouTube',
    usage: '.play <búsqueda o url>',
    example: '.play Ghost Mary On A Cross',
  },
  youtube_video: {
    desc: 'Descarga video MP4 de YouTube',
    usage: '.play2 <búsqueda o url>',
    example: '.play2 Ghost Mary On A Cross',
  },
  spotify: {
    desc: 'Busca y descarga canciones de Spotify',
    usage: '.spotify <búsqueda o url>',
    example: '.spotify Blinding Lights',
  },
  soundcloud: {
    desc: 'Descarga canciones de SoundCloud',
    usage: '.sc <url>',
    example: '.sc https://soundcloud.com/user/track',
  },
  bandcamp: {
    desc: 'Descarga música de Bandcamp',
    usage: '.bc <url o búsqueda>',
    example: '.bc Carpenter Brut',
  },
  github: {
    desc: 'Busca y descarga repositorios de GitHub',
    usage: '.githubdl <búsqueda o url>',
    example: '.githubdl HutaoBot',
  },
  mediafire: {
    desc: 'Descarga archivos de MediaFire',
    usage: '.mediafire <url>',
    example: '.mediafire https://mediafire.com/file/xxx',
  },
  reddit: {
    desc: 'Busca y descarga contenido de Reddit',
    usage: '.reddit <búsqueda o url>',
    example: '.reddit memes',
  },
  xvideos: {
    desc: 'Busca y descarga videos de XVideos',
    usage: '.xv <búsqueda> | .xv dl <url>',
    example: '.xv hot',
    nsfw: true,
  },

  // ── Herramientas ─────────────────────────────────────────────────────
  translate: {
    desc: 'Traduce texto entre idiomas',
    usage: '.tl <texto> | .tl <texto> | <idioma>',
    example: '.tl Hello world | es',
    tips: ['Idiomas: es, en, fr, de, it, pt, ja, ko, zh'],
  },
  tts: {
    desc: 'Convierte texto a voz (10+ idiomas)',
    usage: '.tts <texto> | .tts <texto> | <código>',
    example: '.tts Hola mundo | en',
  },
  ocr: {
    desc: 'Extrae texto de imágenes usando IA',
    usage: '.ocr (respondiendo a imagen) | .ocr <url>',
    example: '.ocr (responde a una imagen)',
  },
  pdf: {
    desc: 'Convierte PDF a imágenes o imágenes a PDF',
    usage: '.pdf2img <url> | .img2pdf <url1> <url2> ...',
    example: '.pdf2img https://ejemplo.com/doc.pdf',
  },
  video_tools: {
    desc: 'Herramientas de video: MP3, comprimir, GIF, mute, normalizar',
    usage: '.mp3 <url> | .compressvid <url> | .gifvid <url>',
    example: '.mp3 https://ejemplo.com/video.mp4',
  },
  moneda: {
    desc: 'Tipo de cambio de 15+ monedas en tiempo real',
    usage: '.moneda',
    example: '.moneda',
  },
  clima: {
    desc: 'Clima actual y pronóstico de 7 días',
    usage: '.clima <ciudad>',
    example: '.clima Colima',
  },
  ip: {
    desc: 'Geolocalización, WHOIS y análisis de riesgo de IPs',
    usage: '.ip <dirección IP>',
    example: '.ip 8.8.8.8',
  },
  qr: {
    desc: 'Genera códigos QR desde texto o URL',
    usage: '.qr <texto o URL>',
    example: '.qr https://optishield.uk',
  },
  short: {
    desc: 'Acorta URLs largas',
    usage: '.short <url> | .short <url> <código> | .short stats <código>',
    example: '.short https://ejemplo.com/ruta/muy/larga',
  },
  web2apk: {
    desc: 'Convierte una web en app nativa Android',
    usage: '.web2apk <nombre> <url>',
    example: '.web2apk MiApp https://ejemplo.com',
  },
  maps: {
    desc: 'Busca lugares, negocios y direcciones',
    usage: '.lugares <búsqueda>',
    example: '.lugares restaurantes cerca',
  },
  lyrics: {
    desc: 'Obtiene la letra de canciones',
    usage: '.lyrics <canción o URL>',
    example: '.lyrics Bohemian Rhapsody',
  },
  calc: {
    desc: 'Resuelve operaciones matemáticas paso a paso',
    usage: '.calc <operación>',
    example: '.calc 15% de 340',
  },
  lens: {
    desc: 'Búsqueda inversa de imágenes con IA',
    usage: '.lens (respondiendo a imagen)',
    example: '.lens (responde a una imagen)',
  },
  removebg: {
    desc: 'Elimina el fondo de imágenes',
    usage: '.removebg (respondiendo a imagen) | .removebg <url>',
    example: '.removebg (responde a una imagen)',
  },
  ssweb: {
    desc: 'Toma capturas de pantalla de sitios web',
    usage: '.ssweb <url>',
    example: '.ssweb https://google.com',
  },
  get: {
    desc: 'Obtiene el HTML de una URL',
    usage: '.get <url> | .get <url> | <tag>',
    example: '.get https://example.com | div',
    ownerOnly: true,
  },
  editimg: {
    desc: 'Editor de imágenes con 20+ efectos',
    usage: '.editimg (respondiendo a imagen) | .editimg <url> | efecto | valor',
    example: '.editimg https://ejemplo.com/img.jpg | brightness | 1.5',
  },
  editvid: {
    desc: 'Editor de videos con múltiples efectos',
    usage: '.editvid (respondiendo a video) | .editvid <url> | efecto valor',
    example: '.editvid https://ejemplo.com/vid.mp4 | speed 1.5 | scale 1920',
  },
  tourl: {
    desc: 'Sube archivos a servidores y genera URL',
    usage: '.tourl (respondiendo a archivo)',
    example: '.tourl (responde a una imagen)',
  },
  whatmusic: {
    desc: 'Reconoce canciones desde audio/video (Shazam)',
    usage: '.whatmusic (respondiendo a audio/video)',
    example: '.whatmusic (responde a una nota de voz)',
  },

  // ── Stickers ─────────────────────────────────────────────────────────
  sticker: {
    desc: 'Crea stickers desde imágenes, videos o texto',
    usage: '.s (respondiendo) | .s <url> | .s <búsqueda>',
    example: '.s gatos lindos (busca en Pinterest)',
  },
  sa: {
    desc: 'Crea stickers animados desde GIFs',
    usage: '.sa <búsqueda>',
    example: '.sa beso anime',
  },
  take: {
    desc: 'Cambia el autor de un sticker',
    usage: '.take (respondiendo a sticker) | .take <nuevo nombre>',
    example: '.take Mi Pack',
  },
  brat: {
    desc: 'Genera una imagen tipo BRAT',
    usage: '.brat <texto>',
    example: '.brat Hello World',
  },
  bratvideo: {
    desc: 'Genera un video animado tipo BRAT',
    usage: '.bratvideo <texto>',
    example: '.bratvideo Hello World',
  },

  // ── Diversión ────────────────────────────────────────────────────────
  fakeq: {
    desc: 'Cita mensajes falsos de cualquier usuario',
    usage: '.fakeq @usuario | texto | mensaje',
    example: '.fakeq @5219991234 | Hola | Adiós',
  },
  gay: {
    desc: 'Genera imagen con overlay LGBT',
    usage: '.gay (respondiendo) | .gay @usuario',
    example: '.gay @usuario',
  },
  qc: {
    desc: 'Genera citas con estilo de redes sociales',
    usage: '.qc <texto>',
    example: '.qc Hola mundo',
  },
  paja: {
    desc: 'Simulador de paja (una vez cada 23h)',
    usage: '.paja | .ptop | .pduelo @usuario',
    example: '.paja',
    groupOnly: true,
  },
  toimg: {
    desc: 'Convierte stickers a imágenes PNG',
    usage: '.toimg (respondiendo a sticker)',
    example: '.toimg (responde a un sticker)',
  },
}

// ─── Generate help for a single command ────────────────────────────────────
export function getCommandHelp(command, prefix = '.') {
  const data = COMMAND_HELP[command]
  if (!data) return `❌ No hay ayuda disponible para "${prefix}${command}"`

  const lines = []
  lines.push(`┌─ 🛡️ ${data.desc}`)
  lines.push(`${DESIGN.SEP_SHORT}`)
  lines.push(``)
  lines.push(`${DESIGN.ARROW} ${prefix}${data.usage}`)
  lines.push(``)
  lines.push(`${DESIGN.BULLET} ${prefix}${data.example}`)
  if (data.tips) {
    lines.push(``)
    data.tips.forEach(t => lines.push(`${DESIGN.BULLET} ${t}`))
  }
  if (data.ownerOnly) lines.push(``, `${DESIGN.BULLET} 🔒 Solo owner`)
  if (data.nsfw) lines.push(``, `${DESIGN.BULLET} 🔞 NSFW`)
  if (data.groupOnly) lines.push(``, `${DESIGN.BULLET} 👥 Solo grupos`)
  lines.push(``, `⚡ OptiShield`)

  return lines.join('\n')
}

// ─── Generate category menu ───────────────────────────────────────────────
export function generateCategoryMenu(commandsMap, prefix = '.', filterCategory = null) {
  const categories = new Map()
  let totalCmds = 0

  for (const [cmdName, cmdData] of commandsMap) {
    const category = cmdData.meta?.class || 'Otros'
    if (filterCategory && category.toLowerCase() !== filterCategory.toLowerCase()) continue
    if (!categories.has(category)) categories.set(category, [])
    const list = categories.get(category)
    if (!list.includes(cmdName)) {
      const desc = cmdData.meta?.description || COMMAND_HELP[cmdName]?.desc || ''
      list.push({ name: cmdName, desc })
      totalCmds++
    }
  }

  if (filterCategory && totalCmds === 0) return null

  const sortedCats = [...categories.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const lines = []

  // Header
  lines.push(`┌─ 🛡️ OPTISHIELD ──────────────────────┐`)
  lines.push(`│                                          │`)
  lines.push(`│  ${filterCategory ? `📋 ${filterCategory.toUpperCase()}` : '📋 MENU DE COMANDOS'}    │`)
  lines.push(`│                                          │`)
  lines.push(`│  Total: ${totalCmds} comando${totalCmds !== 1 ? 's' : ''}         │`)
  lines.push(`│                                          │`)
  lines.push(`└──────────────────────────────────────────┘`)
  lines.push(``)

  for (const [category, cmds] of sortedCats) {
    const catConfig = CATEGORIES[category] || { emoji: '📦', name: category }
    lines.push(`◆ ${catConfig.emoji} ${catConfig.name}`)
    lines.push(`─`.repeat(28))
    
    for (const cmd of cmds) {
      const desc = cmd.desc ? ` — ${cmd.desc}` : ''
      const line = `  ${prefix}${cmd.name}${desc}`
      lines.push(line)
    }
    lines.push(``)
  }

  if (!filterCategory) {
    lines.push(`─`.repeat(32))
    lines.push(``)
    lines.push(`◆ ${prefix}menu <categoría> — Filtrar por categoría`)
    lines.push(`◆ ${prefix}help <comando> — Ayuda detallada`)
    lines.push(`◆ ${prefix}help tutorial — Guía completa`)
    lines.push(``)
    lines.push(`⚡ OptiShield v2.0`)
  } else {
    lines.push(`⚡ OptiShield — ${prefix}menu para volver`)
  }

  return lines.join('\n')
}

// ─── Tutorial system ──────────────────────────────────────────────────────
export const TUTORIALS = {
  basics: [
    '🛡️ *TUTORIAL: PRIMEROS PASOS*',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '◆ *¿Qué es OptiShield?*',
    '  Un asistente de WhatsApp con IA, descargas,',
    '  búsquedas, herramientas y entretenimiento.',
    '',
    '◆ *Comandos básicos*',
    `  • .menu     — Menú principal`,
    `  • .help     — Ayuda de un comando`,
    `  • .ping     — Estado del servidor`,
    `  • .ai       — Modelos de IA`,
    '',
    '◆ *Atajos útiles*',
    `  • Responde a un mensaje + comando`,
    `  • Usa .menu <cat> para filtrar`,
    '',
    '⚡ OptiShield',
  ].join('\n'),

  ia: [
    '🤖 *TUTORIAL: INTELIGENCIA ARTIFICIAL*',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '◆ *Modelos disponibles (24)*',
    `  • .gpt       — ChatGPT Nano 4.1`,
    `  • .gemini    — Google Gemini (memoria)`,
    `  • .gpt5      — GPT-5 Mini (rápido)`,
    `  • .glm5      — GLM-5 Turbo (memoria)`,
    `  • .ai        — Todos los modelos`,
    '',
    '◆ *Uso avanzado*',
    `  • .ai <modelo> <mensaje>`,
    `  • .gemini reset — reinicia sesión`,
    `  • .glm5 reset   — reinicia memoria`,
    '',
    '⚡ OptiShield IA',
  ].join('\n'),

  downloads: [
    '📥 *TUTORIAL: DESCARGAS*',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '◆ *Redes sociales*',
    `  • .tt <url>     — TikTok (vid+audio)`,
    `  • .fb <url>     — Facebook`,
    `  • .tw <url>     — Twitter/X`,
    `  • .igdl <url>   — Instagram`,
    `  • .pin <url>    — Pinterest`,
    '',
    '◆ *Música*',
    `  • .play <canción> — YouTube MP3`,
    `  • .spotify <url>  — Spotify`,
    `  • .sc <url>       — SoundCloud`,
    `  • .bc <url>       — Bandcamp`,
    '',
    '◆ *Otros*',
    `  • .reddit <url> — Reddit`,
    `  • .mf <url>     — MediaFire`,
    `  • .githubdl     — GitHub`,
    '',
    '⚡ OptiShield Downloads',
  ].join('\n'),

  tools: [
    '🛠️ *TUTORIAL: HERRAMIENTAS*',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '◆ *Texto e idiomas*',
    `  • .tl <texto> | es  — Traducir`,
    `  • .tts <texto>      — Texto a voz`,
    `  • .ocr (imagen)     — Leer texto de imagen`,
    `  • .lyrics <canción> — Letras`,
    '',
    '◆ *Multimedia*',
    `  • .mp3 <url>      — Video a MP3`,
    `  • .gifvid <url>   — Video a GIF`,
    `  • .pdf2img <url>  — PDF a imágenes`,
    `  • .img2pdf <url>  — Imágenes a PDF`,
    '',
    '◆ *Utilidades*',
    `  • .clima <ciudad>   — Clima`,
    `  • .ip <IP>          — Geolocalización`,
    `  • .qr <texto>       — QR`,
    `  • .short <url>      — Acortar URL`,
    `  • .moneda           — Tipo de cambio`,
    `  • .calc <op>        — Calculadora`,
    `  • .maps <lugar>     — Mapas`,
    '',
    '◆ *Edición*',
    `  • .editimg — Editor de imágenes`,
    `  • .editvid — Editor de videos`,
    `  • .removebg — Quitar fondo`,
    `  • .tourl    — Subir archivos`,
    '',
    '⚡ OptiShield Tools',
  ].join('\n'),

  stickers: [
    '🎨 *TUTORIAL: STICKERS*',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '◆ *Crear stickers*',
    `  • .s <búsqueda>  — Busca imagen y crea sticker`,
    `  • .s (responder) — De imagen/video`,
    `  • .sa <búsqueda> — Sticker animado`,
    '',
    '◆ *Personalizar*',
    `  • .take <nombre> — Cambiar autor`,
    `  • .toimg          — Sticker a imagen`,
    `  • .brat <texto>   — Sticker tipo BRAT`,
    '',
    '⚡ OptiShield Stickers',
  ].join('\n'),

  search: [
    '🔍 *TUTORIAL: BÚSQUEDAS*',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '◆ *Redes y música*',
    `  • .yts    — YouTube`,
    `  • .tks    — TikTok`,
    `  • .fbsh   — Facebook`,
    `  • .igsh   — Instagram`,
    `  • .xsh    — Twitter/X`,
    `  • .scs    — SoundCloud`,
    `  • .am     — Apple Music`,
    '',
    '◆ *Imágenes y más*',
    `  • .images       — Google Imágenes`,
    `  • .gif          — GIFs animados`,
    `  • .pinsearch    — Pinterest`,
    `  • .meme         — Memes (30 categorías)`,
    `  • .waifu        — Waifus anime`,
    `  • .steam        — Perfiles Steam`,
    `  • .bedrock      — Addons Minecraft`,
    `  • .anime        — Anime`,
    `  • .grupos       — Grupos WhatsApp`,
    '',
    '⚡ OptiShield Search',
  ].join('\n'),
}

// ─── Get available tutorials ──────────────────────────────────────────────
export function getTutorialList(prefix = '.') {
  const tutorials = [
    { key: 'basics', name: 'Primeros pasos', emoji: '🛡️' },
    { key: 'ia', name: 'Inteligencia Artificial', emoji: '🤖' },
    { key: 'search', name: 'Búsquedas', emoji: '🔍' },
    { key: 'downloads', name: 'Descargas', emoji: '📥' },
    { key: 'tools', name: 'Herramientas', emoji: '🛠️' },
    { key: 'stickers', name: 'Stickers', emoji: '🎨' },
  ]

  let text = '📚 *TUTORIALES DISPONIBLES*\n'
  text += '━━━━━━━━━━━━━━━━━━━━\n\n'
  for (const t of tutorials) {
    text += `${t.emoji} ${prefix}help ${t.key} — ${t.name}\n`
  }
  text += '\n━━━━━━━━━━━━━━━━━━━━\n⚡ OptiShield'
  return text
}
