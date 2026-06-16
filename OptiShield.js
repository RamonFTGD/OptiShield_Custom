import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import FormData from "form-data";
import axios from "axios";

// ═══════════════════════════════════════════════════════════════════════════════
//  OPTISHIELD.JS — v3.0.0 — WhatsApp Bot SDK
//  Librería mejorada con seguridad, rendimiento y robustez
// ═══════════════════════════════════════════════════════════════════════════════

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VERSION = "3.0.0";
const LIB_NAME = "OptiShield.js";
const LIB_PATH = path.join(__dirname, LIB_NAME);
const CONFIG_PATH = path.join(__dirname, "optishield.json");
const REMOTE_URL = "https://optishield.uk/OptiShield.js";
const REMOTE_VERSION_URL = "https://optishield.uk/api/version";

// ─── Timeouts ─────────────────────────────────────────────────────────────
const INITIAL_REQUEST_TIMEOUT = 30000;
const POLL_TIMEOUT = 15000;
const MAX_WAIT_TIME = 72_000_000;
const POLL_INTERVAL = 2000;
const UPLOAD_TIMEOUT = 180000;

// ─── Rate Limits ──────────────────────────────────────────────────────────
const MAX_CONCURRENT_REQUESTS = 5;
const REQUEST_QUEUE_INTERVAL = 100;

// ─── Circuit Breaker ──────────────────────────────────────────────────────
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 60000;

// ═══════════════════════════════════════════════════════════════════════════════
//  AUTO-RENAME
// ═══════════════════════════════════════════════════════════════════════════════

if (path.basename(__filename) !== LIB_NAME) {
  try {
    fs.renameSync(__filename, LIB_PATH);
    console.log("🔁 OptiShield renombrado a OptiShield.js");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error al renombrar:", err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/** SHA-256 hash */
const sha256 = (d) => crypto.createHash("sha256").update(d).digest("hex");

/** Sleep with optional jitter */
function sleep(ms, jitter = 0) {
  const actual = jitter > 0 ? ms + Math.random() * jitter : ms;
  return new Promise((r) => setTimeout(r, Math.max(0, actual)));
}

/** Safe JSON parse */
function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/** Semantic version comparison: returns true if v1 is newer than v2 */
function isNewerVersion(v1, v2) {
  const parse = (v) => v.split(".").map(Number);
  const a = parse(v1);
  const b = parse(v2);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AUTO-UPDATE WITH INTEGRITY VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

async function autoUpdate() {
  try {
    if (!fs.existsSync(LIB_PATH)) return;

    const local = fs.readFileSync(LIB_PATH, "utf8");
    const localHash = sha256(local);

    // Check for remote version first to avoid unnecessary downloads
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const versionRes = await fetch(REMOTE_VERSION_URL, {
        signal: controller.signal,
        headers: { "User-Agent": `OptiShield/${VERSION}` },
      });
      clearTimeout(timeoutId);

      if (versionRes.ok) {
        const remoteVersion = safeJsonParse(await versionRes.text(), {});
        if (remoteVersion.version && !isNewerVersion(remoteVersion.version, VERSION)) {
          console.log(`✅ OptiShield v${VERSION} actualizado`);
          return;
        }
      }
    } catch {
      // Version check failed, proceed with full update check
    }

    // Download remote version
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(REMOTE_URL, {
      signal: controller.signal,
      headers: { "User-Agent": `OptiShield/${VERSION}` },
    });
    clearTimeout(timeoutId);

    if (!res.ok) return;

    const remote = await res.text();
    const remoteHash = sha256(remote);

    if (localHash !== remoteHash) {
      const timestamp = Date.now();
      const backupPath = `${LIB_PATH}.backup.${timestamp}`;
      fs.copyFileSync(LIB_PATH, backupPath);
      fs.writeFileSync(LIB_PATH, remote);
      console.log("⬆ OptiShield actualizado a la última versión");

      // Cleanup old backups (keep last 3)
      const backups = fs.readdirSync(__dirname)
        .filter((f) => f.startsWith("OptiShield.js.backup."))
        .sort()
        .slice(0, -3);
      for (const old of backups) {
        try { fs.unlinkSync(path.join(__dirname, old)); } catch {}
      }

      process.exit(0);
    }
  } catch (err) {
    console.warn("⚠ Error en auto-actualización:", err.message);
  }
}

await autoUpdate();

// ═══════════════════════════════════════════════════════════════════════════════
//  CONFIG MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

let _configCache = null;
let _configCacheTime = 0;
const CONFIG_CACHE_TTL = 30000;

function getConfig() {
  const now = Date.now();
  if (_configCache && now - _configCacheTime < CONFIG_CACHE_TTL) {
    return _configCache;
  }

  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      const defaultConfig = {
        apikey: "Favor de poner su apikey en este lugar",
        _created: new Date().toISOString(),
        _version: VERSION,
      };
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
      throw new Error("⚙ Config creado en optishield.json - Por favor configura tu APIKEY");
    }

    const configContent = fs.readFileSync(CONFIG_PATH, "utf8");
    if (!configContent.trim()) {
      throw new Error("❌ Archivo optishield.json está vacío");
    }

    const cfg = JSON.parse(configContent);

    if (!cfg.apikey || typeof cfg.apikey !== "string" || cfg.apikey.includes("Favor")) {
      throw new Error("❌ APIKEY inválida en optishield.json");
    }

    _configCache = cfg;
    _configCacheTime = now;
    return cfg;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error("❌ Formato JSON inválido en optishield.json");
    }
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  REQUEST QUEUE & CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════════════════════

class RequestQueue {
  constructor(maxConcurrent = MAX_CONCURRENT_REQUESTS) {
    this.running = 0;
    this.maxConcurrent = maxConcurrent;
  }

  async enqueue(fn) {
    while (this.running >= this.maxConcurrent) {
      await sleep(REQUEST_QUEUE_INTERVAL);
    }
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
    }
  }
}

class CircuitBreaker {
  constructor(threshold = CIRCUIT_BREAKER_THRESHOLD, resetMs = CIRCUIT_BREAKER_RESET_MS) {
    this.failures = 0;
    this.threshold = threshold;
    this.resetMs = resetMs;
    this.lastFailure = 0;
    this.state = "closed";
  }

  recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) {
      this.state = "open";
      console.warn(`🔴 Circuit breaker abierto — ${this.failures} fallos consecutivos`);
    }
  }

  recordSuccess() {
    this.failures = 0;
    this.state = "closed";
  }

  canRequest() {
    if (this.state === "closed") return true;
    if (Date.now() - this.lastFailure >= this.resetMs) {
      this.state = "half-open";
      return true;
    }
    return false;
  }
}

const requestQueue = new RequestQueue();
const circuitBreaker = new CircuitBreaker();

// ═══════════════════════════════════════════════════════════════════════════════
//  callApi — Core API Function
// ═══════════════════════════════════════════════════════════════════════════════

const RETRYABLE_HTTP = new Set([502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530]);
const RETRYABLE_NET = new Set(["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "ECONNRESET", "EPIPE", "EAI_AGAIN"]);

/**
 * Core API call function with retry, circuit breaker, and caching
 * @param {string} type - API endpoint type
 * @param {Object} params - Request parameters
 * @returns {Promise<Object>} API response
 */
export async function callApi(type, params = {}) {
  if (!type || typeof type !== "string") {
    return { error: "Tipo de API inválido" };
  }

  if (!circuitBreaker.canRequest()) {
    return { error: "Servidor en mantenimiento. Intenta de nuevo en unos segundos." };
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

  const { apikey: _, ...cleanParams } = params;
  const requestParams = { ...cleanParams, apikey, type };

  const MAX_RETRIES = 10;
  const BASE_DELAY_MS = 2000;
  const MAX_DELAY_MS = 15000;

  function isRetryable(err) {
    if (!err) return false;
    if (RETRYABLE_NET.has(err.code)) return true;
    if (err.response?.status && RETRYABLE_HTTP.has(err.response.status)) return true;
    if (err.code === "ECONNABORTED") return true;
    return false;
  }

  function getDelay(attempt) {
    const base = Math.min(BASE_DELAY_MS * Math.pow(1.5, attempt - 1), MAX_DELAY_MS);
    return base + Math.random() * 1000;
  }

  async function fetchWithRetry(requestFn, label) {
    let lastErr = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await requestQueue.enqueue(() => requestFn());
      } catch (err) {
        lastErr = err;
        const status = err.response?.status;
        const retryable = isRetryable(err);

        if (!retryable || attempt >= MAX_RETRIES) {
          err._attempts = attempt;
          throw err;
        }

        const delay = getDelay(attempt);
        console.warn(
          `🔄 [${label}] Error${status ? ` HTTP ${status}` : ` (${err.code || err.message})`}` +
            ` — reintento ${attempt}/${MAX_RETRIES} en ${(delay / 1000).toFixed(1)}s`
        );
        await sleep(delay);
      }
    }

    lastErr._attempts = MAX_RETRIES;
    throw lastErr;
  }

  try {
    console.log(`📤 Enviando solicitud: ${type}`);

    const { data: initialResponse } = await fetchWithRetry(
      () =>
        axios.get("https://optishield.uk/api/", {
          params: requestParams,
          timeout: INITIAL_REQUEST_TIMEOUT,
          headers: {
            "User-Agent": `OptiShield/${VERSION}`,
            Accept: "application/json",
            "X-OptiShield-Version": VERSION,
          },
        }),
      type
    );

    if (initialResponse.error) {
      console.error(`❌ Error de API: ${initialResponse.error}`);
      circuitBreaker.recordFailure();
      return initialResponse;
    }

    circuitBreaker.recordSuccess();

    if (
      initialResponse.free === true ||
      (initialResponse.status === "ok" && initialResponse.processed === true)
    ) {
      console.log(`✅ Respuesta inmediata recibida para ${type}`);
      return initialResponse;
    }

    if (initialResponse.status === "processing" && initialResponse.timestamp) {
      const timestamp = initialResponse.timestamp;
      console.log(`⏳ Procesando ${type}... (timestamp: ${timestamp})`);

      let elapsed = 0;
      let consecutiveErrors = 0;

      while (elapsed < MAX_WAIT_TIME) {
        await sleep(POLL_INTERVAL);
        elapsed += POLL_INTERVAL;

        let resultResponse;
        try {
          const { data } = await fetchWithRetry(
            () =>
              axios.get("https://optishield.uk/api/result", {
                params: { timestamp },
                timeout: POLL_TIMEOUT,
                headers: {
                  "User-Agent": `OptiShield/${VERSION}`,
                  Accept: "application/json",
                  "X-OptiShield-Version": VERSION,
                },
              }),
            `${type}/poll`
          );
          resultResponse = data;
          consecutiveErrors = 0;
        } catch (pollError) {
          consecutiveErrors++;
          console.warn(
            `⚠ Error en polling (${(elapsed / 1000).toFixed(0)}s) ` +
              `tras ${pollError._attempts || "?"} intentos: ${pollError.message}`
          );

          if (consecutiveErrors >= 5) {
            return { error: "Demasiados errores de conexión durante el procesamiento", timestamp, type };
          }

          if (pollError.response?.status >= 400) {
            return { error: `Error ${pollError.response.status} al consultar resultado`, timestamp };
          }
          continue;
        }

        if (resultResponse.processed === true && resultResponse.status === "ok") {
          console.log(`✅ ${type} completado en ${(elapsed / 1000).toFixed(1)}s`);
          return resultResponse;
        }

        if (resultResponse.processed === true && resultResponse.status === "error") {
          console.error(`❌ ${type} falló: ${resultResponse.error || "Error desconocido"}`);
          return resultResponse;
        }

        if (resultResponse.status === "processing" && resultResponse.processed === false) {
          const progress = resultResponse.progress || "...";
          if (elapsed % 10000 === 0) {
            console.log(`⏳ Procesando... ${(elapsed / 1000).toFixed(0)}s ${progress}`);
          }
          continue;
        }

        if (resultResponse.error) {
          console.error(`❌ Error consultando resultado: ${resultResponse.error}`);
          return resultResponse;
        }

        console.warn(`⚠ Respuesta inesperada en polling:`, resultResponse);
      }

      console.warn(`⏱ [${type}] Tiempo máximo alcanzado (${(MAX_WAIT_TIME / 1000).toFixed(0)}s)`);
      return { error: "Tiempo máximo de procesamiento alcanzado", timestamp, type, elapsed: Math.floor(elapsed / 1000) };
    }

    console.warn(`⚠ Respuesta sin estado de procesamiento:`, initialResponse);
    return initialResponse;
  } catch (error) {
    circuitBreaker.recordFailure();
    const status = error.response?.status;
    const attempts = error._attempts || 0;

    console.error(`❌ Error en callApi (${type}) tras ${attempts} intento(s):`, error.message);

    return {
      error: `Error de conexión: ${error.message}`,
      code: error.code,
      httpStatus: status || null,
      details: error.response?.data || null,
      attempts,
      suggestion: "Verifica tu conexión a internet",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FILE UPLOAD
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_FILE_SIZE = 99 * 1024 * 1024;

function validateBuffer(buffer, context = "Upload") {
  if (!buffer || !Buffer.isBuffer(buffer)) throw new Error(`${context}: Buffer inválido`);
  if (buffer.length === 0) throw new Error(`${context}: Buffer vacío`);
  if (buffer.length > MAX_FILE_SIZE) throw new Error(`${context}: Archivo demasiado grande (máx 99MB)`);
  return true;
}

export async function uploadFile(imageBuffer, filename = "image.png") {
  validateBuffer(imageBuffer, "Upload");
  const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");

  try {
    const formData = new FormData();
    formData.append("file", imageBuffer, { filename: safeName, contentType: "application/octet-stream" });

    const response = await axios.post("https://optishield.uk/api/upload", formData, {
      headers: { ...formData.getHeaders(), "User-Agent": `OptiShield/${VERSION}`, "X-OptiShield-Version": VERSION },
      maxContentLength: MAX_FILE_SIZE,
      maxBodyLength: MAX_FILE_SIZE,
      timeout: UPLOAD_TIMEOUT,
    });

    return response.data;
  } catch (error) {
    console.error("❌ Upload error:", error.response?.data || error.message);
    throw new Error(`Error al subir archivo: ${error.message}`);
  }
}

export async function uploadFileGitHub(imageBuffer, filename = "image.png") {
  validateBuffer(imageBuffer, "Upload GitHub");
  const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");

  try {
    const formData = new FormData();
    formData.append("file", imageBuffer, { filename: safeName, contentType: "application/octet-stream" });

    const response = await axios.post("https://optishield.uk/api/upload/github", formData, {
      headers: { ...formData.getHeaders(), "User-Agent": `OptiShield/${VERSION}`, "X-OptiShield-Version": VERSION },
      maxContentLength: MAX_FILE_SIZE,
      maxBodyLength: MAX_FILE_SIZE,
      timeout: UPLOAD_TIMEOUT,
    });

    return response.data;
  } catch (error) {
    console.error("❌ Upload GitHub error:", error.response?.data || error.message);
    throw new Error(`Error al subir archivo a GitHub: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DATABASE — global.OptiShield.db()
// ═══════════════════════════════════════════════════════════════════════════════

const DB_API_URL = "https://optishield.uk/api/bots/db";
const DB_MAX_RETRIES = 3;
const DB_TIMEOUT = 15000;

const VALID_METHODS = new Set([
  "get", "set", "delete", "delete_user",
  "push", "pull", "increment", "exists", "keys", "stats",
]);

/**
 * Función principal de base de datos para bots
 *
 * Sintaxis rápida:
 *   await OptiShield.db("user@s.whatsapp.net")                    // GET todo
 *   await OptiShield.db("user@s.whatsapp.net", "set", { k: v })  // SET
 *   await OptiShield.db("user@s.whatsapp.net", "get", ["k1"])    // GET específico
 *   await OptiShield.db(null, "stats")                            // STATS
 */
async function dbFunction(user, method = "get", changes, options = {}) {
  try {
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

    const metod = (method || "get").toLowerCase();
    if (!VALID_METHODS.has(metod)) {
      return { status: "error", message: `Método inválido: "${metod}". Válidos: ${[...VALID_METHODS].join(", ")}` };
    }

    if (metod !== "stats" && user && !/^\d+@(s\.whatsapp\.net|g\.us|lid|broadcast)$/.test(user)) {
      return { status: "error", message: `User ID inválido: "${user}". Formato: "number@s.whatsapp.net"` };
    }

    let cambios = null;
    if (changes !== undefined && changes !== null) {
      if (Array.isArray(changes)) {
        cambios = changes.map((item) => (typeof item === "string" ? { propiedad: item } : item));
      } else if (typeof changes === "object" && !Array.isArray(changes)) {
        cambios = Object.entries(changes).map(([propiedad, value]) => {
          if (value !== null && typeof value === "object" && !Array.isArray(value) && "_value" in value) {
            return { propiedad, value: value._value, ...value };
          }
          return { propiedad, value };
        });
      }
    }

    if ((metod === "push" || metod === "pull") && cambios) {
      for (const c of cambios) {
        if (metod === "push" && c.unique === undefined && options.unique) c.unique = true;
        if (metod === "pull" && c.all === undefined && options.all) c.all = true;
      }
    }

    const body = { user: user || undefined, metod };
    if (cambios && cambios.length > 0) body.cambios = cambios;

    let lastError = null;
    for (let attempt = 1; attempt <= DB_MAX_RETRIES; attempt++) {
      try {
        const response = await axios.post(DB_API_URL, body, {
          headers: { apikey, "Content-Type": "application/json", "User-Agent": `OptiShield/${VERSION}`, Accept: "application/json", "X-OptiShield-Version": VERSION },
          timeout: DB_TIMEOUT,
        });
        return response.data;
      } catch (err) {
        lastError = err;
        const status = err.response?.status;
        if (status >= 400 && status < 500) {
          return { status: "error", message: err.response?.data?.message || `Error HTTP ${status}`, httpStatus: status, details: err.response?.data };
        }
        if (attempt < DB_MAX_RETRIES) {
          const delay = 1000 * attempt + Math.random() * 500;
          console.warn(`🔄 [DB] Reintento ${attempt}/${DB_MAX_RETRIES} en ${delay}ms...`);
          await sleep(delay);
        }
      }
    }

    return { status: "error", message: `Error de conexión: ${lastError?.message}`, code: lastError?.code };
  } catch (err) {
    return { status: "error", message: `Error interno: ${err.message}` };
  }
}

// ─── DB Shorthand Methods ──────────────────────────────────────────────────

dbFunction.get = async function (user, props, options = {}) {
  if (Array.isArray(props)) return dbFunction(user, "get", props, options);
  return dbFunction(user, "get", undefined, options);
};
dbFunction.set = async function (user, data, options = {}) {
  return dbFunction(user, "set", data, options);
};
dbFunction.delete = async function (user, props, options = {}) {
  return dbFunction(user, "delete", Array.isArray(props) ? props : [props], options);
};
dbFunction.deleteUser = async function (user, options = {}) {
  return dbFunction(user, "delete_user", undefined, options);
};
dbFunction.push = async function (user, data, options = {}) {
  return dbFunction(user, "push", data, options);
};
dbFunction.pull = async function (user, data, options = {}) {
  return dbFunction(user, "pull", data, options);
};
dbFunction.increment = async function (user, data, options = {}) {
  return dbFunction(user, "increment", data, options);
};
dbFunction.exists = async function (user, props, options = {}) {
  if (Array.isArray(props)) return dbFunction(user, "exists", props, options);
  return dbFunction(user, "exists", undefined, options);
};
dbFunction.keys = async function (user, options = {}) {
  return dbFunction(user, "keys", undefined, options);
};
dbFunction.stats = async function (options = {}) {
  return dbFunction(null, "stats", undefined, options);
};

// ═══════════════════════════════════════════════════════════════════════════════
//  GLOBAL REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════════

global.OptiShield = {
  callApi,
  uploadFile,
  uploadFileGitHub,
  db: dbFunction,
  version: VERSION,
};

// ─── Health Check ──────────────────────────────────────────────────────────

console.log(`🔍 OptiShield v${VERSION} — Verificando conexión...`);

try {
  const healthResult = await global.OptiShield.callApi("ok", { apikey: "anonymous" });
  if (healthResult.error) {
    console.warn(`⚠ API no disponible: ${healthResult.error}`);
  } else {
    console.log(`✅ API conectada correctamente`);
  }
} catch (error) {
  console.error("❌ Error en health check:", error.message);
}

console.log(`✅ OptiShield v${VERSION} cargado correctamente`);

/*
╔══════════════════════════════════════════════════════════════════════════╗
║                    EJEMPLOS DE USO - OptiShield.db()                    ║
╠══════════════════════════════════════════════════════════════════════════╣
║  📦 Importar: import OptiShield from "./OptiShield.js"                 ║
║  📦 O usar: const { db } = global.OptiShield;                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║  GET:    await OptiShield.db("521234567890@s.whatsapp.net")            ║
║  SET:    await OptiShield.db("user@s", "set", { key: value })         ║
║  PUSH:   await OptiShield.db("user@s", "push", { arr: val })          ║
║  PULL:   await OptiShield.db("user@s", "pull", { arr: val })          ║
║  INC:    await OptiShield.db("user@s", "increment", { xp: 10 })       ║
║  DEL:    await OptiShield.db("user@s", "delete", ["key1"])            ║
║  EXISTS: await OptiShield.db.exists("user@s")                         ║
║  KEYS:   await OptiShield.db.keys("user@s")                           ║
║  STATS:  await OptiShield.db.stats()                                   ║
╚══════════════════════════════════════════════════════════════════════════╝
*/

export default global.OptiShield;
