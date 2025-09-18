import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import {
  TikTokLiveConnection,
  WebcastEvent,
  ControlEvent,
} from "tiktok-live-connector";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // URL de tu frontend (Vite)
    methods: ["GET", "POST"],
  },
});

const PORT = 3000;

let connection = null;
let currentUsername = null;
let giftMap = new Map();

// Función para refrescar gifts
async function refreshAvailableGifts() {
  if (!connection) return;
  try {
    const gifts = await connection.fetchAvailableGifts();
    giftMap = new Map(
      gifts.map((g) => [String(g.id ?? g.gift_id ?? g.key), g])
    );
    console.log(`🎁 Se cargaron ${gifts.length} gifts disponibles`);
  } catch (err) {
    console.warn("Error obteniendo la lista de gifts:", err?.message ?? err);
  }
}

// Manejo de cliente conectado al Socket.IO
io.on("connection", (socket) => {
  console.log("Cliente conectado al frontend:", socket.id);

  // Cuando el frontend envía el username
  socket.on("connectToTikTok", async (username) => {
    console.log(`🆕 Solicitando conexión a @${username}`);

    // Si ya hay una conexión activa, cerrarla antes de iniciar otra
    if (connection) {
      console.log(`❌ Cerrando conexión previa con @${currentUsername}`);
      connection.disconnect();
      connection = null;
      currentUsername = null;
    }

    try {
      // Crear nueva conexión
      currentUsername = username;
      connection = new TikTokLiveConnection(username, {
        enableExtendedGiftInfo: true,
        processInitialData: true,
        fetchRoomInfoOnConnect: true,
      });

      // Eventos de control
      connection.on(ControlEvent.CONNECTED, async (state) => {
        console.log(`🔗 Conectado a @${username} | Room ID: ${state.roomId}`);
        await refreshAvailableGifts();

        // Avisar al frontend que está online
        io.emit("status", { status: "online", username });
      });

      connection.on(ControlEvent.DISCONNECTED, () => {
        console.warn("🔌 Desconectado de TikTok Live");
        io.emit("status", { status: "offline", username });
      });

      connection.on(ControlEvent.STREAM_END, ({ action }) => {
        console.log("📴 El stream ha finalizado:", action);
        io.emit("status", { status: "offline", username });
      });

      // ======================
      // Eventos de TikTok
      // ======================

      // CHAT
      connection.on(WebcastEvent.CHAT, (data) => {
        const user = data.user?.uniqueId ?? "Usuario desconocido";
        const comment = (data.comment ?? "").replace(/\s+/g, " ").trim();

        console.log(`💬 [CHAT] ${user}: ${comment}`);
        io.emit("chat", { uniqueId: user, comment });
      });

      // LIKE
      connection.on(WebcastEvent.LIKE, (data) => {
        const user = data.user?.uniqueId ?? "Usuario desconocido";
        console.log(`❤️ [LIKE] ${user} envió ${data.likeCount} likes`);

        io.emit("like", {
          uniqueId: user,
          likeCount: data.likeCount,
          totalLikeCount: data.totalLikeCount,
        });
      });

      // FOLLOW
      connection.on(WebcastEvent.FOLLOW, (data) => {
        const user = data.user?.uniqueId ?? "Usuario desconocido";
        console.log(`➕[FOLLOW] ${user} ahora sigue al streamer`);
        io.emit("follow", { uniqueId: user });
      });
      // SHARE
      connection.on(WebcastEvent.SHARE, (data) => {
        const user = data.user?.uniqueId ?? "Usuario desconocido";
        console.log(`[SHARE] ${user} ha compartido el stream`);
        io.emit("share", { uniqueId: user });
      });

      // GIFT
      connection.on(WebcastEvent.GIFT, async (data) => {
        try {
          const giftId =
            data.giftId ??
            data.gift?.giftId ??
            data.gift?.id ??
            data.gift_key ??
            null;
          const repeatCount = data.repeatCount ?? 1;
          const userId = data.user?.uniqueId ?? "Usuario desconocido";

          const ext = data.extendedGiftInfo ?? data.gift ?? null;

          let meta = ext || (giftId ? giftMap.get(String(giftId)) : null);
          if (!meta && giftId) {
            await refreshAvailableGifts();
            meta = giftMap.get(String(giftId));
          }

          const name = meta?.name ?? data.giftName ?? "Gift sin nombre";
          const cost = meta?.diamond_count ?? "N/D";

          console.log(
            `🎁 [GIFT] ${userId} → ${repeatCount}× ${name} • ${cost}💎`
          );

          io.emit("gift", {
            uniqueId: userId,
            giftName: name,
            repeatCount,
            diamondCount: cost,
          });
        } catch (err) {
          console.error("Error procesando GIFT:", err);
        }
      });

      // Intentar conectar
      await connection.connect();
    } catch (err) {
      console.error("❌ Error conectando al Live:", err);
      io.emit("status", { status: "error", message: err.message });
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en http://localhost:${PORT}`);
});
