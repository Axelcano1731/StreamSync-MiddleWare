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

// Profile picture cache — persists across events so chat can use pics from gift/follow/member
const profilePicCache = new Map();

function findAvatarUrl(user) {
  if (!user) return null;
  const directFields = [
    'profilePictureUrl', 'avatarMedium', 'avatarLarger', 'avatarThumb',
    'avatarUrl', 'avatar', 'profilePicture', 'cover'
  ];
  for (const f of directFields) {
    const val = user[f];
    if (typeof val === 'string' && val.startsWith('http')) return val;
    if (val && typeof val === 'object') {
      if (Array.isArray(val.urlList) && val.urlList[0]) return val.urlList[0];
      if (Array.isArray(val.url_list) && val.url_list[0]) return val.url_list[0];
      if (typeof val.url === 'string' && val.url.startsWith('http')) return val.url;
      if (Array.isArray(val) && typeof val[0] === 'string' && val[0].startsWith('http')) return val[0];
    }
  }
  // Scan ALL user properties for any avatar-like URL
  for (const [key, val] of Object.entries(user)) {
    if (key.toLowerCase().includes('avatar') || key.toLowerCase().includes('pic') || key.toLowerCase().includes('photo')) {
      if (typeof val === 'string' && val.startsWith('http')) return val;
      if (val && typeof val === 'object') {
        if (Array.isArray(val.urlList) && val.urlList[0]) return val.urlList[0];
        if (Array.isArray(val.url_list) && val.url_list[0]) return val.url_list[0];
        if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
      }
    }
  }
  return null;
}

function cacheAndGetPic(user) {
  if (!user) return null;
  const userId = user.uniqueId;
  const pic = findAvatarUrl(user);
  if (pic && userId) {
    profilePicCache.set(userId, pic);
    return pic;
  }
  // Return cached if we have one
  return userId ? (profilePicCache.get(userId) || null) : null;
}

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
      const profilePic = cacheAndGetPic(data.user);

      const badges = data.user?.badges || data.user?.badgeList || data.badges || [];

      const eventData = {
        uniqueId: user,
        comment,
        profilePic,
        isModerator: data.user?.isModerator || data.isModerator || false,
        isSubscriber: data.user?.isSubscriber || data.isSubscriber || false,
        badges,
        topFanLevel: data.user?.topFanLevel ?? data.topFanLevel ?? 0,
        followRole: data.user?.followRole ?? data.followRole ?? 0,
        teamMemberLevel: data.user?.teamMemberLevel ?? 0,
        isFollower: data.user?.isFollower ?? false,
        fansClub: data.user?.fansClub ?? null,
      };

      console.log(`💬 [CHAT] ${user}: ${comment} | pic=${profilePic ? 'YES' : 'NULL(cache:' + profilePicCache.size + ')'}`);
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
      const profilePic = cacheAndGetPic(data.user);
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
        const profilePic = cacheAndGetPic(data.user);

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
      const profilePic = cacheAndGetPic(data.user);
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
