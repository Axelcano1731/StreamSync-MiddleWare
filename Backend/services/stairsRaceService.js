import { getConfig } from '../config/alertConfig.js';

/**
 * Stairs Race — juego de viewers tipo "escalera/parkour" (HEROES vs VILLANOS).
 *
 * Traduce eventos del live en empujes y los emite por Socket.io al overlay
 * `stairs-race-overlay.html`. La LOGICA del juego (posiciones, victoria,
 * animacion, modo tug/race) vive en el overlay (cliente). Este servicio solo
 * decide QUE entra: a que bando va un regalo y con cuanta fuerza.
 *
 * Asignacion de bando (mixta), prioridad de mayor a menor:
 *   1. keyword en el chat -> el viewer eligio bando ("heroe"/"villano")
 *   2. mapeo del regalo    -> config.stairsRace.rules.heroes/villains
 *   3. defaultTeam
 *
 * Eventos que emite (namespace raiz + /overlay, igual que avatar battle):
 *   stairs:push    -> { team, steps, actor }  empuja al bando
 *   stairs:join    -> { team, actor }         un viewer se unio por keyword
 *   stairs:control -> { action, mode? }       reset / round / mode
 */

let ioRef = null;

// Bando elegido por keyword: userId -> { team, ts }
const teams = new Map();
const TEAM_TTL = 30 * 60_000; // 30 min sin actividad => se olvida

// Dedupe de combos streakable, igual que avatar battle.
const lastStreak = new Map();
const STREAK_TTL = 60_000;

const DEFAULT_STEPS = { byTier: [{ minDiamonds: 1, steps: 5 }], default: 5 };

export function initStairsRace(io) {
  ioRef = io;
}

function getSettings() {
  const cfg = getConfig().stairsRace || {};
  return {
    enabled: cfg.enabled !== false,
    mode: cfg.mode === 'race' ? 'race' : 'tug',
    goal: Number(cfg.goal) || 1000,
    defaultTeam: cfg.defaultTeam === 'villains' ? 'villains' : 'heroes',
    keywords: cfg.keywords || { heroes: [], villains: [] },
    rules: cfg.rules || {},
  };
}

function emit(event, payload) {
  if (!ioRef) return;
  ioRef.emit(event, payload);
  ioRef.of('/overlay').emit(event, payload);
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Normaliza texto: minusculas, sin acentos, espacios colapsados. */
function deburr(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function readGift(data = {}) {
  const gift = data.gift || {};
  const user = data.user || {};
  return {
    userId: data.userId || user.userId || user.uniqueId || data.uniqueId || 'anon',
    nickname: data.nickname || user.nickname || user.uniqueId || data.uniqueId || 'Anon',
    avatarUrl: data.profilePic || user.profilePicture || user.profilePictureUrl || null,
    giftId: data.giftId ?? gift.giftId ?? gift.id ?? null,
    giftName: String(data.giftName ?? gift.giftName ?? gift.name ?? '').trim(),
    diamonds: toNumber(data.diamondCount ?? gift.diamondCount ?? gift.diamond_count, 0),
    repeatCount: toNumber(data.repeatCount ?? gift.repeatCount, 1) || 1,
    giftType: data.giftType ?? gift.giftType ?? null,
    repeatEnd: data.repeatEnd ?? gift.repeatEnd ?? null,
  };
}

function shouldActOnGift(g) {
  const streakable = g.giftType === 1;
  if (!streakable) return true;
  if (g.repeatEnd === null) return true;
  return Boolean(g.repeatEnd);
}

function getChosenTeam(userId) {
  const entry = teams.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.ts > TEAM_TTL) {
    teams.delete(userId);
    return null;
  }
  return entry.team;
}

function setChosenTeam(userId, team) {
  teams.set(userId, { team, ts: Date.now() });
}

/** Detecta si un comentario pide unirse a un bando. */
function resolveTeamByKeyword(comment, keywords) {
  const text = deburr(comment);
  if (!text) return null;
  const words = new Set(text.split(' '));
  const hit = (list) =>
    (list || []).some((raw) => {
      const k = deburr(raw);
      if (!k) return false;
      return words.has(k) || text === k || text.startsWith(k + ' ') || text.endsWith(' ' + k);
    });
  if (hit(keywords.heroes)) return 'heroes';
  if (hit(keywords.villains)) return 'villains';
  return null;
}

/** Decide el bando de un regalo segun el mapeo (sin contar keyword). */
function resolveTeamByGift(g, rules, defaultTeam) {
  const id = g.giftId != null ? String(g.giftId) : null;
  const name = g.giftName.toLowerCase();
  const matches = (side = {}) =>
    Boolean((id && side.byId && side.byId[id]) || (name && side.byName && side.byName[name]));

  if (matches(rules.villains)) return 'villains';
  if (matches(rules.heroes)) return 'heroes';
  return defaultTeam;
}

function stepsForDiamonds(steps, diamonds) {
  const cfg = steps || DEFAULT_STEPS;
  const tiers = Array.isArray(cfg.byTier) ? cfg.byTier : [];
  const matched = tiers
    .filter((t) => diamonds >= toNumber(t.minDiamonds, 0))
    .sort((a, b) => toNumber(b.minDiamonds) - toNumber(a.minDiamonds))[0];
  return matched ? toNumber(matched.steps, cfg.default || 5) : toNumber(cfg.default, 5);
}

function buildActor(g) {
  return {
    name: g.nickname,
    userId: g.userId,
    avatarUrl: g.avatarUrl,
    team: getChosenTeam(g.userId) || null,
  };
}

export function handleGift(data) {
  const s = getSettings();
  if (!s.enabled || !ioRef) return;

  const g = readGift(data);
  if (!shouldActOnGift(g)) return;

  if (g.giftType === 1) {
    const key = `${g.userId}:${g.giftId ?? g.giftName}:${g.repeatCount}`;
    const now = Date.now();
    const prev = lastStreak.get(key);
    if (prev && now - prev < 1500) return;
    lastStreak.set(key, now);
  }

  const team = getChosenTeam(g.userId) || resolveTeamByGift(g, s.rules, s.defaultTeam);
  const base = stepsForDiamonds(s.rules.steps, g.diamonds);
  const steps = Math.max(1, Math.round(base * (g.repeatCount || 1)));

  emit('stairs:push', { team, steps, actor: buildActor(g) });
}

export function handleChat(data = {}) {
  const s = getSettings();
  if (!s.enabled || !ioRef) return;

  const team = resolveTeamByKeyword(data.comment, s.keywords);
  if (!team) return;

  const userId = data.userId || data.uniqueId || 'anon';
  const nickname = data.nickname || data.uniqueId || 'Anon';
  setChosenTeam(userId, team);

  emit('stairs:join', { team, actor: { name: nickname, userId, avatarUrl: data.profilePic || null } });
}

/** Punto unico que llama eventEngine.processEvent. */
export function handleEvent(eventType, data) {
  if (eventType === 'gift') return handleGift(data);
  if (eventType === 'chat') return handleChat(data);
}

export function controlStairs(action = 'reset', opts = {}) {
  if (action === 'mode') {
    emit('stairs:control', { action: 'mode', mode: opts.mode === 'race' ? 'race' : 'tug' });
    return;
  }
  if (action === 'clearTeams') {
    teams.clear();
    emit('stairs:control', { action: 'reset' });
    return;
  }
  emit('stairs:control', { action: action === 'round' ? 'round' : 'reset' });
}

// Limpieza periodica.
setInterval(() => {
  const now = Date.now();
  for (const [key, time] of lastStreak) {
    if (now - time > STREAK_TTL) lastStreak.delete(key);
  }
  for (const [userId, entry] of teams) {
    if (now - entry.ts > TEAM_TTL) teams.delete(userId);
  }
}, 30_000);
