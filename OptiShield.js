import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import FormData from "form-data";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LIB_NAME = "OptiShield.js";
const LIB_PATH = path.join(__dirname, LIB_NAME);
const CONFIG_PATH = path.join(__dirname, "optishield.json");
const REMOTE_URL = "https://optishield.uk/OptiShield.js";

const INITIAL_REQUEST_TIMEOUT = 30000;
const POLL_TIMEOUT = 10000;
const MAX_WAIT_TIME = 72_000_000;
const POLL_INTERVAL = 2000;

if (path.basename(__filename) !== LIB_NAME) {
  try {
    fs.renameSync(__filename, LIB_PATH);
    console.log("🔁 OptiShield renombrado a OptiShield.js");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error al renombrar:", err.message);
  }
}

const sha256 = d =>
  crypto.createHash("sha256").update(d).digest("hex");

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function autoUpdate() {
  try {
    if (!fs.existsSync(LIB_PATH)) return;
    
    const local = fs.readFileSync(LIB_PATH, "utf8");
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const res = await fetch(REMOTE_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!res.ok) return;

    const remote = await res.text();
    if (sha256(local) !== sha256(remote)) {
      const backupPath = LIB_PATH + ".backup";
      fs.copyFileSync(LIB_PATH, backupPath);
      fs.writeFileSync(LIB_PATH, remote);
      console.log("⬆️ OptiShield actualizado");
      if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
      process.exit(0);
    }
  } catch (err) {
    console.warn("⚠️ Error en auto-actualización:", err.message);
  }
}

await autoUpdate();

function getConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      const defaultConfig = {
        apikey: "Favor de poner su apikey en este lugar",
        _created: new Date().toISOString()
      };
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
      throw new Error("⚙️ Config creado en optishield.json - Por favor configura tu APIKEY");
    }

    const configContent = fs.readFileSync(CONFIG_PATH, "utf8");
    if (!configContent.trim()) {
      throw new Error("❌ Archivo optishield.json está vacío");
    }

    const cfg = JSON.parse(configContent);

    if (!cfg.apikey || typeof cfg.apikey !== "string" || cfg.apikey.includes("Favor")) {
      throw new Error("❌ APIKEY inválida en optishield.json");
    }

    return cfg;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error("❌ Formato JSON inválido en optishield.json");
    }
    throw err;
  }
}

export async function callApi(type, params = {}) {
  if (!type || typeof type !== "string") {
    return { error: "Tipo de API inválido" };
  }

  let apikey;
  try {
    if (params.apikey) {
      apikey = params.apikey;
    } else {
      const config = getConfig();
      apikey = config.apikey;
    }
  } catch (err) {
    return { error: err.message };
  }

  const requestParams = { ...params, apikey, type };

  const MAX_RETRIES    = 10
  const BASE_DELAY_MS  = 2000
  const MAX_DELAY_MS   = 15000

  const RETRYABLE_HTTP = new Set([502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530])

  const RETRYABLE_NET  = new Set(['ECONNREFUSED','ETIMEDOUT','ENOTFOUND','ECONNRESET','EPIPE','EAI_AGAIN'])

  function isRetryable(err) {
    if (!err) return false
    if (RETRYABLE_NET.has(err.code))                        return true
    if (err.response?.status && RETRYABLE_HTTP.has(err.response.status)) return true
    if (err.code === 'ECONNABORTED')                        return true
    return false
  }

  function getDelay(attempt) {
    return Math.min(BASE_DELAY_MS * Math.pow(1.5, attempt - 1), MAX_DELAY_MS)
  }

  async function fetchWithRetry(requestFn, label) {
    let lastErr = null

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await requestFn()
      } catch (err) {
        lastErr = err
        const status  = err.response?.status
        const retryable = isRetryable(err)

        if (!retryable || attempt >= MAX_RETRIES) {
          err._attempts = attempt
          throw err
        }

        const delay = getDelay(attempt)
        console.warn(
          `🔄 [${label}] Error${status ? ` HTTP ${status}` : ` (${err.code || err.message})`}` +
          ` — reintento ${attempt}/${MAX_RETRIES} en ${(delay / 1000).toFixed(1)}s`
        )
        await sleep(delay)
      }
    }

    lastErr._attempts = MAX_RETRIES
    throw lastErr
  }
  
  try {
    console.log(`📤 Enviando solicitud: ${type}`)

    const { data: initialResponse } = await fetchWithRetry(
      () => axios.get("https://optishield.uk/api/", {
        params: requestParams,
        timeout: INITIAL_REQUEST_TIMEOUT,
        headers: { "User-Agent": "OptiShield/2.0", "Accept": "application/json" }
      }),
      type
    )

    if (initialResponse.error) {
      console.error(`❌ Error de API: ${initialResponse.error}`)
      return initialResponse
    }

    if (initialResponse.free === true ||
        (initialResponse.status === "ok" && initialResponse.processed === true)) {
      console.log(`✅ Respuesta inmediata recibida para ${type}`)
      return initialResponse
    }

    if (initialResponse.status === "processing" && initialResponse.timestamp) {
      const timestamp = initialResponse.timestamp
      console.log(`⏳ Procesando ${type}... (timestamp: ${timestamp})`)

      let elapsed = 0

      while (elapsed < MAX_WAIT_TIME) {
        await sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL

        let resultResponse
        try {
          const { data } = await fetchWithRetry(
            () => axios.get("https://optishield.uk/api/result", {
              params: { timestamp },
              timeout: POLL_TIMEOUT,
              headers: { "User-Agent": "OptiShield/2.0", "Accept": "application/json" }
            }),
            `${type}/poll`
          )
          resultResponse = data
        } catch (pollError) {
          console.warn(`⚠️ Error en polling (${(elapsed / 1000).toFixed(0)}s) tras ${pollError._attempts || '?'} intentos: ${pollError.message}`)

          if (pollError.response?.status >= 400) {
            return {
              error: `Error ${pollError.response.status} al consultar resultado`,
              timestamp
            }
          }
          continue
        }

        if (resultResponse.processed === true && resultResponse.status === "ok") {
          console.log(`✅ ${type} completado en ${(elapsed / 1000).toFixed(1)}s`)
          return resultResponse
        }

        if (resultResponse.processed === true && resultResponse.status === "error") {
          console.error(`❌ ${type} falló: ${resultResponse.error || "Error desconocido"}`)
          return resultResponse
        }

        if (resultResponse.status === "processing" && resultResponse.processed === false) {
          const progress = resultResponse.progress || "...";
          console.log(`⏳ Procesando... ${(elapsed / 1000).toFixed(0)}s ${progress}`)
          continue
        }

        if (resultResponse.error) {
          console.error(`❌ Error consultando resultado: ${resultResponse.error}`)
          return resultResponse
        }

        console.warn(`⚠️ Respuesta inesperada en polling:`, resultResponse)
      }

      console.warn(`⏱️ [${type}] Tiempo máximo alcanzado, reintentando desde el inicio...`)
      return await callApi(type, params)
    }

    console.warn(`⚠️ Respuesta sin estado de procesamiento:`, initialResponse)
    return initialResponse

  } catch (error) {
    const status   = error.response?.status
    const attempts = error._attempts || MAX_RETRIES

    console.error(
      `❌ Error en callApi (${type}) tras ${attempts} intento(s):`,
      error.message
    )

    return {
      error:      `Error de conexión: ${error.message}`,
      code:       error.code,
      httpStatus: status || null,
      details:    error.response?.data || null,
      attempts,
      suggestion: "Verifica tu conexión a internet"
    }
  }
}

async function uploadFile(imageBuffer, filename = 'image.png') {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    throw new Error("Buffer inválido");
  }

  if (imageBuffer.length === 0) {
    throw new Error("Buffer vacío");
  }

  if (imageBuffer.length > 99 * 1024 * 1024) {
    throw new Error("Archivo demasiado grande (máx 99MB)");
  }

  try {
    const formData = new FormData();
    formData.append('file', imageBuffer, {
      filename: filename,
      contentType: 'image/png'
    });

    const response = await axios.post('https://optishield.uk/api/upload', formData, {
      headers: {
        ...formData.getHeaders(),
        "User-Agent": "OptiShield/2.0"
      },
      maxContentLength: 99 * 1024 * 1024,
      maxBodyLength: 99 * 1024 * 1024,
      timeout: 120000
    });

    return response.data;
  } catch (error) {
    console.error('❌ Upload error:', error.response?.data || error.message);
    throw new Error(`Error al subir archivo: ${error.message}`);
  }
}

async function uploadFileGitHub(imageBuffer, filename = 'image.png') {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    throw new Error("Buffer inválido");
  }

  if (imageBuffer.length === 0) {
    throw new Error("Buffer vacío");
  }

  if (imageBuffer.length > 99 * 1024 * 1024) {
    throw new Error("Archivo demasiado grande (máx 99MB)");
  }

  try {
    const formData = new FormData();
    formData.append('file', imageBuffer, {
      filename: filename,
      contentType: 'application/octet-stream'
    });

    const response = await axios.post('https://optishield.uk/api/upload/github', formData, {
      headers: {
        ...formData.getHeaders(),
        "User-Agent": "OptiShield/2.0"
      },
      maxContentLength: 99 * 1024 * 1024,
      maxBodyLength: 99 * 1024 * 1024,
      timeout: 120000
    });

    return response.data;
  } catch (error) {
    console.error('❌ Upload GitHub error:', error.response?.data || error.message);
    throw new Error(`Error al subir archivo a GitHub: ${error.message}`);
  }
}

// ═════════════════════════════════════════════════════════════════════════
// BASE DE DATOS PARA USUARIOS DE BOTS - global.OptiShield.db()
// ═════════════════════════════════════════════════════════════════════════

const DB_API_URL = "https://optishield.uk/api/bots/db";
const DB_MAX_RETRIES = 3;
const DB_TIMEOUT = 15000;

/**
 * Función principal de base de datos para bots
 * 
 * Sintaxis rápida:
 *   await OptiShield.db("user@s.whatsapp.net")                    // GET todo
 *   await OptiShield.db("user@s.whatsapp.net", "set", { k: v })  // SET
 *   await OptiShield.db("user@s.whatsapp.net", "get", ["k1"])    // GET específico
 *   await OptiShield.db(null, "stats")                            // STATS
 * 
 * @param {string|null} user - ID del usuario (número de WhatsApp)
 * @param {string} [method="get"] - Método: get, set, delete, delete_user, push, pull, increment, exists, keys, stats
 * @param {Object|string[]|undefined} changes - Cambios a aplicar
 * @param {Object} [options] - Opciones adicionales
 * @param {string} [options.apikey] - API Key personalizada (sino usa la del config)
 * @param {boolean} [options.unique=false] - Para push: evitar duplicados
 * @param {boolean} [options.all=false] - Para pull: remover todas las coincidencias
 * @returns {Promise<Object>} Resultado de la operación
 */
async function dbFunction(user, method = "get", changes, options = {}) {
  try {
    // Obtener apikey
    let apikey;
    if (options.apikey) {
      apikey = options.apikey;
    } else {
      try {
        const config = getConfig();
        apikey = config.apikey;
      } catch {
        return { status: "error", message: "No se encontró API Key. Configura optishield.json o pasa apikey en options" };
      }
    }

    // Normalizar método
    const metod = (method || "get").toLowerCase();

    // Construir cambios según el tipo
    let cambios = null;

    if (changes !== undefined && changes !== null) {
      // Si es un array de strings → convertir a formato de propiedades
      if (Array.isArray(changes)) {
        cambios = changes.map(item => {
          if (typeof item === "string") {
            return { propiedad: item };
          }
          return item;
        });
      }
      // Si es un objeto → convertir a formato de cambios
      else if (typeof changes === "object" && !Array.isArray(changes)) {
        cambios = Object.entries(changes).map(([propiedad, value]) => {
          // Si el valor es un objeto con opciones especiales
          if (value !== null && typeof value === "object" && !Array.isArray(value) && ("_value" in value)) {
            return { propiedad, value: value._value, ...value };
          }
          return { propiedad, value };
        });
      }
    }

    // Para push/pull, aplicar opciones globales si no están definidas en cada cambio
    if ((metod === "push" || metod === "pull") && cambios) {
      for (const c of cambios) {
        if (metod === "push" && c.unique === undefined && options.unique) {
          c.unique = true;
        }
        if (metod === "pull" && c.all === undefined && options.all) {
          c.all = true;
        }
      }
    }

    // Construir body
    const body = { user: user || undefined, metod };
    if (cambios && cambios.length > 0) {
      body.cambios = cambios;
    }

    // Hacer petición con reintentos
    let lastError = null;
    
    for (let attempt = 1; attempt <= DB_MAX_RETRIES; attempt++) {
      try {
        const response = await axios.post(DB_API_URL, body, {
          headers: {
            "apikey": apikey,
            "Content-Type": "application/json",
            "User-Agent": "OptiShield/2.0",
            "Accept": "application/json"
          },
          timeout: DB_TIMEOUT
        });
        
        return response.data;
      } catch (err) {
        lastError = err;
        const status = err.response?.status;
        
        // No reintentar en errores de cliente (4xx)
        if (status >= 400 && status < 500) {
          return {
            status: "error",
            message: err.response?.data?.message || `Error HTTP ${status}`,
            httpStatus: status,
            details: err.response?.data
          };
        }
        
        // Reintentar en errores de servidor o red
        if (attempt < DB_MAX_RETRIES) {
          const delay = 1000 * attempt;
          console.warn(`🔄 [DB] Reintento ${attempt}/${DB_MAX_RETRIES} en ${delay}ms...`);
          await sleep(delay);
        }
      }
    }
    
    return {
      status: "error",
      message: `Error de conexión: ${lastError?.message}`,
      code: lastError?.code
    };
    
  } catch (err) {
    return {
      status: "error",
      message: `Error interno: ${err.message}`
    };
  }
}

/**
 * Métodos de acceso rápido (shorthand)
 */
dbFunction.get = async function(user, props, options = {}) {
  if (Array.isArray(props)) {
    return dbFunction(user, "get", props, options);
  }
  return dbFunction(user, "get", undefined, options);
};

dbFunction.set = async function(user, data, options = {}) {
  return dbFunction(user, "set", data, options);
};

dbFunction.delete = async function(user, props, options = {}) {
  const propArray = Array.isArray(props) ? props : [props];
  return dbFunction(user, "delete", propArray, options);
};

dbFunction.deleteUser = async function(user, options = {}) {
  return dbFunction(user, "delete_user", undefined, options);
};

dbFunction.push = async function(user, data, options = {}) {
  return dbFunction(user, "push", data, options);
};

dbFunction.pull = async function(user, data, options = {}) {
  return dbFunction(user, "pull", data, options);
};

dbFunction.increment = async function(user, data, options = {}) {
  return dbFunction(user, "increment", data, options);
};

dbFunction.exists = async function(user, props, options = {}) {
  if (Array.isArray(props)) {
    return dbFunction(user, "exists", props, options);
  }
  return dbFunction(user, "exists", undefined, options);
};

dbFunction.keys = async function(user, options = {}) {
  return dbFunction(user, "keys", undefined, options);
};

dbFunction.stats = async function(options = {}) {
  return dbFunction(null, "stats", undefined, options);
};

// ═════════════════════════════════════════════════════════════════════════
// REGISTRO GLOBAL
// ═════════════════════════════════════════════════════════════════════════

global.OptiShield = {
  callApi,
  uploadFile,
  uploadFileGitHub,
  db: dbFunction
};

console.log("Probando OptiShield....");

try {
  console.info(await global.OptiShield.callApi('ok', { apikey: "anonymous" }))
} catch (error) {
  console.error(error)
}

console.log("✅ OptiShield cargado correctamente");

/*
╔══════════════════════════════════════════════════════════════════════════╗
║                    EJEMPLOS DE USO - OptiShield.db()                    ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║  📦 Importar (si usas ES modules en tu bot):                            ║
║  ┌─────────────────────────────────────────────────────────────────┐    ║
║  │  import OptiShield from "./OptiShield.js";                     │    ║
║  │  // o directamente:                                             │    ║
║  │  const { db } = global.OptiShield;                             │    ║
║  └─────────────────────────────────────────────────────────────────┘    ║
║                                                                        ║
║  Si NO usas modules, global.OptiShield.db ya está disponible.           ║
║                                                                        ║
╠══════════════════════════════════════════════════════════════════════════╣
║                          MÉTODO GET                                    ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║  // Obtener TODOS los datos de un usuario                              ║
║  const data = await OptiShield.db("521234567890@s.whatsapp.net");      ║
║  // Respuesta: { status: "ok", user: "...", data: { ... } }            ║
║                                                                        ║
║  // Obtener propiedades específicas                                    ║
║  const partial = await OptiShield.db(                                  ║
║    "521234567890@s.whatsapp.net",                                      ║
║    "get",                                                              ║
║    ["nombre", "nivel", "monedas"]                                      ║
║  );                                                                    ║
║  // Respuesta: { status: "ok", data: { nombre: "...", ... } }          ║
║                                                                        ║
║  // Shorthand                                                          ║
║  const all = await OptiShield.db.get("521234567890@s.whatsapp.net");   ║
║  const some = await OptiShield.db.get("521234567890@s", ["nombre"]);   ║
║                                                                        ║
╠══════════════════════════════════════════════════════════════════════════╣
║                          MÉTODO SET                                    ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║  // Crear/modificar propiedades (si el usuario no existe, se crea)     ║
║  const result = await OptiShield.db(                                   ║
║    "521234567890@s.whatsapp.net",                                      ║
║    "set",                                                              ║
║    {                                                                   ║
║      nombre: "Bot Principal",                                          ║
║      nivel: 15,                                                        ║
║      monedas: 5000,                                                    ║
║      verificado: true,                                                 ║
║      configuracion: { idioma: "es", tema: "oscuro" }                  ║
║    }                                                                   ║
║  );                                                                    ║
║  // Respuesta: { status: "ok", applied: [...], total_props: 5 }       ║
║                                                                        ║
║  // Shorthand                                                          ║
║  await OptiShield.db.set("521234567890@s", {                           ║
║    nombre: "Nuevo Nombre",                                             ║
║    puntos: 100                                                         ║
║  });                                                                   ║
║                                                                        ║
╠══════════════════════════════════════════════════════════════════════════╣
║                        MÉTODO PUSH (Arrays)                             ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║  // Agregar elemento a un array                                        ║
║  await OptiShield.db(                                                  ║
║    "521234567890@s.whatsapp.net",                                      ║
║    "push",                                                             ║
║    { admins: "529876543210@s.whatsapp.net" }                           ║
║  );                                                                    ║
║                                                                        ║
║  // Agregar SIN duplicados (unique: true)                              ║
║  await OptiShield.db(                                                  ║
║    "521234567890@s.whatsapp.net",                                      ║
║    "push",                                                             ║
║    { admins: "529876543210@s.whatsapp.net" },                          ║
║    { unique: true }                                                    ║
║  );                                                                    ║
║  // Si ya existe, se omite con: { action: "skipped", reason: "dup" }   ║
║                                                                        ║
║  // Agregar múltiples elementos                                        ║
║  await OptiShield.db(                                                  ║
║    "521234567890@s.whatsapp.net",                                      ║
║    "push",                                                             ║
║    {                                                                   ║
║      admins: "52111@s.whatsapp.net",                                   ║
║      items: "espada_legendaria",                                       ║
║      logros: "primer_login"                                            ║
║    },                                                                  ║
║    { unique: true }                                                    ║
║  );                                                                    ║
║                                                                        ║
║  // Shorthand                                                          ║
║  await OptiShield.db.push("521234567890@s", {                          ║
║    inventario: "pocion_vida",                                          ║
║    logros: "mata_boss"                                                 ║
║  }, { unique: true });                                                 ║
║                                                                        ║
╠══════════════════════════════════════════════════════════════════════════╣
║                        MÉTODO PULL (Arrays)                             ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║  // Remover primera coincidencia de un array                           ║
║  await OptiShield.db(                                                  ║
║    "521234567890@s.whatsapp.net",                                      ║
║    "pull",                                                             ║
║    { admins: "529876543210@s.whatsapp.net" }                           ║
║  );                                                                    ║
║                                                                        ║
║  // Remover TODAS las coincidencias (all: true)                        ║
║  await OptiShield.db(                                                  ║
║    "521234567890@s.whatsapp.net",                                      ║
║    "pull",                                                             ║
║    { tags: "spam" },                                                   ║
║    { all: true }                                                       ║
║  );                                                                    ║
║                                                                        ║
║  // Shorthand                                                          ║
║  await OptiShield.db.pull("521234567890@s", {                          ║
║    inventario: "pocion_vida"                                           ║
║  });                                                                   ║
║                                                                        ║
╠══════════════════════════════════════════════════════════════════════════╣
║                       MÉTODO INCREMENT                                  ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║  // Incrementar en 1 (por defecto)                                     ║
║  await OptiShield.db(                                                  ║
║    "521234567890@s.whatsapp.net",                                      ║
║    "increment",                                                        ║
║    { mensajes: 1 }                                                     ║
║  );                                                                    ║
║                                                                        ║
║  // Incrementar en cantidad específica                                 ║
║  await OptiShield.db(                                                  ║
║    "521234567890@s.whatsapp.net",                                      ║
║    "increment",                                                        ║
║    {                                                                   ║
║      monedas: 500,                                                     ║
║      experiencia: 150                                                  ║
║    }                                                                   ║
║  );                                                                    ║
║  // Si la propiedad no existe, se crea en 0 y luego suma               ║
║                                                                        ║
║  // Decrementar (usar valor negativo)                                  ║
║  await OptiShield.db(                                                  ║
║    "521234567890@s.whatsapp.net",                                      ║
║    "increment",                                                        ║
║    { monedas: -100 }                                                   ║
║  );                                                                    ║
║                                                                        ║
║  // Shorthand                                                          ║
║  await OptiShield.db.increment("521234567890@s", { xp: 50 });         ║
║                                                                        ║
╠══════════════════════════════════════════════════════════════════════════╣
║                        MÉTODO DELETE                                   ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║  // Eliminar propiedades específicas                                   ║
║  await OptiShield.db(                                                  ║
║    "521234567890@s.whatsapp.net",                                      ║
║    "delete",                                                           ║
║    ["temporal", "cache_viejo", "datos_inutiles"]                       ║
║  );                                                                    ║
║                                                                        ║
║  // Eliminar una sola propiedad                                        ║
║  await OptiShield.db.delete("521234567890@s", "temporal");            ║
║                                                                        ║
╠══════════════════════════════════════════════════════════════════════════╣
║                      MÉTODO DELETE_USER                                ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║  // Eliminar COMPLETAMENTE un usuario y todos sus datos                ║
║  await OptiShield.db.deleteUser("521234567890@s.whatsapp.net");        ║
║  // ⚠️ Esta acción NO se puede deshacer                                ║
║                                                                        ║
╠══════════════════════════════════════════════════════════════════════════╣
║                        MÉTODO EXISTS                                   ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║  // Verificar si un usuario existe                                     ║
║  const exists = await OptiShield.db.exists("521234567890@s");          ║
║  // { status: "ok", user: "...", exists: true/false }                  ║
║                                                                        ║
║  // Verificar si existen propiedades específicas                       ║
║  const props = await OptiShield.db.exists("521234567890@s", [         ║
║    "premium", "banneado"                                               ║
║  ]);                                                                   ║
║  // { status: "ok", exists: true, properties: { premium: true, banneado: false } }║
║                                                                        ║
╠══════════════════════════════════════════════════════════════════════════╣
║                         MÉTODO KEYS                                    ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║  // Listar todas las propiedades de un usuario                         ║
║  const keys = await OptiShield.db.keys("521234567890@s");              ║
║  // { status: "ok", user: "...", keys: ["nombre", "nivel", ...], total: 5 }║
║                                                                        ║
╠══════════════════════════════════════════════════════════════════════════╣
║                         MÉTODO STATS                                   ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║  // Estadísticas generales de la base de datos                         ║
║  const stats = await OptiShield.db.stats();                            ║
║  // {                                                                  ║
║  //   status: "ok",                                                    ║
║  //   total_users: 1500,                                               ║
║  //   total_properties: 8500,                                          ║
║  //   avg_props_per_user: "5.67",                                      ║
║  //   db_size_bytes: 245760,                                           ║
║  //   oldest_user: { user: "...", created: 1700000000000 },            ║
║  //   newest_user: { user: "...", created: 1710000000000 }             ║
║  // }                                                                  ║
║                                                                        ║
╠══════════════════════════════════════════════════════════════════════════╣
║                     EJEMPLOS PRÁCTICOS EN BOTS                         ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║  // ═══ SISTEMA DE ECONOMÍA ═══                                        ║
║                                                                        ║
║  // Registrar usuario nuevo                                            ║
║  async function registrarUsuario(userId) {                             ║
║    const exists = await OptiShield.db.exists(userId);                  ║
║    if (!exists.exists) {                                               ║
║      await OptiShield.db.set(userId, {                                 ║
║        nombre: userId.split("@")[0],                                   ║
║        monedas: 1000,                                                  ║
║        nivel: 1,                                                       ║
║        experiencia: 0,                                                 ║
║        inventario: [],                                                 ║
║        registro: Date.now()                                            ║
║      });                                                               ║
║    }                                                                   ║
║  }                                                                     ║
║                                                                        ║
║  // Dar recompensa                                                     ║
║  async function darRecompensa(userId, cantidad) {                      ║
║    await OptiShield.db.increment(userId, { monedas: cantidad });       ║
║    await OptiShield.db.push(userId, { logros: "daily_reward" }, {      ║
║      unique: true                                                      ║
║    });                                                                 ║
║  }                                                                     ║
║                                                                        ║
║  // Comprar item                                                       ║
║  async function comprarItem(userId, item, precio) {                    ║
║    const data = await OptiShield.db.get(userId, ["monedas"]);          ║
║    if (data.data.monedas >= precio) {                                  ║
║      await OptiShield.db.increment(userId, { monedas: -precio });      ║
║      await OptiShield.db.push(userId, { inventario: item }, {          ║
║        unique: true                                                    ║
║      });                                                               ║
║      return true;                                                      ║
║    }                                                                   ║
║    return false;                                                       ║
║  }                                                                     ║
║                                                                        ║
║  // ═══ SISTEMA DE ADMINS ═══                                          ║
║                                                                        ║
║  // Agregar admin                                                      ║
║  await OptiShield.db.push("bot_id@s.whatsapp.net", {                   ║
║    admins: "521234567890@s.whatsapp.net"                              ║
║  }, { unique: true });                                                 ║
║                                                                        ║
║  // Verificar si es admin                                              ║
║  const botData = await OptiShield.db.get("bot_id@s", ["admins"]);      ║
║  const esAdmin = botData.data?.admins?.includes(userId);               ║
║                                                                        ║
║  // Quitar admin                                                       ║
║  await OptiShield.db.pull("bot_id@s", {                                ║
║    admins: "521234567890@s.whatsapp.net"                              ║
║  });                                                                   ║
║                                                                        ║
║  // ═══ SISTEMA DE BAN ═══                                             ║
║                                                                        ║
║  // Banear usuario                                                     ║
║  await OptiShield.db.set(userId, { banneado: true, razon: "spam" });   ║
║                                                                        ║
║  // Verificar ban                                                      ║
║  const check = await OptiShield.db.get(userId, ["banneado", "razon"]); ║
║  if (check.data?.banneado) {                                           ║
║    // Usuario baneado por: check.data.razon                            ║
║  }                                                                     ║
║                                                                        ║
║  // Desbanear                                                          ║
║  await OptiShield.db.delete(userId, ["banneado", "razon"]);            ║
║                                                                        ║
║  // ═══ CONTADOR DE MENSAJES ═══                                       ║
║                                                                        ║
║  // Incrementar contador                                               ║
║  await OptiShield.db.increment(userId, { mensajes: 1 });               ║
║                                                                        ║
║  // Verificar nivel (cada 100 mensajes sube nivel)                     ║
║  const userData = await OptiShield.db.get(userId, ["mensajes", "nivel"]);║
║  if (userData.data.mensajes % 100 === 0) {                             ║
║    await OptiShield.db.increment(userId, { nivel: 1 });                ║
║  }                                                                     ║
║                                                                        ║
║  // ═══ USAR API KEY DISTINTA ═══                                      ║
║                                                                        ║
║  const resultado = await OptiShield.db(                                ║
║    "521234567890@s",                                                   ║
║    "set",                                                              ║
║    { datos: "algo" },                                                  ║
║    { apikey: "tu_otra_apikey_aqui" }                                   ║
║  );                                                                    ║
║                                                                        ║
╚══════════════════════════════════════════════════════════════════════════╝
*/

export default global.OptiShield;
