// controllers/tiktokController.js
import {
  TikTokLiveConnection,
  ControlEvent,
  WebcastEvent,
  refreshAvailableGifts,
  setConnection,
  disconnectConnection,
  getGiftMap
} from "../services/tiktokService.js";
import { processEvent, resetGoalProgress } from "../services/eventEngine.js";
import { trackEvent, startSession, endSession } from "../services/statsTracker.js";

// Reconnection settings
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;
const BASE_DELAY = 2000; // 2 seconds
let reconnectTimeout = null;
let lastUsername = null;
let lastIo = null;

function getReconnectDelay() {
  return Math.min(BASE_DELAY * Math.pow(2, reconnectAttempts), 30000); // Max 30s
}

async function attemptReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT) {
    console.log('🔴 Max reconnection attempts reached');
    if (lastIo) lastIo.emit('status', { status: 'error', message: 'Reconexión fallida después de varios intentos' });
    return;
  }

  reconnectAttempts++;
  const delay = getReconnectDelay();
  console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT})...`);

  if (lastIo) {
    lastIo.emit('status', {
      status: 'reconnecting',
      attempt: reconnectAttempts,
      maxAttempts: MAX_RECONNECT,
      nextRetryMs: delay,
    });
  }

  reconnectTimeout = setTimeout(async () => {
    if (lastUsername && lastIo) {
      await connectToTikTok(lastUsername, lastIo, true);
    }
  }, delay);
}

export async function connectToTikTok(username, io, isReconnect = false) {
  console.log(`🆕 Solicitando conexión a @${username}${isReconnect ? ' (reconexión)' : ''}`);

  // Clear any pending reconnection
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (!isReconnect) {
    disconnectConnection();
    reconnectAttempts = 0;
  }

  lastUsername = username;
  lastIo = io;

  try {
    const connection = new TikTokLiveConnection(username, {
      enableExtendedGiftInfo: true,
      processInitialData: true,
      fetchRoomInfoOnConnect: true,
    });

    setConnection(connection, username);

    // ====== ESTADO ======
    connection.on(ControlEvent.CONNECTED, async (state) => {
      console.log(`🔗 Conectado a @${username} | Room ID: ${state.roomId}`);
      reconnectAttempts = 0; // Reset on successful connect
      await refreshAvailableGifts();
      startSession(username);
      resetGoalProgress();
      io.emit("status", { status: "online", username, roomId: state.roomId });
    });

    connection.on(ControlEvent.DISCONNECTED, () => {
      console.warn("🔌 Desconectado de TikTok Live");
      endSession();
      resetGoalProgress();
      io.emit("status", { status: "offline", username });
      attemptReconnect();
    });

    connection.on(ControlEvent.STREAM_END, ({ action }) => {
      console.log("📴 El stream ha finalizado:", action);
      endSession();
      resetGoalProgress();
      io.emit("status", { status: "ended", username, action });
    });

    // ====== CHAT ======
    connection.on(WebcastEvent.CHAT, (data) => {
      const user = data.user?.uniqueId ?? "Usuario desconocido";
      const comment = (data.comment ?? "").replace(/\s+/g, " ").trim();
      const profilePic = data.user?.profilePictureUrl ?? null;

      const eventData = {
        uniqueId: user,
        comment,
        profilePic,
        isModerator: data.user?.isModerator || false,
        isSubscriber: data.user?.isSubscriber || false,
        badges: data.user?.badges || [],
      };

      console.log(`💬 [CHAT] ${user}: ${comment}`);
      io.emit("chat", eventData);
      trackEvent('chat', eventData);
      processEvent('chat', eventData);
    });

    // ====== LIKE ======
    connection.on(WebcastEvent.LIKE, (data) => {
      const user = data.user?.uniqueId ?? "Usuario desconocido";
      const eventData = {
        uniqueId: user,
        likeCount: data.likeCount,
        totalLikeCount: data.totalLikeCount,
      };

      console.log(`❤️ [LIKE] ${user} envió ${data.likeCount} likes`);
      io.emit("like", eventData);
      trackEvent('like', eventData);
      processEvent('like', eventData);
    });

    // ====== FOLLOW ======
    connection.on(WebcastEvent.FOLLOW, (data) => {
      const user = data.user?.uniqueId ?? "Usuario desconocido";
      const profilePic = data.user?.profilePictureUrl ?? null;
      const eventData = { uniqueId: user, profilePic };

      console.log(`➕ [FOLLOW] ${user} ahora sigue al streamer`);
      io.emit("follow", eventData);
      trackEvent('follow', eventData);
      processEvent('follow', eventData);
    });

    // ====== SHARE ======
    connection.on(WebcastEvent.SHARE, (data) => {
      const user = data.user?.uniqueId ?? "Usuario desconocido";
      const eventData = { uniqueId: user };

      console.log(`↪️ [SHARE] ${user} compartió el directo`);
      io.emit("share", eventData);
      trackEvent('share', eventData);
      processEvent('share', eventData);
    });

    // ====== GIFT ======
    connection.on(WebcastEvent.GIFT, async (data) => {
      try {
        const giftId = data.giftId ?? data.gift?.giftId ?? data.gift?.id ?? data.gift_key;
        const repeatCount = data.repeatCount ?? 1;
        const userId = data.user?.uniqueId ?? "Usuario desconocido";
        const profilePic = data.user?.profilePictureUrl ?? null;

        const giftMap = getGiftMap();
        let meta = data.extendedGiftInfo || data.gift || (giftId ? giftMap.get(String(giftId)) : null);

        if (!meta && giftId) {
          await refreshAvailableGifts();
          meta = giftMap.get(String(giftId));
        }

        const name = meta?.name ?? data.giftName ?? "Gift sin nombre";
        const cost = meta?.diamond_count ?? "N/D";
        const giftImage = meta?.image?.url_list?.[0] ?? null;

        const eventData = {
          uniqueId: userId,
          giftName: name,
          repeatCount,
          diamondCount: cost,
          giftImage,
          profilePic,
        };

        console.log(`🎁 [GIFT] ${userId} → ${repeatCount}× ${name} • ${cost}💎`);
        io.emit("gift", eventData);
        trackEvent('gift', eventData);
        processEvent('gift', eventData);
      } catch (err) {
        console.error("Error procesando GIFT:", err);
      }
    });

    // ====== MEMBER JOIN (new) ======
    connection.on(WebcastEvent.MEMBER, (data) => {
      const user = data.user?.uniqueId ?? "Usuario desconocido";
      const profilePic = data.user?.profilePictureUrl ?? null;
      const eventData = { uniqueId: user, profilePic, actionId: data.actionId };

      console.log(`👋 [JOIN] ${user} se unió al directo`);
      io.emit("memberJoin", eventData);
      trackEvent('memberJoin', eventData);
      processEvent('memberJoin', eventData);
    });

    // ====== ROOM USER (viewer count) ======
    connection.on(WebcastEvent.ROOM_USER, (data) => {
      const viewerCount = data.viewerCount ?? 0;
      console.log(`👁️ [VIEWERS] ${viewerCount} espectadores`);
      io.emit("roomUser", { viewerCount });
      trackEvent('roomUser', { viewerCount });
    });

    // Conecta
    await connection.connect();
  } catch (err) {
    console.error("❌ Error conectando al Live:", err);
    io.emit("status", { status: "error", message: err.message });

    // Try to reconnect on error
    if (!isReconnect || reconnectAttempts < MAX_RECONNECT) {
      attemptReconnect();
    }
  }
}

export function cancelReconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  reconnectAttempts = 0;
}
