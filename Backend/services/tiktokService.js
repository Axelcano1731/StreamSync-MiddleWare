// services/tiktokService.js
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

let connection = null;
let currentUsername = null;
let giftMap = new Map();

async function refreshAvailableGifts() {
  if (!connection) return;
  try {
    const gifts = await connection.fetchAvailableGifts();
    giftMap = new Map(gifts.map(g => [String(g.id ?? g.gift_id ?? g.key), g]));
    console.log(`🎁 Se cargaron ${gifts.length} gifts disponibles`);
  } catch (err) {
    console.warn('Error obteniendo la lista de gifts:', err?.message ?? err);
  }
}

function getConnection() {
  return connection;
}

function getGiftMap() {
  return giftMap;
}

function setConnection(newConnection, username) {
  connection = newConnection;
  currentUsername = username;
}

function disconnectConnection() {
  if (connection) {
    console.log(`❌ Cerrando conexión previa con @${currentUsername}`);
    connection.disconnect();
    connection = null;
    currentUsername = null;
  }
}

export {
  refreshAvailableGifts,
  getConnection,
  getGiftMap,
  setConnection,
  disconnectConnection,
  WebcastEvent,
  ControlEvent,
  TikTokLiveConnection
};
