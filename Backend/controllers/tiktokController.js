// controllers/tiktokController.js
import {
  TikTokLiveConnection,
  ControlEvent,
  WebcastEvent,
  refreshAvailableGifts,
  setConnection,
  disconnectConnection,
  getConnection,
  getGiftMap
} from "../services/tiktokService.js";
import { processEvent, resetGoalProgress } from "../services/eventEngine.js";
import { trackEvent, startSession, endSession } from "../services/statsTracker.js";
import { getStickerSoundForGift } from "../services/stickerSoundService.js";

// Profile picture cache — persists across events so chat can use pics from gift/follow/member
const profilePicCache = new Map();

// Dedupe CHAT.emotes ↔ evento EMOTE. TikTok normalmente manda los stickers
// embebidos en el CHAT (data.emotes), pero algunas versiones también disparan
// el evento EMOTE para el mismo sticker. Registramos cada emote ya emitido y
// dejamos que el CHAT sea la fuente principal; EMOTE solo actúa como respaldo
// cuando el CHAT no trajo el sticker.
const emoteDedupe = new Map(); // `${user}|${key}` -> timestamp
const EMOTE_DEDUPE_TTL = 4000;

function markEmoteEmitted(user, key) {
  const now = Date.now();
  emoteDedupe.set(`${user}|${key}`, now);
  if (emoteDedupe.size > 500) {
    for (const [k, ts] of emoteDedupe) {
      if (now - ts > EMOTE_DEDUPE_TTL) emoteDedupe.delete(k);
    }
  }
}

function wasEmoteRecentlyEmitted(user, key) {
  const ts = emoteDedupe.get(`${user}|${key}`);
  return ts != null && Date.now() - ts < EMOTE_DEDUPE_TTL;
}

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

    // ¿Esta conexión sigue siendo la ACTIVA? Si el dashboard (o una reconexión)
    // creó otra conexión después, ésta quedó obsoleta. Una conexión obsoleta NO
    // debe emitir eventos (causaba TTS/alertas DOBLES) ni disparar reconexiones.
    const isStale = () => getConnection() !== connection;

    // ====== ESTADO ======
    connection.on(ControlEvent.CONNECTED, async (state) => {
      // Zombi: si mientras conectaba se creó otra conexión, ciérrala y sal.
      if (isStale()) {
        console.warn(`♻️ Conexión duplicada a @${username} descartada (había otra activa)`);
        try { connection.disconnect(); } catch { /* noop */ }
        return;
      }
      console.log(`🔗 Conectado a @${username} | Room ID: ${state.roomId}`);
      reconnectAttempts = 0; // Reset on successful connect
      await refreshAvailableGifts();
      startSession(username);
      resetGoalProgress();
      io.emit("status", { status: "online", username, roomId: state.roomId });
    });

    connection.on(ControlEvent.DISCONNECTED, () => {
      // Si esta conexión ya fue reemplazada, ignora su desconexión: ni emitas
      // "offline" ni programes reconexión (evita conexiones fantasma).
      if (isStale()) return;
      console.warn("🔌 Desconectado de TikTok Live");
      endSession();
      resetGoalProgress();
      io.emit("status", { status: "offline", username });
      attemptReconnect();
    });

    connection.on(ControlEvent.STREAM_END, ({ action }) => {
      if (isStale()) return;
      console.log("📴 El stream ha finalizado:", action);
      endSession();
      resetGoalProgress();
      io.emit("status", { status: "ended", username, action });
    });

    // ====== CHAT ======
    connection.on(WebcastEvent.CHAT, (data) => {
      if (isStale()) return;
      const user = data.user?.uniqueId ?? "Usuario desconocido";
      const comment = (data.comment ?? "").replace(/\s+/g, " ").trim();
      const profilePic = cacheAndGetPic(data.user);

      const badges = data.user?.badges || data.user?.badgeList || data.badges || [];

      // Stickers de chat: TikTok los envía EMBEBIDOS dentro del mensaje de chat
      // (data.emotes[].emote), no en el evento EMOTE. Cada uno tiene emoteId + imageUrl.
      const stickers = Array.isArray(data.emotes)
        ? data.emotes
            .map((e) => ({
              emoteId: e?.emote?.emoteId ? String(e.emote.emoteId) : null,
              emoteImage:
                e?.emote?.image?.imageUrl ??
                e?.emote?.image?.url_list?.[0] ??
                e?.emote?.image?.mUrls?.[0] ??
                null,
            }))
            .filter((s) => s.emoteId || s.emoteImage)
        : [];

      // Identidad del usuario respecto al streamer. OJO: en tiktok-live-connector
      // v2 NO viene en data.user (isModerator/isSubscriber ya no existen ahí),
      // sino en data.userIdentity.*OfAnchor. Dejamos fallbacks por si cambia el
      // shape en el futuro.
      const identity = data.userIdentity || {};
      const fansClubLevel =
        Number(data.user?.fansClub?.data?.level) ||
        Number(data.user?.fansClubInfo?.fansLevel) ||
        0;
      const isMod = identity.isModeratorOfAnchor ?? data.user?.isModerator ?? false;
      const isSub =
        identity.isSubscriberOfAnchor ??
        data.user?.subscribeInfo?.isSubscribedToAnchor ??
        data.user?.isSubscribe ??
        false;
      const isFollowerOf = identity.isFollowerOfAnchor ?? data.user?.isFollower ?? false;

      const eventData = {
        uniqueId: user,
        comment,
        profilePic,
        stickers,
        isModerator: isMod,
        isSubscriber: isSub,
        badges,
        // topFanLevel = nivel del Club de Fans ("quiéreme"); 0 si no es miembro.
        topFanLevel: fansClubLevel,
        followRole: identity.isMutualFollowingWithAnchor ? 2 : isFollowerOf ? 1 : 0,
        teamMemberLevel: data.user?.teamMemberLevel ?? 0,
        isFollower: isFollowerOf,
        fansClub: data.user?.fansClub ?? null,
      };

      const idTag = `${isMod ? ' 🛡️MOD' : ''}${isSub ? ' ⭐SUB' : ''}${fansClubLevel ? ' 💖FAN' + fansClubLevel : ''}${isFollowerOf ? ' ➕FOLL' : ''}`;
      const stickerTag = stickers.length ? ` [+${stickers.length} sticker]` : '';
      console.log(`💬 [CHAT] ${user}:${idTag} ${comment}${stickerTag} | pic=${profilePic ? 'YES' : 'NULL(cache:' + profilePicCache.size + ')'}`);
      io.emit("chat", eventData);
      trackEvent('chat', eventData);
      processEvent('chat', eventData);

      // Anti-spam: un mensaje puede traer muchas copias del mismo sticker.
      // Disparamos el panel y el sonido SOLO una vez por sticker distinto por mensaje.
      const seenStickers = new Set();
      for (const st of stickers) {
        const key = st.emoteId || st.emoteImage;
        if (seenStickers.has(key)) continue;
        seenStickers.add(key);

        io.emit("emote", {
          uniqueId: user,
          emoteId: key,
          emoteImage: st.emoteImage,
          profilePic,
        });

        const stickerSound = getStickerSoundForGift(key);
        if (stickerSound && stickerSound.enabled !== false) {
          io.emit("stickerSound", {
            giftName: key,
            soundData: stickerSound.soundData,
            volume: stickerSound.volume,
            cooldownSec: stickerSound.cooldownSec ?? null,
            uniqueId: user,
            profilePic,
          });
        }

        // El CHAT es la fuente principal: marca el sticker para que el evento
        // EMOTE no lo vuelva a disparar si llega justo después.
        markEmoteEmitted(user, key);
      }
    });

    // ====== LIKE ======
    connection.on(WebcastEvent.LIKE, (data) => {
      if (isStale()) return;
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
      if (isStale()) return;
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
      if (isStale()) return;
      const user = data.user?.uniqueId ?? "Usuario desconocido";
      const eventData = { uniqueId: user };

      console.log(`↪️ [SHARE] ${user} compartió el directo`);
      io.emit("share", eventData);
      trackEvent('share', eventData);
      processEvent('share', eventData);
    });

    // ====== SUBSCRIBE (suscriptores) ======
    if (WebcastEvent.SUBSCRIBE) {
      connection.on(WebcastEvent.SUBSCRIBE, (data) => {
        if (isStale()) return;
        const user = data.user?.uniqueId ?? "Usuario desconocido";
        const profilePic = cacheAndGetPic(data.user);
        const eventData = { uniqueId: user, profilePic };

        console.log(`⭐ [SUBSCRIBE] ${user} se suscribió`);
        io.emit("subscribe", eventData);
        trackEvent('subscribe', eventData);
        processEvent('subscribe', eventData);
      });
    }

    // ====== GIFT ======
    connection.on(WebcastEvent.GIFT, async (data) => {
      try {
        if (isStale()) return;
        // Combo de regalos "streakable": TikTok manda un evento por cada
        // repeticion mientras dura el combo. Ignoramos los frames intermedios y
        // procesamos solo el final (repeatEnd truthy), cuyo repeatCount ya trae el
        // TOTAL. Asi la alerta, el sonido, la voz, las stats y los comandos ocurren
        // UNA sola vez por combo.
        //
        // OJO (v2): el indicador FIABLE de combo es data.giftDetails.combo (bool),
        // NO data.giftType (no existe) ni data.giftDetails.giftType (esa es la
        // CATEGORIA del regalo: Rose=1, Heart Me=4...). Ademas todos los frames de
        // un combo comparten un groupId real (!= "0"); los regalos simples traen
        // groupId "0". Verificado en vivo con volcado de datos.
        const groupId = data.groupId != null ? String(data.groupId) : null;
        const isStreak =
          data.giftDetails?.combo === true || (groupId != null && groupId !== '0');

        if (isStreak && data.repeatEnd != null && !data.repeatEnd) {
          return;
        }

        // Categoria del regalo (se conserva por compatibilidad aguas abajo).
        const giftType = data.giftDetails?.giftType ?? null;

        const giftId = data.giftId ?? data.gift?.giftId ?? data.gift?.id ?? data.gift_key;
        const repeatCount = data.repeatCount ?? 1;
        const userId = data.user?.uniqueId ?? "Usuario desconocido";
        const profilePic = cacheAndGetPic(data.user);

        const giftMap = getGiftMap();
        // Preferimos el catálogo (fetchAvailableGifts) por diamantes fiables; si no,
        // usamos giftDetails que viene embebido en el propio mensaje (campos con
        // otro naming: giftName/diamondCount/giftImage).
        let meta = (giftId ? giftMap.get(String(giftId)) : null) || data.giftDetails || data.extendedGiftInfo || data.gift || null;

        if (!meta && giftId) {
          await refreshAvailableGifts();
          meta = giftMap.get(String(giftId));
        }

        const name = meta?.name ?? meta?.giftName ?? data.giftName ?? "Gift sin nombre";
        const cost = Number(meta?.diamond_count ?? meta?.diamondCount ?? 0) || 0;
        const giftImage =
          meta?.image?.url_list?.[0] ?? meta?.giftImage?.url_list?.[0] ?? null;

        const eventData = {
          uniqueId: userId,
          giftName: name,
          repeatCount,
          diamondCount: cost,
          giftImage,
          profilePic,
          // Campos de streak + IDs únicos para deduplicar combos y entregas
          // repetidas aguas abajo (Avatar Battle, VS Battle).
          giftId: giftId ?? null,
          giftType,
          isStreak,
          repeatEnd: data.repeatEnd ?? null,
          groupId,
          msgId: data.common?.msgId ?? null,
        };

        console.log(`🎁 [GIFT] ${userId} → ${repeatCount}× ${name} • ${cost}💎 ${isStreak ? '[combo' : '[single'} grp=${groupId} msg=${String(eventData.msgId ?? '').slice(-6)}]`);
        io.emit("gift", eventData);
        trackEvent('gift', eventData);
        processEvent('gift', eventData);

        // Emit sticker sound if configured
        const stickerSound = getStickerSoundForGift(name);
        if (stickerSound && stickerSound.enabled !== false) {
          io.emit("stickerSound", {
            giftName: name,
            soundData: stickerSound.soundData,
            volume: stickerSound.volume,
            cooldownSec: stickerSound.cooldownSec ?? null,
            uniqueId: userId,
            profilePic,
          });
        }
      } catch (err) {
        console.error("Error procesando GIFT:", err);
      }
    });

    // ====== EMOTE (stickers de chat / suscripción) ======
    connection.on(WebcastEvent.EMOTE, (data) => {
      try {
        if (isStale()) return;
        const userId = data.user?.uniqueId ?? "Usuario desconocido";
        const profilePic = cacheAndGetPic(data.user);

        // Algunas versiones entregan emoteList[], otras un único emote
        const emotes = data.emoteList ?? (data.emote ? [data.emote] : []);

        for (const emote of emotes) {
          const emoteId = emote?.emoteId ?? emote?.id ?? emote?.uuid ?? null;
          const img = emote?.image ?? emote?.emoteImage ?? null;
          const emoteImage =
            img?.url_list?.[0] ?? img?.urlList?.[0] ?? img?.url ?? null;

          if (!emoteId && !emoteImage) continue;

          const key = emoteId ? String(emoteId) : emoteImage;

          // Respaldo: si el CHAT ya emitió este sticker hace un instante, no lo
          // dupliques (evita contar doble en la galería y sonar dos veces).
          if (wasEmoteRecentlyEmitted(userId, key)) continue;

          const eventData = {
            uniqueId: userId,
            emoteId: key,
            emoteImage,
            profilePic,
          };

          console.log(`🎟️ [EMOTE] ${userId} → sticker ${eventData.emoteId?.slice(0, 12)}…`);
          io.emit("emote", eventData);
          trackEvent('emote', eventData);
          processEvent('emote', eventData);

          // Reproducir sonido si este sticker tiene uno asignado (key = emoteId)
          const stickerSound = getStickerSoundForGift(eventData.emoteId);
          if (stickerSound && stickerSound.enabled !== false) {
            io.emit("stickerSound", {
              giftName: eventData.emoteId,
              soundData: stickerSound.soundData,
              volume: stickerSound.volume,
              cooldownSec: stickerSound.cooldownSec ?? null,
              uniqueId: userId,
              profilePic,
            });
          }

          markEmoteEmitted(userId, key);
        }
      } catch (err) {
        console.error("Error procesando EMOTE:", err);
      }
    });

    // ====== MEMBER JOIN (new) ======
    connection.on(WebcastEvent.MEMBER, (data) => {
      if (isStale()) return;
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
      if (isStale()) return;
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
