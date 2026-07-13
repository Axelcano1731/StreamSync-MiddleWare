// services/entranceService.js
//
// Entradas de Superfans/Suscriptores: cuando un usuario CONCRETO entra al directo
// (memberJoin) o se suscribe (subscribe), se reproduce un video con música
// personalizado que anuncia su llegada. Es análogo a las alertas por regalo del
// alertMediaService, pero indexado por NOMBRE DE USUARIO en vez de por regalo.
//
// Claves posibles en entrances.json:
//   "<usuario-normalizado>"  -> entrada de un usuario específico
//   "*subscriber"            -> entrada por defecto para cualquier suscriptor
//   "*superfan"              -> entrada por defecto para cualquier superfan (Club de Fans)
//
// Eficiencia: el video/audio pesado (base64) vive en la config y el overlay lo
// PRECARGA. En cada evento solo emitimos un "trigger" ligero (texto ya resuelto +
// la clave a usar); el overlay reproduce su media cacheada por clave.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '../data/entrances.json');

// Eventos que pueden disparar una entrada.
export const ENTRANCE_EVENT_TYPES = ['memberJoin', 'subscribe'];
// Claves reservadas para entradas por defecto (no son nombres de usuario).
export const ENTRANCE_DEFAULT_KEYS = ['*subscriber', '*superfan'];

const DEFAULT_COOLDOWN_SEC = 60; // evita repetir la entrada si el usuario re-entra
// TikTok NO manda el evento de "unión" (memberJoin) de forma fiable (lo muestrea
// y suele suprimirlo para mods/gente que reentra). Por eso el disparador fiable
// es la ACTIVIDAD del usuario (chat/like/regalo): su primera interacción tras un
// rato de ausencia cuenta como su "entrada". Este es el hueco de ausencia por
// defecto para considerar que "reapareció".
const DEFAULT_PRESENCE_GAP_SEC = 300; // 5 min

let ioRef = null;
const lastFired = {}; // cooldown por `${clave}|${usuario}`
const lastSeen = {};  // presencia: última actividad por `${clave}|${usuario}`

export function initEntrances(io) {
  ioRef = io;
}

function load() {
  try {
    if (!fs.existsSync(FILE)) return {};
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function broadcastConfig(all) {
  if (!ioRef) return;
  ioRef.emit('entranceConfig', all);
  ioRef.of('/overlay').emit('entranceConfig', all);
}

// Normaliza un nombre de usuario a clave: minúsculas, sin acentos, sin @ inicial.
export function normUser(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^@+/, '')
    .trim();
}

function hasContent(m) {
  return !!(m && (m.video || m.sound || m.title || m.message));
}

export function getEntrances() {
  return load();
}

export function getEntranceFor(key) {
  const all = load();
  return all[key] || null;
}

// Resuelve la entrada a usar (sin filtrar por trigger): primero el usuario
// concreto, luego los defaults por superfan y por suscriptor (si su identidad lo
// indica / es un evento de sub). Devuelve { key, media } o null.
function resolveEntry(eventType, data, all) {
  const candidates = [];
  const userKey = normUser(data.uniqueId);
  if (userKey) candidates.push(userKey);
  if ((Number(data.topFanLevel) || 0) > 0) candidates.push('*superfan');
  if (data.isSubscriber || eventType === 'subscribe') candidates.push('*subscriber');

  const key = candidates.find(
    (k) => all[k] && all[k].enabled !== false && hasContent(all[k])
  );
  return key ? { key, media: all[key] } : null;
}

// Decide si ESTE evento debe disparar la entrada, según los triggers de la
// entrada y cuánto hace que no veíamos al usuario (prevSeen).
function shouldFire(eventType, media, prevSeen, now) {
  const t = media.triggers || {};
  if (eventType === 'memberJoin' && t.join !== false) return true;
  if (eventType === 'subscribe' && t.subscribe !== false) return true;
  // Disparador por ACTIVIDAD (chat/like/regalo/etc.): fiable. Solo si el usuario
  // "reaparece" tras un hueco de ausencia (no re-dispara mientras está activo).
  if (t.activity !== false) {
    const gapMs =
      (media.presenceGapSec == null ? DEFAULT_PRESENCE_GAP_SEC : Number(media.presenceGapSec)) * 1000;
    if (now - prevSeen >= gapMs) return true;
  }
  return false;
}

// Crea/define la entrada de una clave (subida de video/sonido o set completo).
export function setEntrance(key, config) {
  const all = load();
  all[key] = { ...(all[key] || {}), ...config };
  save(all);
  broadcastConfig(all);
  return all;
}

// Actualiza solo algunos campos.
export function updateEntrance(key, partial) {
  const all = load();
  if (!all[key]) all[key] = {};
  all[key] = { ...all[key], ...partial };
  save(all);
  broadcastConfig(all);
  return all;
}

// Borra un campo (video/sound) o la entrada completa si no se pasa field.
export function deleteEntrance(key, field) {
  const all = load();
  if (!all[key]) return all;
  if (field) delete all[key][field];
  else delete all[key];
  save(all);
  broadcastConfig(all);
  return all;
}

function applyTemplate(tpl, ctx) {
  return String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => (ctx[k] == null ? '' : String(ctx[k])));
}

// Construye el payload del trigger (texto resuelto + ajustes, SIN base64).
export function buildEntranceTrigger(key, data = {}, media = {}) {
  const ctx = {
    user: data.uniqueId || media.user || 'alguien',
  };
  return {
    key, // el overlay usa esta clave para tomar su media cacheada (video/sound)
    user: ctx.user,
    title: applyTemplate(media.title, ctx),
    message: applyTemplate(media.message, ctx),
    duration: Number(media.duration) || 8000,
    animation: media.animation || 'pop',
    loop: !!media.loop,
    muteVideo: !!media.muteVideo,
    volume: typeof media.soundVolume === 'number' ? media.soundVolume : 0.8,
    avatar: data.profilePic || media.avatar || null,
    hasVideo: !!media.video,
    hasSound: !!media.sound,
    id: `entrance_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };
}

// Llamado por el eventEngine en CADA evento con usuario (chat/like/regalo/
// seguir/compartir/suscribir/unirse). Decide si dispara una entrada personalizada.
export function handleEntranceEvent(eventType, data = {}) {
  if (!ioRef) return;

  const all = load();
  const resolved = resolveEntry(eventType, data, all);
  if (!resolved) return;
  const { key, media } = resolved;

  const now = Date.now();
  const track = `${key}|${normUser(data.uniqueId)}`;

  // Presencia: cuánto hace que no veíamos a este usuario. Se actualiza SIEMPRE
  // (dispare o no) para que el disparador por actividad no se repita mientras
  // sigue activo.
  const prevSeen = lastSeen[track] || 0;
  lastSeen[track] = now;
  // Limpieza ocasional para no crecer sin límite en directos largos.
  if (Object.keys(lastSeen).length > 2000) {
    for (const [k, ts] of Object.entries(lastSeen)) {
      if (now - ts > 6 * 60 * 60 * 1000) delete lastSeen[k];
    }
  }

  if (!shouldFire(eventType, media, prevSeen, now)) return;

  // Cooldown por clave + usuario: guarda extra contra dobles disparos
  // (p. ej. suscribirse + unirse casi a la vez).
  const cd = media.cooldownSec == null ? DEFAULT_COOLDOWN_SEC : Number(media.cooldownSec);
  if (Number.isFinite(cd) && cd > 0) {
    if (now - (lastFired[track] || 0) < cd * 1000) return;
  }
  lastFired[track] = now;

  const payload = buildEntranceTrigger(key, data, media);
  ioRef.emit('entranceMedia', payload);
  ioRef.of('/overlay').emit('entranceMedia', payload);
}

// Para el botón "Probar" del dashboard.
export function emitEntrancePreview(key) {
  if (!ioRef) return null;
  const media = getEntranceFor(key) || {};
  const sample = {
    uniqueId: media.user || (key && !key.startsWith('*') ? key : 'superfan_demo'),
    profilePic: media.avatar || null,
  };
  const payload = { ...buildEntranceTrigger(key, sample, media), preview: true };
  ioRef.emit('entranceMedia', payload);
  ioRef.of('/overlay').emit('entranceMedia', payload);
  return payload;
}
