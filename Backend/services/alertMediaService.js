// services/alertMediaService.js
//
// Alertas visuales por evento (regalo, seguidor, compartir, like, suscripción,
// unirse). Cada evento puede tener: imagen/GIF + sonido propios (data URL) +
// texto (título/mensaje) + ajustes (duración, volumen, animación, cooldown).
//
// Eficiencia: la media pesada (imagen/sonido en base64) vive en la config y el
// overlay la PRECARGA. Cuando ocurre un evento solo emitimos un "trigger" ligero
// con el texto ya resuelto; el overlay usa su media cacheada por tipo.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '../data/alertMedia.json');

export const ALERT_EVENT_TYPES = ['gift', 'follow', 'share', 'like', 'subscribe', 'memberJoin'];

let ioRef = null;
const lastFired = {}; // cooldown por evento

export function initAlertMedia(io) {
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
  ioRef.emit('alertMediaConfig', all);
  ioRef.of('/overlay').emit('alertMediaConfig', all);
}

export function getAlertMedia() {
  return load();
}

export function getAlertMediaFor(eventType) {
  const all = load();
  return all[eventType] || null;
}

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function hasContent(m) {
  return !!(m && (m.image || m.video || m.sound || m.title || m.message));
}

// Resuelve la clave de alerta a usar. Para regalos: primero por id exacto
// (gift:<id>), luego por nombre (gift:<nombre>), y al final el genérico 'gift'
// ("cualquier regalo"). Para el resto de eventos, la propia clave del evento.
function resolveKey(eventType, data, all) {
  if (eventType !== 'gift') {
    const m = all[eventType];
    return m && m.enabled !== false && hasContent(m) ? eventType : null;
  }
  const candidates = [];
  if (data.giftId != null) candidates.push(`gift:${String(data.giftId)}`);
  if (data.giftName) candidates.push(`gift:${norm(data.giftName)}`);
  candidates.push('gift');
  return candidates.find((k) => all[k] && all[k].enabled !== false && hasContent(all[k])) || null;
}

// Crea/define la media de un evento (subida de imagen/sonido o set completo).
export function setAlertMedia(eventType, config) {
  const all = load();
  all[eventType] = { ...(all[eventType] || {}), ...config };
  save(all);
  broadcastConfig(all);
  return all;
}

// Actualiza solo algunos campos (texto, volumen, duración, enabled, cooldown...).
export function updateAlertMedia(eventType, partial) {
  const all = load();
  if (!all[eventType]) all[eventType] = {};
  all[eventType] = { ...all[eventType], ...partial };
  save(all);
  broadcastConfig(all);
  return all;
}

// Borra un campo (image/sound) o el evento completo si no se pasa field.
export function deleteAlertMedia(eventType, field) {
  const all = load();
  if (!all[eventType]) return all;
  if (field) delete all[eventType][field];
  else delete all[eventType];
  save(all);
  broadcastConfig(all);
  return all;
}

function applyTemplate(tpl, ctx) {
  return String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => (ctx[k] == null ? '' : String(ctx[k])));
}

// Construye el payload del trigger (texto resuelto + ajustes, SIN base64).
export function buildAlertTrigger(eventType, data = {}, media) {
  const ctx = {
    user: data.uniqueId || data.nickname || 'alguien',
    giftName: data.giftName || 'regalo',
    repeatCount: data.repeatCount || 1,
    diamondCount: data.diamondCount || 0,
    likeCount: data.likeCount || 0,
  };
  return {
    type: eventType,
    title: applyTemplate(media.title, ctx),
    message: applyTemplate(media.message, ctx),
    duration: Number(media.duration) || 5000,
    animation: media.animation || 'pop',
    volume: typeof media.soundVolume === 'number' ? media.soundVolume : 0.8,
    profilePic: data.profilePic || null,
    // Marca para que el overlay sepa qué media cacheada usar:
    hasImage: !!media.image,
    hasSound: !!media.sound,
    id: `${eventType}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };
}

// Llamado por el eventEngine en cada evento. Decide si dispara una alerta visual.
export function handleAlertEvent(eventType, data = {}) {
  if (!ioRef) return;
  const all = load();
  const key = resolveKey(eventType, data, all);
  if (!key) return;
  const media = all[key];

  // Filtro de diamantes mínimos para regalos.
  if (eventType === 'gift') {
    const min = Number(media.minDiamonds) || 0;
    const dia = Number(data.diamondCount) || 0;
    if (min > 0 && dia < min) return;
  }

  // Cooldown por clave (anti-spam del lado servidor; like/join disparan mucho).
  const cd = Number(media.cooldownSec);
  if (Number.isFinite(cd) && cd > 0) {
    const now = Date.now();
    if (now - (lastFired[key] || 0) < cd * 1000) return;
    lastFired[key] = now;
  }

  const payload = buildAlertTrigger(key, data, media);
  ioRef.emit('alertMedia', payload);
  ioRef.of('/overlay').emit('alertMedia', payload);
}

// Para el botón "Probar" del dashboard. Acepta claves de evento o de regalo
// específico (gift:<id>).
export function emitAlertPreview(key) {
  if (!ioRef) return null;
  const media = getAlertMediaFor(key) || {};
  const baseType = key && String(key).startsWith('gift') ? 'gift' : key;
  const sample = {
    gift: { uniqueId: 'streamsync', giftName: media.giftName || 'Rose', repeatCount: 3, diamondCount: 5 },
    follow: { uniqueId: 'nuevo_seguidor' },
    share: { uniqueId: 'viewer' },
    like: { uniqueId: 'viewer', likeCount: 30 },
    subscribe: { uniqueId: 'nuevo_sub' },
    memberJoin: { uniqueId: 'viewer' },
  }[baseType] || { uniqueId: 'streamsync' };

  const payload = { ...buildAlertTrigger(key, sample, media), preview: true };
  ioRef.emit('alertMedia', payload);
  ioRef.of('/overlay').emit('alertMedia', payload);
  return payload;
}
