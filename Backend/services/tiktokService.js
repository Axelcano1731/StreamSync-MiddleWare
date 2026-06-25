import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

let connection = null; // Guarda la conexión actual a TikTok
let currentUsername = null; // Guarda el usuario actual conectado
let giftMap = new Map(); // Mapa de gifts disponibles para acceder a sus datos

// ======================
// Refrescar lista de gifts disponibles
// ======================
async function refreshAvailableGifts() {
  if (!connection) return;
  try {
    const gifts = await connection.fetchAvailableGifts();
    // Convierte el array de gifts en un mapa para acceder rápido por ID
    giftMap = new Map(gifts.map(g => [String(g.id ?? g.gift_id ?? g.key), g]));
    console.log(`🎁 Se cargaron ${gifts.length} gifts disponibles`);
  } catch (err) {
    console.warn('Error obteniendo la lista de gifts:', err?.message ?? err);
  }
}

// ======================
// Funciones de gestión de la conexión
// ======================
function getConnection() {
  return connection; // Devuelve la conexión actual
}

function getGiftMap() {
  return giftMap; // Devuelve el mapa con la información de gifts
}

// Devuelve la lista de gifts disponibles normalizada para el frontend:
// { id, name, image, diamondCount }. Ordenada por costo de diamantes.
function getAvailableGiftsList() {
  const list = [];
  for (const g of giftMap.values()) {
    const name = g?.name ?? null;
    if (!name) continue;
    list.push({
      id: String(g?.id ?? g?.gift_id ?? g?.key ?? name),
      name,
      image: g?.image?.url_list?.[0] ?? g?.icon?.url_list?.[0] ?? null,
      diamondCount: g?.diamond_count ?? g?.diamondCount ?? null,
    });
  }
  list.sort((a, b) => (a.diamondCount ?? 0) - (b.diamondCount ?? 0));
  return list;
}

function setConnection(newConnection, username) {
  // Establece una nueva conexión y guarda el usuario
  connection = newConnection;
  currentUsername = username;
}

function disconnectConnection() {
  // Cierra la conexión actual y limpia las variables
  if (connection) {
    console.log(`❌ Cerrando conexión previa con @${currentUsername}`);
    connection.disconnect();
    connection = null;
    currentUsername = null;
  }
}

// Exporta todo para usar en otros archivos
export {
  refreshAvailableGifts,
  getConnection,
  getGiftMap,
  getAvailableGiftsList,
  setConnection,
  disconnectConnection,
  WebcastEvent,
  ControlEvent,
  TikTokLiveConnection
}
