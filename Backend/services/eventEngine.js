// services/eventEngine.js
import { getConfig } from '../config/alertConfig.js';
import { searchAndPlay, skipTrack, getCurrentTrack, getSpotifyStatus } from './spotifyService.js';

/**
 * Event Engine — Processes stream events through configurable rules
 * Trigger → Condition → Action pipeline
 * Now includes chat command processing for Spotify and other integrations
 */

// Event queue to prevent alert overlap
let eventQueue = [];
let isProcessing = false;
let ioRef = null;

// Anti-spam tracking
const spamTracker = new Map(); // userId -> { count, lastTime }
const SPAM_WINDOW = 5000;      // 5 seconds
const SPAM_THRESHOLD = 10;     // Max events per window

// Chat command cooldown
const commandCooldown = new Map();
const COMMAND_COOLDOWN = 3000; // 3 seconds between commands per user

/**
 * Initialize the engine with Socket.IO reference
 */
export function initEngine(io) {
  ioRef = io;
}

/**
 * Check if a message contains blocked words
 */
function containsBlockedWords(text, blockedWords = []) {
  if (!text || blockedWords.length === 0) return false;
  const lower = text.toLowerCase();
  return blockedWords.some(word => lower.includes(word.toLowerCase()));
}

/**
 * Check if user is spamming
 */
function isSpamming(userId) {
  const now = Date.now();
  const tracker = spamTracker.get(userId);

  if (!tracker || (now - tracker.lastTime) > SPAM_WINDOW) {
    spamTracker.set(userId, { count: 1, lastTime: now });
    return false;
  }

  tracker.count++;
  tracker.lastTime = now;

  if (tracker.count > SPAM_THRESHOLD) {
    return true;
  }

  return false;
}

/**
 * Check command cooldown
 */
function isOnCooldown(userId) {
  const last = commandCooldown.get(userId);
  if (!last || Date.now() - last > COMMAND_COOLDOWN) {
    commandCooldown.set(userId, Date.now());
    return false;
  }
  return true;
}

/**
 * Process chat commands (!play, !song, !skip, !queue, etc.)
 */
async function processChatCommand(data) {
  const comment = (data.comment || '').trim();
  if (!comment.startsWith('!')) return false;

  const userId = data.uniqueId || 'unknown';
  const parts = comment.split(' ');
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  // Cooldown check
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
        emitChatResponse(`@${userId} ⚠️ Spotify no está conectado`);
        return true;
      }

      try {
        const track = await searchAndPlay(args);
        if (track) {
          emitChatResponse(`🎵 @${userId} puso: ${track.name} — ${track.artist}`);
          broadcastNowPlaying();
        } else {
          emitChatResponse(`@${userId} ❌ No se encontró: ${args}`);
        }
      } catch (err) {
        emitChatResponse(`@${userId} ❌ Error al reproducir`);
      }
      return true;
    }

    case '!song':
    case '!cancion':
    case '!np': {
      const status = getSpotifyStatus();
      if (!status.isConnected) {
        emitChatResponse(`@${userId} ⚠️ Spotify no está conectado`);
        return true;
      }

      const current = await getCurrentTrack();
      if (current && current.isPlaying) {
        emitChatResponse(`🎵 Ahora suena: ${current.name} — ${current.artist}`);
      } else {
        emitChatResponse(`🎵 No hay música reproduciéndose`);
      }
      return true;
    }

    case '!skip':
    case '!saltar': {
      const status = getSpotifyStatus();
      if (!status.isConnected) {
        emitChatResponse(`@${userId} ⚠️ Spotify no está conectado`);
        return true;
      }

      const next = await skipTrack();
      if (next) {
        emitChatResponse(`⏭️ @${userId} saltó la canción → ${next.name || 'siguiente'}`);
        broadcastNowPlaying();
      }
      return true;
    }

    default:
      return false; // Not a recognized command
  }
}

/**
 * Emit a response message to chat
 */
function emitChatResponse(message) {
  if (ioRef) {
    ioRef.emit('chatResponse', { message, timestamp: Date.now() });
  }
}

/**
 * Broadcast current track to Now Playing overlay widget
 */
async function broadcastNowPlaying() {
  if (!ioRef) return;
  try {
    const track = await getCurrentTrack();
    ioRef.emit('nowPlaying', track || { isPlaying: false });
    ioRef.of('/overlay').emit('nowPlaying', track || { isPlaying: false });
  } catch (err) {
    // Ignore
  }
}

/**
 * Process an incoming event through the rules engine
 * @param {string} eventType - like, chat, follow, share, gift, memberJoin
 * @param {object} data - Event data from TikTok
 */
export function processEvent(eventType, data) {
  const config = getConfig();
  const alertConfig = config.alerts[eventType];

  if (!alertConfig || !alertConfig.enabled) return;

  const userId = data.uniqueId || data.user?.uniqueId || 'unknown';

  // Process chat commands first (before filtering)
  if (eventType === 'chat') {
    processChatCommand(data).catch(() => {});
  }

  // Anti-spam filter
  if (config.tts.filterSpam && isSpamming(userId)) {
    console.log(`🚫 Spam filtered: ${userId}`);
    return;
  }

  // Blocked words filter for chat
  if (eventType === 'chat' && containsBlockedWords(data.comment, config.tts.blockedWords)) {
    console.log(`🚫 Blocked word detected from ${userId}`);
    return;
  }

  // Minimum diamonds filter for gifts
  if (eventType === 'gift' && alertConfig.minDiamonds > 0) {
    const diamonds = data.diamondCount || 0;
    if (diamonds < alertConfig.minDiamonds) return;
  }

  // Build the alert event
  const alertEvent = {
    id: `${eventType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: eventType,
    timestamp: Date.now(),
    user: userId,
    data: data,
    config: {
      sound: alertConfig.sound,
      volume: alertConfig.volume,
      duration: alertConfig.duration,
      animation: alertConfig.animation,
      showOverlay: alertConfig.showOverlay,
      tts: alertConfig.tts,
    },
  };

  // Add to queue
  eventQueue.push(alertEvent);

  // Emit to dashboard
  if (ioRef) {
    ioRef.emit('alert', alertEvent);
  }

  // Emit to overlay namespace
  if (ioRef) {
    ioRef.of('/overlay').emit('alert', alertEvent);
  }

  // Process TTS if enabled
  if (alertConfig.tts && config.tts.enabled) {
    const ttsEvent = buildTTSEvent(eventType, data, config.tts);
    if (ttsEvent) {
      if (ioRef) {
        ioRef.emit('tts', ttsEvent);
      }
    }
  }
}

/**
 * Build a TTS event from stream data
 */
function buildTTSEvent(eventType, data, ttsConfig) {
  let text = '';

  switch (eventType) {
    case 'chat':
      // Don't TTS commands
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

  // Truncate if too long
  if (text.length > ttsConfig.maxLength) {
    text = text.substring(0, ttsConfig.maxLength) + '...';
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

/**
 * Get pending events in the queue
 */
export function getEventQueue() {
  return [...eventQueue];
}

/**
 * Clear the event queue
 */
export function clearEventQueue() {
  eventQueue = [];
}

/**
 * Start periodic Spotify now-playing broadcast
 */
export function startSpotifyBroadcast() {
  setInterval(async () => {
    const status = getSpotifyStatus();
    if (status.isConnected) {
      await broadcastNowPlaying();
    }
  }, 5000);
}

/**
 * Clean up spam tracker periodically
 */
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
