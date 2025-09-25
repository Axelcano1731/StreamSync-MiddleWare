// controllers/tiktokController.js
import {
  TikTokLiveConnection,
  ControlEvent,
  WebcastEvent,
  refreshAvailableGifts,
  setConnection,
  disconnectConnection,
  getGiftMap
} from '../services/tiktokService.js';

export async function connectToTikTok(username, io) {
  console.log(`🆕 Solicitando conexión a @${username}`);

  // Cierra cualquier conexión previa
  disconnectConnection();

  try {
    // Crear nueva conexión
    const connection = new TikTokLiveConnection(username, {
      enableExtendedGiftInfo: true,
      processInitialData: true,
      fetchRoomInfoOnConnect: true
    });

    setConnection(connection, username);

    // ======================
    // Eventos de control
    // ======================
    connection.on(ControlEvent.CONNECTED, async (state) => {
      console.log(`🔗 Conectado a @${username} | Room ID: ${state.roomId}`);
      await refreshAvailableGifts();
      io.emit('status', { status: 'online', username });
    });

    connection.on(ControlEvent.DISCONNECTED, () => {
      console.warn('🔌 Desconectado de TikTok Live');
      io.emit('status', { status: 'offline', username });
    });

    connection.on(ControlEvent.STREAM_END, ({ action }) => {
      console.log('📴 El stream ha finalizado:', action);
      io.emit('status', { status: 'offline', username });
    });

    // ======================
    // Eventos de TikTok
    // ======================

    connection.on(WebcastEvent.CHAT, data => {
      const user = data.user?.uniqueId ?? 'Usuario desconocido';
      const comment = (data.comment ?? '').replace(/\s+/g, ' ').trim();

      console.log(`💬 [CHAT] ${user}: ${comment}`);
      io.emit('chat', { uniqueId: user, comment });
    });

    connection.on(WebcastEvent.LIKE, data => {
      const user = data.user?.uniqueId ?? 'Usuario desconocido';
      console.log(`❤️ [LIKE] ${user} envió ${data.likeCount} likes`);
      io.emit('like', {
        uniqueId: user,
        likeCount: data.likeCount,
        totalLikeCount: data.totalLikeCount
      });
    });

    connection.on(WebcastEvent.FOLLOW, data => {
      const user = data.user?.uniqueId ?? 'Usuario desconocido';
      console.log(`➕ [FOLLOW] ${user} ahora sigue al streamer`);
      io.emit('follow', { uniqueId: user });
    });

    connection.on(WebcastEvent.GIFT, async (data) => {
      try {
        const giftId = data.giftId ?? data.gift?.giftId ?? data.gift?.id ?? data.gift_key ?? null;
        const repeatCount = data.repeatCount ?? 1;
        const userId = data.user?.uniqueId ?? 'Usuario desconocido';

        const giftMap = getGiftMap();
        let meta = data.extendedGiftInfo || data.gift || (giftId ? giftMap.get(String(giftId)) : null);

        if (!meta && giftId) {
          await refreshAvailableGifts();
          meta = giftMap.get(String(giftId));
        }

        const name = meta?.name ?? data.giftName ?? 'Gift sin nombre';
        const cost = meta?.diamond_count ?? 'N/D';

        console.log(`🎁 [GIFT] ${userId} → ${repeatCount}× ${name} • ${cost}💎`);
        io.emit('gift', {
          uniqueId: userId,
          giftName: name,
          repeatCount,
          diamondCount: cost
        });

      } catch (err) {
        console.error('Error procesando GIFT:', err);
      }
    });

    await connection.connect();

  } catch (err) {
    console.error('❌ Error conectando al Live:', err);
    io.emit('status', { status: 'error', message: err.message });
  }
}
