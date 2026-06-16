<div align="center">

# 🛡️ OptiShield Custom

### WhatsApp Bot — v3.0.0

![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)
![License](https://img.shields.io/badge/License-ISC-blue)
![Version](https://img.shields.io/badge/Version-3.0.0-purple)
![Baileys](https://img.shields.io/badge/Baileys-7.0-orange)

**Bot de WhatsApp con IA, descargadores, herramientas y más.**
Potenciado por [OptiShield API](https://optishield.uk/) — Powered by [Baileys](https://github.com/WhiskeySockets/Baileys)

[🚀 Instalación](#-instalación) • [📦 Comandos](#-comandos) • [⚙️ Configuración](#️-configuración) • [🤖 API](#-optishield-api)

</div>

---

## 📋 Tabla de contenidos

- [Características](#-características)
- [Instalación](#-instalación)
- [Configuración](#️-configuración)
- [Comandos](#-comandos)
- [OptiShield API](#-optishield-api)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Desarrollo](#-desarrollo)
- [Seguridad](#-seguridad)
- [Licencia](#-licencia)

---

## ✨ Características

| Categoría | Descripción |
|-----------|-------------|
| 🤖 **IA** | ChatGPT, Gemini, GPT-5, GLM-5, Llama, Gemma, Qwen y más |
| 🔍 **Búsqueda** | YouTube, TikTok, Pinterest, Instagram, Twitter, Facebook, Reddit |
| ⬇️ **Descargas** | TikTok, YouTube, Twitter, Facebook, Pinterest, Spotify, Reddit, MediaFire |
| 🎨 **Edición** | Editar imágenes/videos con IA |
| 🖼️ **Stickers** | Crear stickers animados, brat, y personalizados |
| 🛠️ **Herramientas** | QR, OCR, traducción, TTS, clima, ubicación, URLs cortas |
| 🎮 **Juegos** | Juegos interactivos |
| 😄 **Diversión** | Memes, GIFs, imágenes aleatorias |
| 📊 **Sistema** | Ping, menú, actualización, configuración |

---

## 🚀 Instalación

### Requisitos previos

- **Node.js** 18 o superior
- **FFmpeg** instalado en el sistema
- **Git** (opcional)

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/RamonFTGD/OptiShield_Custom.git
cd OptiShield_Custom

# 2. Instalar dependencias
npm install

# 3. Configurar API Key (ver sección de configuración)
# Crea el archivo optishield.json

# 4. Iniciar el bot
npm start
```

### Inicio rápido con shell script

```bash
bash index.sh
```

---

## ⚙️ Configuración

### Archivo `optishield.json`

Crea este archivo en la raíz del proyecto:

```json
{
  "apikey": "TU_API_KEY_AQUI"
}
```

> ⚠️ **Sin este archivo el bot NO funcionará.**

### Obtener API Key

1. Ve a [optishield.uk](https://optishield.uk/)
2. Regístrate e inicia sesión
3. Contrata una API Key desde el panel
4. Copia la key y pégala en `optishield.json`

### Owners del bot

Edita `index.js` para agregar los números de teléfono de los owners:

```javascript
global.owners = [
  "521234567890@s.whatsapp.net",  // Owner principal
  "11923030573291@lid"            // Owner secundario
]
```

### Prefijos de comandos

El bot responde a estos prefijos:

| Prefijo | Ejemplo |
|---------|---------|
| `.` | `.ping`, `.gpt hola` |
| `!` | `!ping`, `!gpt hola` |
| `#` | `#ping`, `#gpt hola` |
| `/` | `/ping`, `/gpt hola` |

---

## 📦 Comandos

### 🤖 Inteligencia Artificial

| Comando | Descripción | Premium |
|---------|-------------|---------|
| `.gpt <pregunta>` | ChatGPT | ✅ |
| `.gemini <pregunta>` | Google Gemini | ✅ |
| `.gpt5 <pregunta>` | GPT-5 Mini | ✅ |
| `.glm5 <pregunta>` | GLM-5 Turbo | ✅ |
| `.ai <modelo> <msg>` | Seleccionar modelo | ✅ |
| `.ai` | Ver modelos disponibles | ✅ |

### 🔍 Búsqueda

| Comando | Descripción |
|---------|-------------|
| `.yt <texto>` | Buscar en YouTube |
| `.tiktok <url>` | Buscar en TikTok |
| `.pin <url>` | Buscar en Pinterest |
| `.ig <usuario>` | Buscar en Instagram |
| `.tw <usuario>` | Buscar en Twitter |
| `.fb <texto>` | Buscar en Facebook |
| `.reddit <subreddit>` | Buscar en Reddit |
| `.gif <texto>` | Buscar GIFs |
| `.meme` | Memes aleatorios |
| `.google <texto>` | Imágenes de Google |

### ⬇️ Descargas

| Comando | Descripción |
|---------|-------------|
| `.tt <url>` | Descargar TikTok |
| `.play <url/texto>` | Descargar YouTube (audio) |
| `.play2 <url/texto>` | Descargar YouTube (video) |
| `.tw dl <url>` | Descargar Twitter |
| `.fb <url>` | Descargar Facebook |
| `.pin dl <url>` | Descargar Pinterest |
| `.spotify <url>` | Descargar Spotify |
| `.rdl <url>` | Descargar Reddit |
| `.mediafire <url>` | Descargar MediaFire |
| `.sc <url>` | Descargar SoundCloud |

### 🎨 Stickers

| Comando | Descripción |
|---------|-------------|
| `.sticker` / `.s` | Crear sticker de imagen/video |
| `.sticker <query>` | Buscar y crear sticker |
| `.brat <texto>` | Sticker de texto brat |
| `.bratvid <texto>` | Video brat animado |

### 🛠️ Herramientas

| Comando | Descripción |
|---------|-------------|
| `.qr <texto>` | Generar código QR |
| `.ocr` | Extraer texto de imagen (OCR) |
| `.translate <idioma> <texto>` | Traducir texto |
| `.tts <texto>` | Texto a voz |
| `.clima <ciudad>` | Ver clima |
| `.ip <ip>` | Ubicar IP |
| `.short <url>` | Acortar URL |
| `.ssweb <url>` | Screenshot web |
| `.removebg` | Eliminar fondo de imagen |
| `.pdf <url>` | Herramientas PDF |
| `.lyrics <canción>` | Ver letras de canciones |
| `.whatmusic` | Identificar música |

### 📊 Sistema

| Comando | Descripción |
|---------|-------------|
| `.ping` | Verificar estado del bot |
| `.menu` | Ver menú de comandos |
| `.update` | Actualizar bot (solo owners) |

---

## 🔌 OptiShield API

El bot utiliza la API de OptiShield para la mayoría de funciones. Todas las peticiones pasan por:

```
https://optishield.uk/api/
```

### Funciones principales

| Método | Descripción |
|--------|-------------|
| `callApi(type, params)` | Llamada genérica a la API |
| `uploadFile(buffer, filename)` | Subir archivo a storage |
| `uploadFileGitHub(buffer, filename)` | Subir a GitHub |
| `db(user, method, data)` | Base de datos de usuarios |

### Ejemplo de uso

```javascript
// ChatGPT
const res = await global.OptiShield.callApi('ChatGPT', { prompt: 'Hola' });

// Subir imagen
const upload = await global.OptiShield.uploadFile(buffer, 'imagen.png');

// Base de datos
await global.OptiShield.db.set('user@s.whatsapp.net', { nivel: 10 });
```

---

## 📁 Estructura del proyecto

```
OptiShield_Custom/
├── index.js              # Punto de entrada principal
├── index.sh              # Script de inicio
├── OptiShield.js         # Librería SDK (v3.0.0)
├── conexion.js           # Conexión WhatsApp (Baileys)
├── handler.js            # Manejador de comandos y eventos
├── package.json          # Dependencias
├── optishield.json       # API Key (NO subir a git)
│
├── functions/            # Plugins/Comandos
│   ├── IA/               # Inteligencia Artificial
│   │   ├── chatgpt.js    # ChatGPT
│   │   ├── gemini.js     # Google Gemini
│   │   ├── gpt5.js       # GPT-5 Mini
│   │   ├── glm5.js       # GLM-5 Turbo
│   │   └── models.js     # Selector de modelos
│   │
│   ├── Search/           # Búsquedas
│   │   ├── youtube.js    # YouTube
│   │   ├── tiktok.js     # TikTok
│   │   ├── pinterest.js  # Pinterest
│   │   ├── instagram.js  # Instagram
│   │   ├── twitter.js    # Twitter/X
│   │   ├── facebook.js   # Facebook
│   │   ├── reddit.js     # Reddit
│   │   ├── gif.js        # GIFs
│   │   ├── memes.js      # Memes
│   │   └── ...
│   │
│   ├── download/         # Descargas
│   │   ├── play.js       # YouTube Audio
│   │   ├── play2.js      # YouTube Video
│   │   ├── tiktok.js     # TikTok
│   │   ├── twitter.js    # Twitter
│   │   ├── facebook.js   # Facebook
│   │   ├── pinterest.js  # Pinterest
│   │   ├── spotify.js    # Spotify
│   │   ├── reddit.js     # Reddit
│   │   ├── mediafire.js  # MediaFire
│   │   └── ...
│   │
│   ├── stickers/         # Stickers
│   │   ├── sticker.js    # Sticker principal
│   │   ├── brat.js       # Brat texto
│   │   ├── brat-video.js # Brat video
│   │   └── ...
│   │
│   ├── tools/            # Herramientas
│   │   ├── qr.js         # Generador QR
│   │   ├── ocr.js        # OCR
│   │   ├── translate.js  # Traducción
│   │   ├── tts.js        # Texto a voz
│   │   ├── ip-locate.js  # Geolocalización
│   │   ├── short-url.js  # Acortador URLs
│   │   ├── ssweb.js      # Screenshot web
│   │   ├── remove-bg.js  # Eliminar fondo
│   │   ├── lyrics.js     # Letras de canciones
│   │   └── ...
│   │
│   ├── editing/          # Edición
│   │   ├── imagen.js     # Editar imágenes
│   │   ├── video.js      # Editar videos
│   │   └── to-image.js   # Conversión
│   │
│   ├── fun/              # Diversión
│   │   ├── qc.js         # Quote cards
│   │   └── gay-imagen.js # Filtros
│   │
│   ├── games/            # Juegos
│   │   └── paja.js       # Juego
│   │
│   ├── Sistema/          # Sistema
│   │   ├── menu.js       # Menú
│   │   ├── ping.js       # Ping/Status
│   │   ├── serbot.js     # Config bot
│   │   └── update.js     # Actualización
│   │
│   └── Otros/            # Otros
│       └── fake-quoted.js
│
├── lib/                  # Bibliotecas
│   ├── security.js       # Sistema de seguridad y permisos
│   ├── utils.js          # Utilidades generales
│   ├── help.js           # Ayuda y documentación
│   └── sticker.js        # Funciones de stickers
│
├── config/               # Configuración (NO subir a git)
│   ├── security.json     # Niveles de usuario
│   ├── chats.json        # Config de chats
│   └── stats.json        # Estadísticas
│
├── session/              # Sesión WhatsApp (NO subir a git)
└── tmp/                  # Archivos temporales
```

---

## 🛠️ Desarrollo

### Agregar nuevo comando

Crea un archivo `.js` en la carpeta `functions/` correspondiente:

```javascript
export const meta = {
  name: 'MiComando',
  commands: ['micomando', 'mc'],  // Prefijos del comando
  priority: 5,                      // 0-9 (0 = máxima prioridad)
  class: 'Herramientas',           // Categoría
  ownerOnly: false,                 // Solo owners
  premium: false,                   // Solo premium
  description: 'Descripción del comando'
}

export default async function (msg, sock, ctx) {
  const { chatId, text, sender } = ctx

  // Tu lógica aquí
  await sock.sendMessage(chatId, { text: '¡Hola!' }, { quoted: msg })

  return true
}
```

### Hot-Reload

El bot detecta cambios automáticamente en la carpeta `functions/` y recarga los plugins sin reiniciar.

### Variables del contexto (`ctx`)

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `ctx.command` | string | Nombre del comando ejecutado |
| `ctx.args` | array | Argumentos del comando |
| `ctx.text` | string | Texto completo de argumentos |
| `ctx.chatId` | string | ID del chat |
| `ctx.sender` | string | ID del remitente |
| `ctx.isGroup` | boolean | ¿Es grupo? |
| `ctx.msg` | object | Mensaje original |
| `ctx.sock` | object | Socket de WhatsApp |
| `ctx.apikey` | string | API Key del config |
| `ctx.meta` | object | Metadata del plugin |

---

## 🔒 Seguridad

### OptiShield.js v3.0.0

La librería SDK incluye múltiples mejoras de seguridad:

| Característica | Descripción |
|----------------|-------------|
| **Circuit Breaker** | Bloquea requests tras 5 fallos consecutivos |
| **Request Queue** | Limita concurrencia a 5 requests simultáneos |
| **Config Cache** | Cache de 30s para evitar re-leer archivos |
| **Exponential Backoff** | Reintentos con jitter para evitar thundering herd |
| **Validación DB** | Whitelist de métodos + regex para JIDs |
| **Sanitización** | Filenames limpios en uploads |
| **Health Check** | Verifica conexión API al iniciar |

### Sistema de permisos (`lib/security.js`)

| Nivel | Descripción |
|-------|-------------|
| `BANNED (-1)` | Usuario baneado |
| `USER (0)` | Usuario normal |
| `PREMIUM (1)` | Usuario premium |
| `ADMIN (2)` | Administrador |
| `OWNER (3)` | Propietario del bot |
| `BOT (4)` | Bot mismo |

### Rate Limiting

- **20 comandos por minuto** por usuario
- **3 segundos** de cooldown entre comandos
- **Sistema antiflood** configurable por chat

---

## 📊 Dependencias principales

| Paquete | Versión | Uso |
|---------|---------|-----|
| `@whiskeysockets/baileys` | ^7.0.0 | Conexión WhatsApp |
| `axios` | ^1.13.2 | Peticiones HTTP |
| `sharp` | ^0.33.5 | Procesamiento de imágenes |
| `fluent-ffmpeg` | ^2.1.3 | Procesamiento de video |
| `cheerio` | ^1.2.0 | Parsing HTML |
| `gifted-btns` | ^1.0.2 | Botones interactivos |
| `node-webpmux` | ^3.2.1 | Stickers WebP |
| `pino` | ^9.0.0 | Logging |

---

## 🔧 Solución de problemas

### El bot no inicia

```bash
# Verificar Node.js
node --version  # Debe ser 18+

# Reinstalar dependencias
rm -rf node_modules
npm install

# Verificar FFmpeg
ffmpeg -version
```

### Error de API Key

Asegúrate de que `optishield.json` existe y tiene una API key válida.

### Bot se desconecta

El bot tiene reconexión automática con exponential backoff. Si persiste, verifica tu conexión a internet.

---

## 📄 Licencia

ISC License — Ver [package.json](package.json)

---

<div align="center">

### 🛡️ OptiShield Custom

**Desarrollado con ❤️ por Ramón Luna**

[![GitHub](https://img.shields.io/badge/GitHub-RamonFTGD-181717?style=for-the-badge&logo=github)](https://github.com/RamonFTGD)
[![OptiShield](https://img.shields.io/badge/OptiShield-UK-6C3483?style=for-the-badge)](https://optishield.uk/)

</div>
