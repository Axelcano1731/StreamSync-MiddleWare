import { getConfig } from '../config/alertConfig.js';
import { searchAndPlay, skipTrack, getCurrentTrack, getSpotifyStatus } from './spotifyService.js';
import { dispatchWebhooks } from './webhookService.js';
import { handleMinecraftActions } from './minecraftActionsService.js';
import { handleEvent as handleAvatarBattle } from './avatarBattleService.js';
import { handleEvent as handleStairsRace } from './stairsRaceService.js';

/**
 * Event Engine — Processes stream events through configurable rules
 * Trigger -> Condition -> Action pipeline
 * Includes chat command processing, alert rendering, TTS and webhooks.
 */

let eventQueue = [];
let ioRef = null;

const spamTracker = new Map();
const SPAM_WINDOW = 5000;
const SPAM_THRESHOLD = 10;

const commandCooldown = new Map();
const COMMAND_COOLDOWN = 3000;

const PREVIEW_EVENT_DATA = {
  gift: {
    uniqueId: 'streamsync_preview',
    giftName: 'Galaxy',
    repeatCount: 1,
    diamondCount: 1000,
  },
  follow: {
    uniqueId: 'nuevo_seguidor',
  },
  share: {
    uniqueId: 'community_boost',
  },
  chat: {
    uniqueId: 'viewer_activo',
    comment: 'Este es un mensaje de prueba para tu overlay.',
  },
  like: {
    uniqueId: 'like_machine',
    likeCount: 25,
    totalLikeCount: 250,
  },
  memberJoin: {
    uniqueId: 'nuevo_viewer',
  },
};

export function initEngine(io) {
  ioRef = io;
}

function emitGoalProgress(goals) {
  if (!ioRef) {
    return;
  }

  ioRef.emit('goalProgress', goals);
  ioRef.of('/overlay').emit('goalProgress', goals);
}

function syncGoalProgress(eventType, data) {
  const config = getConfig();
  const goals = config.goals || {};
  let changed = false;

  switch (eventType) {
    case 'like':
      if (goals.likes?.enabled) {
        goals.likes.current += data.likeCount || 1;
        changed = true;
      }
      break;
    case 'follow':
      if (goals.followers?.enabled) {
        goals.followers.current += 1;
        changed = true;
      }
      break;
    case 'gift':
      if (goals.gifts?.enabled) {
        goals.gifts.current += data.repeatCount || 1;
        changed = true;
      }
      if (goals.diamonds?.enabled) {
        const diamonds = typeof data.diamondCount === 'number' ? data.diamondCount : 0;
        goals.diamonds.current += diamonds * (data.repeatCount || 1);
        changed = true;
      }
      break;
    default:
      break;
  }

  if (changed) {
    emitGoalProgress(goals);
  }
}

function containsBlockedWords(text, blockedWords = []) {
  if (!text || blockedWords.length === 0) return false;
  const lower = text.toLowerCase();
  return blockedWords.some((word) => lower.includes(word.toLowerCase()));
}

function isSpamming(userId) {
  const now = Date.now();
  const tracker = spamTracker.get(userId);

  if (!tracker || now - tracker.lastTime > SPAM_WINDOW) {
    spamTracker.set(userId, { count: 1, lastTime: now });
    return false;
  }

  tracker.count += 1;
  tracker.lastTime = now;
  return tracker.count > SPAM_THRESHOLD;
}

function isOnCooldown(userId) {
  const last = commandCooldown.get(userId);
  if (!last || Date.now() - last > COMMAND_COOLDOWN) {
    commandCooldown.set(userId, Date.now());
    return false;
  }
  return true;
}

function getDefaultAlertTitle(eventType) {
  switch (eventType) {
    case 'gift':
      return 'Nuevo regalo';
    case 'follow':
      return 'Nuevo seguidor';
    case 'share':
      return 'Directo compartido';
    case 'chat':
      return 'Nuevo comentario';
    case 'like':
      return 'Likes en vivo';
    case 'memberJoin':
      return 'Nuevo viewer';
    default:
      return 'Nueva alerta';
  }
}

function getDefaultAlertMessage(eventType, data) {
  switch (eventType) {
    case 'gift':
      return `${data.uniqueId} envio ${data.repeatCount || 1}x ${data.giftName || 'Regalo'}`;
    case 'follow':
      return `${data.uniqueId} empezo a seguirte`;
    case 'share':
      return `${data.uniqueId} compartio tu live`;
    case 'chat':
      return `${data.uniqueId}: ${data.comment || ''}`;
    case 'like':
      return `${data.uniqueId} envio ${data.likeCount || 1} likes`;
    case 'memberJoin':
      return `${data.uniqueId} se unio al directo`;
    default:
      return '';
  }
}

function buildTemplateContext(eventType, data) {
  return {
    eventType,
    user: data.uniqueId || data.user?.uniqueId || 'unknown',
    comment: data.comment || '',
    likeCount: data.likeCount || 0,
    totalLikeCount: data.totalLikeCount || 0,
    repeatCount: data.repeatCount || 1,
    giftName: data.giftName || 'Regalo',
    diamondCount: data.diamondCount || 0,
    viewerCount: data.viewerCount || 0,
  };
}

function applyTemplate(template, context, fallback) {
  const base = template || fallback || '';
  return base.replace(/\{(\w+)\}/g, (_, key) => {
    const value = context[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

function emitChatResponse(message) {
  if (ioRef) {
    ioRef.emit('chatResponse', { message, timestamp: Date.now() });
  }
}

async function broadcastNowPlaying() {
  if (!ioRef) return;
  try {
    const track = await getCurrentTrack();
    const payload = track || { isPlaying: false };
    ioRef.emit('nowPlaying', payload);
    ioRef.of('/overlay').emit('nowPlaying', payload);
  } catch {
    // Ignore broadcast failures
  }
}

function emitAlert(alertEvent) {
  if (!ioRef) {
    return;
  }

  ioRef.emit('alert', alertEvent);
  ioRef.of('/overlay').emit('alert', alertEvent);
}

function createAlertEvent(eventType, data, alertConfig, meta = {}) {
  const config = getConfig();
  const templateContext = buildTemplateContext(eventType, data);

  return {
    id: `${eventType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: eventType,
    timestamp: Date.now(),
    user: templateContext.user,
    title: applyTemplate(
      alertConfig.titleTemplate,
      templateContext,
      getDefaultAlertTitle(eventType)
    ),
    message: applyTemplate(
      alertConfig.messageTemplate,
      templateContext,
      getDefaultAlertMessage(eventType, data)
    ),
    templateContext,
    data,
    meta,
    config: {
      sound: alertConfig.sound,
      volume: alertConfig.volume,
      duration: alertConfig.duration,
      animation: alertConfig.animation,
      showOverlay: alertConfig.showOverlay,
      tts: alertConfig.tts,
      presetId: config.overlay?.defaultPresetId || null,
    },
  };
}

async function processChatCommand(data) {
  const comment = (data.comment || '').trim();
  if (!comment.startsWith('!')) return false;

  const userId = data.uniqueId || 'unknown';
  const parts = comment.split(' ');
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  if (isOnCooldown(userId)) return true;

  switch (command) {
    case '!play':
    case '!reproducir': {
      if (!args) {
        emitChatResponse(`@${userId} usa: !play <nombre de canción>`);
        return true;
      }

      const status = getSpotifyStatus();
      if (!status.isConnected) {
        emitChatResponse(`@${userId} Spotify no está conectado`);
        return true;
      }

      try {
        const track = await searchAndPlay(args);
        if (track) {
          emitChatResponse(`@${userId} puso: ${track.name} - ${track.artist}`);
          broadcastNowPlaying();
        } else {
          emitChatResponse(`@${userId} no encontró: ${args}`);
        }
      } catch {
        emitChatResponse(`@${userId} no pudo reproducir la canción`);
      }
      return true;
    }

    case '!song':
    case '!cancion':
    case '!np': {
      const status = getSpotifyStatus();
      if (!status.isConnected) {
        emitChatResponse(`@${userId} Spotify no está conectado`);
        return true;
      }

      const current = await getCurrentTrack();
      if (current && current.isPlaying) {
        emitChatResponse(`Ahora suena: ${current.name} - ${current.artist}`);
      } else {
        emitChatResponse('No hay música reproduciéndose');
      }
      return true;
    }

    case '!skip':
    case '!saltar': {
      const status = getSpotifyStatus();
      if (!status.isConnected) {
        emitChatResponse(`@${userId} Spotify no está conectado`);
        return true;
      }

      const next = await skipTrack();
      if (next) {
        emitChatResponse(`@${userId} saltó la canción -> ${next.name || 'siguiente'}`);
        broadcastNowPlaying();
      }
      return true;
    }

    default:
      return false;
  }
}

export function processEvent(eventType, data) {
  const config = getConfig();
  const alertConfig = config.alerts[eventType] || {};
  const userId = data.uniqueId || data.user?.uniqueId || 'unknown';

  if (eventType === 'chat') {
    processChatCommand(data).catch(() => {});
  }

  if (config.tts.filterSpam && isSpamming(userId)) {
    console.log(`Spam filtered: ${userId}`);
    return;
  }

  if (eventType === 'chat' && containsBlockedWords(data.comment, config.tts.blockedWords)) {
    console.log(`Blocked word detected from ${userId}`);
    return;
  }

  dispatchWebhooks(eventType, data, {
    receivedAt: Date.now(),
  }).catch((err) => {
    console.warn(`Error enviando webhooks para ${eventType}:`, err.message);
  });

  syncGoalProgress(eventType, data);

  // Puente Bedrock Box: dispara comandos de Minecraft segun los gifts/eventos.
  // Va antes del check de alertas para que los comandos corran aunque la alerta
  // visual este apagada.
  handleMinecraftActions(eventType, data).catch((err) => {
    console.warn('Error en acciones de Minecraft:', err.message);
  });

  // Avatar Battle: traduce gifts/likes en acciones del juego (overlay web).
  try {
    handleAvatarBattle(eventType, data);
  } catch (err) {
    console.warn('Error en Avatar Battle:', err.message);
  }

  // Stairs Race: traduce gifts/chat en empujes del juego de escalera (overlay web).
  try {
    handleStairsRace(eventType, data);
  } catch (err) {
    console.warn('Error en Stairs Race:', err.message);
  }

  if (!alertConfig.enabled) return;

  if (eventType === 'gift' && alertConfig.minDiamonds > 0) {
    const diamonds = data.diamondCount || 0;
    if (diamonds < alertConfig.minDiamonds) return;
  }

  const alertEvent = createAlertEvent(eventType, data, alertConfig);
  eventQueue.push(alertEvent);
  emitAlert(alertEvent);

  if (alertConfig.tts && config.tts.enabled) {
    const ttsEvent = buildTTSEvent(eventType, data, config.tts);
    if (ttsEvent && ioRef) {
      ioRef.emit('tts', ttsEvent);
    }
  }
}

function buildTTSEvent(eventType, data, ttsConfig) {
  let text = '';

  switch (eventType) {
    case 'chat':
      if ((data.comment || '').startsWith('!')) return null;
      text = ttsConfig.readUsername
        ? `${data.uniqueId} dice: ${data.comment}`
        : data.comment;
      break;
    case 'gift':
      text = `${data.uniqueId} envió ${data.repeatCount || 1} ${data.giftName || 'regalo'}`;
      break;
    case 'follow':
      text = `${data.uniqueId} te está siguiendo`;
      break;
    case 'share':
      text = `${data.uniqueId} compartió el directo`;
      break;
    default:
      return null;
  }

  if (text.length > ttsConfig.maxLength) {
    text = `${text.substring(0, ttsConfig.maxLength)}...`;
  }

  return {
    id: `tts_${Date.now()}`,
    text,
    voice: ttsConfig.voice,
    rate: ttsConfig.rate,
    pitch: ttsConfig.pitch,
    volume: ttsConfig.volume,
    priority: eventType === 'gift' ? 1 : 0,
  };
}

export function emitPreviewAlert(eventType) {
  const config = getConfig();
  const alertConfig = config.alerts[eventType];

  if (!alertConfig) {
    throw new Error('Tipo de alerta no soportado');
  }

  const previewEvent = createAlertEvent(
    eventType,
    PREVIEW_EVENT_DATA[eventType] || { uniqueId: 'streamsync_preview' },
    {
      ...alertConfig,
      enabled: true,
      showOverlay: true,
    },
    { preview: true }
  );

  emitAlert(previewEvent);
  return previewEvent;
}

export function getEventQueue() {
  return [...eventQueue];
}

export function clearEventQueue() {
  eventQueue = [];
}

export function resetGoalProgress() {
  const config = getConfig();

  for (const goal of Object.values(config.goals || {})) {
    goal.current = 0;
  }

  emitGoalProgress(config.goals || {});
}

export function startSpotifyBroadcast() {
  setInterval(async () => {
    const status = getSpotifyStatus();
    if (status.isConnected) {
      await broadcastNowPlaying();
    }
  }, 5000);
}

setInterval(() => {
  const now = Date.now();

  for (const [userId, tracker] of spamTracker) {
    if (now - tracker.lastTime > SPAM_WINDOW * 2) {
      spamTracker.delete(userId);
    }
  }

  for (const [userId, time] of commandCooldown) {
    if (now - time > COMMAND_COOLDOWN * 2) {
      commandCooldown.delete(userId);
    }
  }
}, 30000);
