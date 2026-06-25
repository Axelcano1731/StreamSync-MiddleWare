import { getConfig } from '../config/alertConfig.js';
import { sendMinecraftCommand, getMinecraftStatus } from './minecraftServerService.js';

/**
 * Puente Bedrock Box — convierte eventos del live (gifts, follows, likes, shares)
 * en comandos de consola del servidor de Minecraft.
 *
 * Lee la seccion `minecraftActions` de la config (ver config/alertConfig.js) y,
 * por cada regla que coincida con el evento, escribe el comando por stdin del
 * servidor usando sendMinecraftCommand().
 *
 * Forma de cada regla:
 *   {
 *     event: 'gift' | 'follow' | 'like' | 'share',
 *     giftName: string,        // solo gifts; vacio = cualquier regalo
 *     command: string,         // estilo consola, SIN '/' inicial
 *     enabled: boolean,
 *     minDiamonds: number,     // solo gifts; dispara si el regalo vale >= X
 *     repeatPerGift: boolean,  // repite el comando segun repeatCount
 *     maxRepeat: number,       // tope cuando repeatPerGift esta activo
 *   }
 *
 * Placeholders soportados en `command`:
 *   {user} {repeatCount} {giftName} {diamondCount} {likeCount}
 */

const DEFAULT_MAX_REPEAT = 50;
const HARD_REPEAT_LIMIT = 100;
const SUPPORTED_EVENTS = new Set(['gift', 'follow', 'like', 'share']);

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildContext(data) {
  return {
    user: data.uniqueId || data.user?.uniqueId || 'jugador',
    repeatCount: data.repeatCount || 1,
    giftName: data.giftName || '',
    diamondCount: toNumber(data.diamondCount),
    likeCount: data.likeCount || 0,
  };
}

function applyPlaceholders(template, context) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => {
    const value = context[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

/**
 * Limpia el comando: quita la barra inicial (la consola no la usa) y elimina
 * saltos de linea para que no se cuelen comandos extra.
 */
function sanitizeCommand(command) {
  return String(command || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/^\s*\/+/, '')
    .trim();
}

function ruleMatches(rule, eventType, data) {
  if (!rule || rule.enabled === false) return false;
  if (rule.event !== eventType) return false;

  if (eventType === 'gift') {
    const wanted = String(rule.giftName || '').trim().toLowerCase();
    if (wanted) {
      const actual = String(data.giftName || '').trim().toLowerCase();
      if (actual !== wanted) return false;
    }

    if (rule.minDiamonds > 0 && toNumber(data.diamondCount) < rule.minDiamonds) {
      return false;
    }
  }

  return true;
}

function resolveRepeat(rule, data) {
  if (!rule.repeatPerGift) return 1;
  const max = Math.min(rule.maxRepeat || DEFAULT_MAX_REPEAT, HARD_REPEAT_LIMIT);
  const times = data.repeatCount || 1;
  return Math.max(1, Math.min(times, max));
}

export async function handleMinecraftActions(eventType, data = {}) {
  if (!SUPPORTED_EVENTS.has(eventType)) return;

  const actions = getConfig().minecraftActions;

  if (!actions?.enabled || !Array.isArray(actions.rules) || actions.rules.length === 0) {
    return;
  }

  // Si el servidor no esta en ejecucion no tiene sentido intentar (evita ruido por cada gift).
  if (!getMinecraftStatus().isRunning) {
    return;
  }

  const context = buildContext(data);

  for (const rule of actions.rules) {
    if (!ruleMatches(rule, eventType, data)) continue;

    const command = sanitizeCommand(applyPlaceholders(rule.command, context));
    if (!command) continue;

    const times = resolveRepeat(rule, data);

    for (let i = 0; i < times; i += 1) {
      try {
        await sendMinecraftCommand(command);
      } catch (err) {
        // Si el servidor se cayo a mitad, no seguir insistiendo con esta regla.
        console.warn(`No se pudo enviar comando de Minecraft "${command}":`, err.message);
        break;
      }
    }
  }
}
