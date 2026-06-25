import { getConfig } from '../config/alertConfig.js';

/**
 * Avatar Battle — traduce eventos del live (gifts, likes) en acciones del juego
 * y las emite por Socket.io al overlay `avatar-battle-overlay.html`.
 *
 * La LOGICA del combate vive en el overlay (cliente). Este servicio solo decide
 * QUE entra al ring: regalo -> "spawnea avatar X" o "lanza efecto Y", segun las
 * reglas de config.avatarBattle.
 *
 * Eventos que emite (namespace raiz, igual que el ticker):
 *   battle:spawn   -> entra un guerrero
 *   battle:effect  -> efecto global (meteoro / cura)
 *   battle:control -> reset / nueva ronda
 *
 * Reglas (config.avatarBattle.rules), prioridad de mayor a menor:
 *   byId   -> por giftId exacto
 *   byName -> por nombre del regalo (minusculas)
 *   byTier -> por diamantes (el tier mas alto alcanzado)
 *   default
 */

let ioRef = null;

// Dedupe de combos: ultimo combo procesado por usuario+regalo, para no spawnear
// en cada frame intermedio de un regalo "streakable".
const lastStreak = new Map();
const STREAK_TTL = 60_000;

const DEFAULT_RULES = {
  byId: {},
  byName: {},
  byTier: [{ minDiamonds: 1, action: { type: 'avatar', hp: 80, power: 8, weapon: 'fist' } }],
  default: { type: 'avatar', hp: 80, power: 8, weapon: 'fist' },
};

export function initAvatarBattle(io) {
  ioRef = io;
}

function getSettings() {
  const cfg = getConfig().avatarBattle || {};
  return {
    enabled: cfg.enabled !== false,
    likesBuff: cfg.likesBuff !== false,
    likesPerBuff: Number(cfg.likesPerBuff) || 50,
    rules: cfg.rules || DEFAULT_RULES,
  };
}

function emit(event, payload) {
  if (!ioRef) return;
  ioRef.emit(event, payload);
  // Tambien al namespace /overlay por si algun overlay se conecta ahi.
  ioRef.of('/overlay').emit(event, payload);
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Lee un evento de gift sea ya normalizado (el de StreamSync) o el crudo de
 * tiktok-live-connector. Devuelve campos planos.
 */
function readGift(data = {}) {
  const gift = data.gift || {};
  const user = data.user || {};

  return {
    userId: data.userId || user.userId || user.uniqueId || data.uniqueId || 'anon',
    nickname:
      data.nickname || user.nickname || user.uniqueId || data.uniqueId || 'Anon',
    avatarUrl: data.profilePic || user.profilePicture || user.profilePictureUrl || null,
    giftId: data.giftId ?? gift.giftId ?? gift.id ?? null,
    giftName: String(data.giftName ?? gift.giftName ?? gift.name ?? '').trim(),
    diamonds: toNumber(data.diamondCount ?? gift.diamondCount ?? gift.diamond_count, 0),
    repeatCount: toNumber(data.repeatCount ?? gift.repeatCount, 1) || 1,
    giftType: data.giftType ?? gift.giftType ?? null,
    repeatEnd: data.repeatEnd ?? gift.repeatEnd ?? null,
  };
}

/**
 * Para regalos streakable (giftType === 1) solo actuamos en el frame final
 * (repeatEnd truthy). Si no hay info de streak, actuamos siempre (sin dedupe).
 */
function shouldActOnGift(g) {
  const streakable = g.giftType === 1;
  if (!streakable) return true;
  if (g.repeatEnd === null) return true; // sin dato => no podemos deducir, actuar
  return Boolean(g.repeatEnd);
}

function pickRule(rules, g) {
  // byId
  if (g.giftId != null && rules.byId && rules.byId[String(g.giftId)]) {
    return rules.byId[String(g.giftId)];
  }

  // byName
  const nameKey = g.giftName.toLowerCase();
  if (nameKey && rules.byName && rules.byName[nameKey]) {
    return rules.byName[nameKey];
  }

  // byTier (el tier mas alto cuyo minDiamonds <= diamantes del regalo)
  if (Array.isArray(rules.byTier) && rules.byTier.length > 0) {
    const matched = rules.byTier
      .filter((t) => g.diamonds >= toNumber(t.minDiamonds, 0))
      .sort((a, b) => toNumber(b.minDiamonds) - toNumber(a.minDiamonds))[0];
    if (matched?.action) return matched.action;
  }

  return rules.default || DEFAULT_RULES.default;
}

function buildActor(g) {
  return {
    name: g.nickname,
    userId: g.userId,
    avatarUrl: g.avatarUrl,
    diamonds: g.diamonds,
    combo: g.repeatCount,
  };
}

export function handleGift(data) {
  const { enabled, rules } = getSettings();
  if (!enabled || !ioRef) return;

  const g = readGift(data);
  if (!shouldActOnGift(g)) return;

  // Dedupe duro por si llegan dos "finales" del mismo combo muy seguidos.
  if (g.giftType === 1) {
    const key = `${g.userId}:${g.giftId ?? g.giftName}:${g.repeatCount}`;
    const now = Date.now();
    const prev = lastStreak.get(key);
    if (prev && now - prev < 1500) return;
    lastStreak.set(key, now);
  }

  const action = pickRule(rules, g) || DEFAULT_RULES.default;
  const actor = buildActor(g);

  if (action.type === 'effect') {
    emit('battle:effect', {
      effect: action.effect || 'meteor',
      target: action.target || 'all',
      intensity: toNumber(action.intensity, 1),
      from: actor,
    });
    return;
  }

  if (action.type === 'control') {
    emit('battle:control', { action: action.action || 'reset' });
    return;
  }

  // type === 'avatar' (por defecto)
  const scaleWithCombo = Boolean(action.scaleWithCombo);
  const maxCopies = Math.max(1, Math.min(toNumber(action.maxCopies, 20), 50));
  const copies = scaleWithCombo ? 1 : Math.max(1, Math.min(g.repeatCount, maxCopies));
  const comboMult = scaleWithCombo ? Math.max(1, g.repeatCount) : 1;

  for (let i = 0; i < copies; i += 1) {
    emit('battle:spawn', {
      actor,
      hp: Math.round(toNumber(action.hp, 80) * comboMult),
      power: Math.round(toNumber(action.power, 8) * comboMult),
      weapon: action.weapon || 'fist',
      team: action.team || null, // null => el overlay balancea
      tint: action.tint || null,
    });
  }
}

let likeAccumulator = 0;

export function handleLike(data = {}) {
  const { enabled, likesBuff, likesPerBuff } = getSettings();
  if (!enabled || !likesBuff || !ioRef) return;

  likeAccumulator += toNumber(data.likeCount ?? data.likes, 1) || 1;
  if (likeAccumulator < likesPerBuff) return;

  likeAccumulator = 0;
  emit('battle:effect', {
    effect: 'heal',
    target: 'all',
    intensity: 0.5,
    from: { name: data.uniqueId || data.nickname || 'likes' },
  });
}

/** Punto unico que llama eventEngine.processEvent. */
export function handleEvent(eventType, data) {
  if (eventType === 'gift') return handleGift(data);
  if (eventType === 'like') return handleLike(data);
}

export function controlBattle(action = 'reset') {
  emit('battle:control', { action });
}

// Limpieza periodica del dedupe de combos.
setInterval(() => {
  const now = Date.now();
  for (const [key, time] of lastStreak) {
    if (now - time > STREAK_TTL) lastStreak.delete(key);
  }
}, 30_000);
