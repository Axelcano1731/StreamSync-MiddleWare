import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

const tiktokUsername = 'cesarbome';

const connection = new TikTokLiveConnection(tiktokUsername, {
  enableExtendedGiftInfo: true,
  processInitialData: true,
  fetchRoomInfoOnConnect: true
});

// Toggle para debug verboso
const VERBOSE = false;

let giftMap = new Map();

async function refreshAvailableGifts() {
  try {
    const gifts = await connection.fetchAvailableGifts();
    giftMap = new Map(gifts.map(g => [String(g.id ?? g.gift_id ?? g.key), g]));
    logInfo(`🎁 Se cargaron ${gifts.length} gifts disponibles`);
  } catch (err) {
    logWarn('Error obteniendo la lista de gifts:', err?.message ?? err);
  }
}

// Helpers de logging SIN hora
function logInfo(...args) {
  console.log('ℹ️', ...args);
}
function logWarn(...args) {
  console.warn('⚠️', ...args);
}
function logError(...args) {
  console.error('❌', ...args);
}

// Formatea la info del gift
function formatGiftDisplay({ userId, giftId, name, repeatCount, cost }) {
  return `${userId} → ${repeatCount}× ${name} (ID:${giftId}) • ${cost}💎`;
}

// Eventos de control
connection.on(ControlEvent.CONNECTED, async (state) => {
  logInfo(`🔗 Conectado a @${tiktokUsername} | Room ID: ${state.roomId}`);
  await refreshAvailableGifts();
});

connection.on(ControlEvent.DISCONNECTED, () => logWarn('🔌 Desconectado de TikTok Live'));
connection.on(ControlEvent.STREAM_END, ({ action }) => logInfo('📴 El stream ha finalizado:', action));

// Eventos básicos
connection.on(WebcastEvent.CHAT, data => {
  const user = data.user?.uniqueId ?? 'Usuario desconocido';
  const comment = (data.comment ?? '').replace(/\s+/g, ' ').trim();
  console.log(`💬 [CHAT] ${user}: ${comment}`);
});

connection.on(WebcastEvent.LIKE, data => {
  const user = data.user?.uniqueId ?? 'Usuario desconocido';
  console.log(`❤️ [LIKE] ${user} envió ${data.likeCount} likes (Total: ${data.totalLikeCount ?? 'N/D'})`);
});

connection.on(WebcastEvent.FOLLOW, data => {
  const user = data.user?.uniqueId ?? 'Usuario desconocido';
  console.log(`➕ [FOLLOW] ${user} ahora sigue al streamer`);
});

// Evento GIFT — limpio
connection.on(WebcastEvent.GIFT, async (data) => {
  try {
    if (VERBOSE) {
      console.log('🔍 [RAW GIFT]', JSON.stringify(data, null, 2));
    }

    const giftId = data.giftId ?? data.gift?.giftId ?? data.gift?.id ?? data.gift_key ?? null;
    const repeatCount = data.repeatCount ?? data.repeat_count ?? 1;
    const userId = data.user?.uniqueId ?? data.uid ?? 'Usuario desconocido';

    const ext = data.extendedGiftInfo ?? data.gift ?? data.giftInfo ?? null;

    let meta = null;
    if (ext && (ext.name || ext.image || ext.giftPictureUrl || ext.diamond_count)) {
      meta = ext;
    } else if (giftId != null) {
      meta = giftMap.get(String(giftId));
    }

    if (!meta && giftId != null) {
      logInfo(`🔄 Metadata no encontrada para ID=${giftId}, actualizando lista de gifts...`);
      await refreshAvailableGifts();
      meta = giftMap.get(String(giftId));
    }

    const name = ext?.name ?? meta?.name ?? data.giftName ?? 'Gift sin nombre';
    const cost = ext?.diamond_count ?? meta?.diamond_count ?? meta?.cost ?? 'N/D';

    logInfo(`🎁 [GIFT] ${formatGiftDisplay({ userId, giftId, name, repeatCount, cost })}`);
  } catch (err) {
    logError('Error procesando GIFT:', err);
  }
});

// Conectar
connection.connect()
  .then(state => logInfo('✅ Conexión establecida', state.roomInfo ? '| RoomInfo disponible' : '| RoomInfo no disponible'))
  .catch(err => logError('Error conectando al Live:', err));
