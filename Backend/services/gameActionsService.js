// services/gameActionsService.js
//
// Puente Eventos del directo → Webhooks de juegos locales.
//
// Muchos juegos para streamers (League of Monsters, etc.) exponen un servidor
// HTTP local con endpoints tipo:
//   http://localhost:5729/spawnMonster?id=1&username={nickname}&quantity=1
//
// Este servicio permite mapear CUALQUIER evento del live (regalo, like, follow,
// share, chat, sub, entrada) a una de esas URLs, con filtros y escalado, todo
// configurable desde el panel. La config vive en data/gameActions.json (fuera de
// git, se regenera desde los defaults).
//
// Diferencia con webhookService.js: aquel manda POST con JSON a servicios
// externos (Discord, n8n...). Este manda GET/POST con QUERY PARAMS a un juego
// local, resolviendo placeholders y repitiendo la llamada según el combo.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GAME_PRESETS } from './gamePresets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '../data/gameActions.json');

// Eventos del live que pueden disparar una acción de juego.
export const GAME_EVENT_TYPES = [
  'gift',
  'like',
  'follow',
  'share',
  'chat',
  'subscribe',
  'memberJoin',
];

const DEFAULT_CONFIG = {
  enabled: true,
  baseUrl: 'http://localhost:5729',
  timeoutMs: 5000,
  rules: [],
};

// Tope duro: por muy alto que ponga el usuario el "máximo", nunca mandamos más
// de esto por evento (un combo de 999 rosas tumbaría el juego).
const HARD_MAX_QUANTITY = 100;
const MAX_HISTORY = 60;

let ioRef = null;
let cache = null;

const history = [];
const lastFired = {};   // cooldown por `${ruleId}` o `${ruleId}|${usuario}`
const likeBuckets = {}; // acumulador de likes por `${ruleId}` o `${ruleId}|${usuario}`

export function initGameActions(io) {
  ioRef = io;
}

// ─────────────────────────────── Persistencia ───────────────────────────────

function normalizeRule(raw = {}, index = 0) {
  const params = Array.isArray(raw.params)
    ? raw.params
        .map((p) => ({ key: String(p?.key || '').trim(), value: String(p?.value ?? '') }))
        .filter((p) => p.key)
    : [];

  return {
    id: String(raw.id || `rule_${Date.now()}_${index}`),
    name: String(raw.name || '').trim() || 'Sin nombre',
    enabled: raw.enabled !== false,
    event: GAME_EVENT_TYPES.includes(raw.event) ? raw.event : 'gift',

    // ── Filtros ──
    giftName: String(raw.giftName || '').trim(),
    giftId: String(raw.giftId || '').trim(),
    minDiamonds: Math.max(0, Number(raw.minDiamonds) || 0),
    maxDiamonds: Math.max(0, Number(raw.maxDiamonds) || 0), // 0 = sin tope
    chatMode: ['any', 'equals', 'startsWith', 'contains'].includes(raw.chatMode)
      ? raw.chatMode
      : 'any',
    chatText: String(raw.chatText || '').trim(),
    audience: {
      everyone: raw.audience?.everyone !== false,
      moderators: !!raw.audience?.moderators,
      subscribers: !!raw.audience?.subscribers,
      followers: !!raw.audience?.followers,
      fansClub: !!raw.audience?.fansClub,
    },

    // ── Likes: acumulador (0 = dispara en cada evento de like) ──
    likesPerTrigger: Math.max(0, Number(raw.likesPerTrigger) || 0),
    likesPerUser: raw.likesPerUser !== false,

    // ── Petición ──
    method: String(raw.method || 'GET').toUpperCase() === 'POST' ? 'POST' : 'GET',
    path: String(raw.path || '').trim(),
    params,

    // ── Escalado (cuántas unidades genera el evento) ──
    // fixed: siempre scaleFixed · combo: repeatCount del regalo
    // diamonds: monedas totales / scalePer · likes: nº de veces que se cruzó el umbral
    scaleMode: ['fixed', 'combo', 'diamonds', 'likes'].includes(raw.scaleMode)
      ? raw.scaleMode
      : 'fixed',
    scaleFixed: Math.max(1, Number(raw.scaleFixed) || 1),
    scalePer: Math.max(1, Number(raw.scalePer) || 1),
    scaleMax: Math.max(1, Number(raw.scaleMax) || 10),

    // quantity: una sola llamada con {quantity}=N · repeat: N llamadas seguidas
    sendMode: raw.sendMode === 'repeat' ? 'repeat' : 'quantity',
    spacingMs: Math.min(2000, Math.max(0, Number(raw.spacingMs) || 0)),

    // ── Límites ──
    cooldownSec: Math.max(0, Number(raw.cooldownSec) || 0),
    cooldownPerUser: !!raw.cooldownPerUser,
  };
}

function normalizeConfig(raw = {}) {
  return {
    enabled: raw.enabled !== false,
    baseUrl: String(raw.baseUrl || DEFAULT_CONFIG.baseUrl).trim().replace(/\/+$/, ''),
    timeoutMs: Math.min(30000, Math.max(500, Number(raw.timeoutMs) || DEFAULT_CONFIG.timeoutMs)),
    rules: Array.isArray(raw.rules) ? raw.rules.map(normalizeRule) : [],
  };
}

function load() {
  if (cache) return cache;

  try {
    if (fs.existsSync(FILE)) {
      cache = normalizeConfig(JSON.parse(fs.readFileSync(FILE, 'utf8')));
    } else {
      cache = normalizeConfig(DEFAULT_CONFIG);
      persist(cache);
    }
  } catch {
    cache = normalizeConfig(DEFAULT_CONFIG);
  }

  return cache;
}

function persist(config) {
  try {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.warn('No se pudo guardar gameActions.json:', err.message);
  }
}

function broadcast(config) {
  if (!ioRef) return;
  ioRef.emit('gameActionsConfig', config);
}

export function getGameActions() {
  return load();
}

// Guarda la config completa (o solo algunos campos de nivel superior).
export function setGameActions(partial = {}) {
  const current = load();
  cache = normalizeConfig({ ...current, ...partial });
  persist(cache);
  broadcast(cache);
  return cache;
}

export function saveRule(rule) {
  const config = load();
  const normalized = normalizeRule(rule, config.rules.length);
  const index = config.rules.findIndex((r) => r.id === normalized.id);

  if (index >= 0) config.rules[index] = normalized;
  else config.rules.push(normalized);

  cache = config;
  persist(cache);
  broadcast(cache);
  return cache;
}

export function deleteRule(ruleId) {
  const config = load();
  config.rules = config.rules.filter((r) => r.id !== ruleId);
  cache = config;
  persist(cache);
  broadcast(cache);
  return cache;
}

// Añade o reemplaza las reglas de un preset de juego (ver gamePresets.js).
export function applyPreset(presetId, mode = 'append') {
  const preset = GAME_PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new Error('Preset de juego no encontrado');

  const config = load();
  const stamp = Date.now();
  const rules = preset.rules.map((rule, i) =>
    normalizeRule({ ...rule, id: `${preset.id}_${stamp}_${i}` }, i)
  );

  cache = normalizeConfig({
    ...config,
    baseUrl: preset.baseUrl || config.baseUrl,
    rules: mode === 'replace' ? rules : [...config.rules, ...rules],
  });

  persist(cache);
  broadcast(cache);
  return cache;
}

// ──────────────────────────────── Plantillas ────────────────────────────────

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Texto que sigue al comando en el chat ("!spawn 3" -> "3").
function commandArgs(rule, comment) {
  const text = String(comment || '').trim();
  if (rule.chatMode === 'startsWith' || rule.chatMode === 'equals') {
    return text.slice(String(rule.chatText || '').length).trim();
  }
  return text;
}

function buildContext(eventType, data, rule, quantity) {
  const user = data.uniqueId || data.user?.uniqueId || 'anon';
  const repeatCount = Math.max(1, toNumber(data.repeatCount) || 1);
  const diamondCount = toNumber(data.diamondCount);

  return {
    event: eventType,
    // TikTok solo expone el uniqueId: los tres alias apuntan al mismo valor para
    // que el usuario pueda copiar/pegar la URL del manual sin cambiar nada.
    nickname: user,
    username: user,
    user,
    uniqueId: user,
    quantity,
    repeatCount,
    giftName: data.giftName || '',
    giftId: data.giftId != null ? String(data.giftId) : '',
    diamondCount,
    totalDiamonds: diamondCount * repeatCount,
    likeCount: toNumber(data.likeCount),
    totalLikeCount: toNumber(data.totalLikeCount),
    comment: data.comment || '',
    args: commandArgs(rule, data.comment),
  };
}

// Placeholders: {nickname}, {quantity}, {giftName}... y {random(0,7)} para
// elegir un monstruo/objeto al azar dentro de un rango.
export function applyPlaceholders(template, context) {
  return String(template ?? '')
    .replace(/\{random\((-?\d+)\s*,\s*(-?\d+)\)\}/g, (_, a, b) => {
      const min = Math.min(Number(a), Number(b));
      const max = Math.max(Number(a), Number(b));
      return String(min + Math.floor(Math.random() * (max - min + 1)));
    })
    .replace(/\{(\w+)\}/g, (match, key) => {
      const value = context[key];
      return value === undefined || value === null ? match : String(value);
    });
}

// ───────────────────────────────── Filtros ──────────────────────────────────

function passesAudience(data, audience) {
  if (!audience || audience.everyone) return true;
  if (audience.moderators && data.isModerator) return true;
  if (audience.subscribers && data.isSubscriber) return true;
  if (audience.followers && ((data.followRole ?? 0) > 0 || data.isFollower)) return true;
  if (audience.fansClub && ((data.topFanLevel ?? 0) > 0 || data.fansClub)) return true;
  return false;
}

function passesChat(rule, comment) {
  if (rule.chatMode === 'any') return true;

  const text = String(comment || '').trim().toLowerCase();
  const wanted = String(rule.chatText || '').trim().toLowerCase();
  if (!wanted) return true;

  if (rule.chatMode === 'equals') return text === wanted;
  if (rule.chatMode === 'startsWith') return text.startsWith(wanted);
  if (rule.chatMode === 'contains') return text.includes(wanted);
  return true;
}

function passesGift(rule, data) {
  if (rule.giftId) {
    if (String(data.giftId || '') !== rule.giftId) return false;
  }

  if (rule.giftName) {
    const actual = String(data.giftName || '').trim().toLowerCase();
    if (actual !== rule.giftName.toLowerCase()) return false;
  }

  const diamonds = toNumber(data.diamondCount);
  if (rule.minDiamonds > 0 && diamonds < rule.minDiamonds) return false;
  if (rule.maxDiamonds > 0 && diamonds > rule.maxDiamonds) return false;

  return true;
}

function matchesRule(rule, eventType, data) {
  if (!rule.enabled) return false;
  if (rule.event !== eventType) return false;
  if (!rule.path) return false;
  if (!passesAudience(data, rule.audience)) return false;
  if (eventType === 'chat' && !passesChat(rule, data.comment)) return false;
  if (eventType === 'gift' && !passesGift(rule, data)) return false;
  return true;
}

// Clave de seguimiento (cooldown/likes): global o por usuario.
function trackKey(rule, data, perUser) {
  return perUser ? `${rule.id}|${data.uniqueId || 'anon'}` : rule.id;
}

// Likes: TikTok manda lotes (likeCount por evento). Acumulamos hasta cruzar el
// umbral y devolvemos cuántas veces se cruzó (0 = no dispara todavía).
function consumeLikes(rule, data) {
  if (rule.likesPerTrigger <= 0) return 1;

  const key = trackKey(rule, data, rule.likesPerUser);
  const total = (likeBuckets[key] || 0) + Math.max(1, toNumber(data.likeCount) || 1);
  const crossings = Math.floor(total / rule.likesPerTrigger);
  likeBuckets[key] = total - crossings * rule.likesPerTrigger;

  // Limpieza en directos largos: el acumulador crece con cada espectador nuevo.
  const keys = Object.keys(likeBuckets);
  if (keys.length > 3000) {
    for (const k of keys) if (!likeBuckets[k]) delete likeBuckets[k];
  }

  return crossings;
}

function isOnCooldown(rule, data, now) {
  if (rule.cooldownSec <= 0) return false;
  const key = trackKey(rule, data, rule.cooldownPerUser);
  if (now - (lastFired[key] || 0) < rule.cooldownSec * 1000) return true;
  lastFired[key] = now;
  return false;
}

function computeQuantity(rule, data, triggerCount) {
  let qty;

  switch (rule.scaleMode) {
    case 'combo':
      qty = Math.max(1, toNumber(data.repeatCount) || 1);
      break;
    case 'diamonds': {
      const total = toNumber(data.diamondCount) * Math.max(1, toNumber(data.repeatCount) || 1);
      qty = Math.floor(total / rule.scalePer);
      break;
    }
    case 'likes':
      qty = triggerCount;
      break;
    default:
      qty = rule.scaleFixed;
      break;
  }

  return Math.max(1, Math.min(qty || 1, rule.scaleMax, HARD_MAX_QUANTITY));
}

// ──────────────────────────────── Ejecución ─────────────────────────────────

function buildUrl(config, rule, context) {
  const rawPath = applyPlaceholders(rule.path, context);
  const isAbsolute = /^https?:\/\//i.test(rawPath);
  const base = isAbsolute ? rawPath : `${config.baseUrl}/${rawPath.replace(/^\/+/, '')}`;
  const url = new URL(base);

  for (const param of rule.params) {
    url.searchParams.set(param.key, applyPlaceholders(param.value, context));
  }

  return url.toString();
}

function record(entry) {
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  if (ioRef) ioRef.emit('gameActionDelivery', entry);
}

async function sendRequest(config, rule, context, meta = {}) {
  const url = buildUrl(config, rule, context);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  const entry = {
    id: `${rule.id}_${startedAt}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: startedAt,
    ruleId: rule.id,
    ruleName: rule.name,
    event: context.event,
    user: context.user,
    method: rule.method,
    url,
    quantity: context.quantity,
    test: !!meta.test,
  };

  try {
    const init = { method: rule.method, signal: controller.signal };

    // Los juegos leen los query params; el body JSON va solo como cortesía para
    // integraciones que prefieran POST con cuerpo.
    if (rule.method === 'POST') {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify(context);
    }

    const response = await fetch(url, init);
    const text = await response.text().catch(() => '');

    record({
      ...entry,
      ok: response.ok,
      status: response.status,
      durationMs: Date.now() - startedAt,
      response: text.slice(0, 200),
    });

    return { ok: response.ok, status: response.status, url };
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'Timeout' : error?.message || 'Error desconocido';

    record({
      ...entry,
      ok: false,
      status: null,
      durationMs: Date.now() - startedAt,
      error: message,
    });

    return { ok: false, error: message, url };
  } finally {
    clearTimeout(timer);
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Ejecuta una regla ya validada. `sendMode` decide si mandamos una llamada con
// {quantity}=N o N llamadas separadas (algunos juegos no aceptan quantity).
async function runRule(config, rule, eventType, data, triggerCount, meta = {}) {
  const quantity = computeQuantity(rule, data, triggerCount);

  if (rule.sendMode === 'repeat') {
    const context = buildContext(eventType, data, rule, 1);
    for (let i = 0; i < quantity; i += 1) {
      await sendRequest(config, rule, context, meta);
      if (rule.spacingMs > 0 && i < quantity - 1) await wait(rule.spacingMs);
    }
    return;
  }

  const context = buildContext(eventType, data, rule, quantity);
  await sendRequest(config, rule, context, meta);
}

// Llamado por el eventEngine en cada evento del live.
export async function handleGameActions(eventType, data = {}) {
  if (!GAME_EVENT_TYPES.includes(eventType)) return;

  const config = load();
  if (!config.enabled || config.rules.length === 0) return;

  const now = Date.now();

  for (const rule of config.rules) {
    if (!matchesRule(rule, eventType, data)) continue;

    // El acumulador de likes se consume ANTES del cooldown para que los likes
    // no se pierdan mientras la regla está enfriando.
    const triggerCount = eventType === 'like' ? consumeLikes(rule, data) : 1;
    if (triggerCount <= 0) continue;

    if (isOnCooldown(rule, data, now)) continue;

    // Sin await: una regla lenta no debe frenar al resto de reglas ni al engine.
    runRule(config, rule, eventType, data, triggerCount).catch((err) => {
      console.warn(`Regla de juego "${rule.name}" falló:`, err.message);
    });
  }
}

// Botón "Probar" del panel: ignora filtros, cooldown y acumuladores.
export async function testRule(ruleId, overrides = {}) {
  const config = load();
  const rule = config.rules.find((r) => r.id === ruleId);
  if (!rule) throw new Error('Regla no encontrada');
  if (!rule.path) throw new Error('La regla no tiene endpoint configurado');

  const sample = {
    uniqueId: 'streamsync_test',
    giftName: rule.giftName || 'Rose',
    giftId: rule.giftId || null,
    repeatCount: 1,
    diamondCount: Math.max(1, rule.minDiamonds || 1),
    likeCount: Math.max(1, rule.likesPerTrigger || 10),
    totalLikeCount: 100,
    comment: rule.chatText ? `${rule.chatText} test` : 'mensaje de prueba',
    isModerator: true,
    isSubscriber: true,
    isFollower: true,
    topFanLevel: 1,
    ...overrides,
  };

  const quantity = computeQuantity(rule, sample, 1);
  const context = buildContext(rule.event, sample, rule, quantity);
  return sendRequest(config, rule, context, { test: true });
}

// Comprueba si el juego responde en baseUrl (cualquier respuesta HTTP = vivo).
export async function pingGame(baseUrl) {
  const config = load();
  const target = String(baseUrl || config.baseUrl || '').trim().replace(/\/+$/, '');
  if (!target) throw new Error('Falta la URL del juego');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  const startedAt = Date.now();

  try {
    const response = await fetch(`${target}/`, { signal: controller.signal });
    return {
      reachable: true,
      status: response.status,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    // Un 404 llega como respuesta (reachable). Aquí solo caen errores de red.
    return {
      reachable: false,
      error: error?.name === 'AbortError' ? 'Sin respuesta (timeout)' : error?.message,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function getGameActionHistory(limit = 40) {
  return history.slice(0, limit);
}

export function clearGameActionHistory() {
  history.length = 0;
  return [];
}

// Reinicia acumuladores de likes y cooldowns (botón "Reiniciar contadores").
export function resetGameCounters() {
  for (const key of Object.keys(likeBuckets)) delete likeBuckets[key];
  for (const key of Object.keys(lastFired)) delete lastFired[key];
}
