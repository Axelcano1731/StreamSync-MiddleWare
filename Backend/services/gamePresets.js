// services/gamePresets.js
//
// Catálogo de juegos con webhooks locales. Cada preset trae:
//   · baseUrl      → puerto donde escucha el juego
//   · endpoints    → lista de rutas documentadas (ayuda del panel + autocompletar)
//   · options      → valores útiles para los desplegables (p. ej. IDs de monstruo)
//   · rules        → set de reglas listo para usar (se copia a gameActions.json)
//
// Las reglas usan el mismo formato que gameActionsService.normalizeRule().
// Fuente del preset de League of Monsters: manual de webhooks de GameTikStudio.

const LOM_MONSTERS = [
  { id: '0', label: '0 · Esqueleto' },
  { id: '1', label: '1 · Ghoul' },
  { id: '2', label: '2 · Bestia eléctrica' },
  { id: '3', label: '3 · Bruja' },
  { id: '4', label: '4 · Mantarraya' },
  { id: '5', label: '5 · Caballero oscuro' },
  { id: '6', label: '6 · Demonio alado' },
  { id: '7', label: '7 · Titán' },
];

const LEAGUE_OF_MONSTERS = {
  id: 'league-of-monsters',
  name: 'League of Monsters',
  icon: '👹',
  baseUrl: 'http://localhost:5729',
  description:
    'Juego de GameTikStudio. Los espectadores eligen equipo por chat y generan monstruos con regalos, likes y follows.',
  notes: [
    'El texto para unirse a cada equipo debe coincidir con el configurado en los ajustes del juego (por defecto "B" y "R").',
    'Si alguien genera un monstruo sin equipo, el juego le asigna uno al azar.',
    'Un espectador no puede cambiar de equipo hasta que acabe la partida.',
    'En modo multijugador solo se usa /spawnMonster: tu sala es el equipo azul si la creas y el rojo si te unes.',
  ],
  options: {
    monsters: LOM_MONSTERS,
  },
  endpoints: [
    {
      path: '/joinBlueTeam',
      label: 'Unirse al equipo azul',
      params: ['username'],
      hint: 'Actívalo con el comando de chat que tengas puesto en el juego (por defecto "B").',
    },
    {
      path: '/joinRedTeam',
      label: 'Unirse al equipo rojo',
      params: ['username'],
      hint: 'Actívalo con el comando de chat que tengas puesto en el juego (por defecto "R").',
    },
    {
      path: '/spawnMonster',
      label: 'Generar monstruo (equipo del usuario)',
      params: ['id', 'username', 'quantity'],
      hint: 'Aparece en el equipo que eligió el espectador; si no tiene, el juego le asigna uno.',
    },
    {
      path: '/spawnMonsterBlueTeam',
      label: 'Generar monstruo en el equipo azul',
      params: ['id', 'quantity'],
      hint: 'Fuerza el equipo azul, sin importar el equipo del espectador.',
    },
    {
      path: '/spawnMonsterRedTeam',
      label: 'Generar monstruo en el equipo rojo',
      params: ['id', 'quantity'],
      hint: 'Fuerza el equipo rojo, sin importar el equipo del espectador.',
    },
  ],
  rules: [
    {
      name: 'Chat "B" → equipo azul',
      event: 'chat',
      chatMode: 'equals',
      chatText: 'B',
      method: 'GET',
      path: '/joinBlueTeam',
      params: [{ key: 'username', value: '{nickname}' }],
      scaleMode: 'fixed',
      scaleFixed: 1,
      sendMode: 'quantity',
      cooldownSec: 2,
      cooldownPerUser: true,
    },
    {
      name: 'Chat "R" → equipo rojo',
      event: 'chat',
      chatMode: 'equals',
      chatText: 'R',
      method: 'GET',
      path: '/joinRedTeam',
      params: [{ key: 'username', value: '{nickname}' }],
      scaleMode: 'fixed',
      scaleFixed: 1,
      sendMode: 'quantity',
      cooldownSec: 2,
      cooldownPerUser: true,
    },
    {
      name: 'Rosa → 1 esqueleto por regalo',
      event: 'gift',
      giftName: 'Rose',
      method: 'GET',
      path: '/spawnMonster',
      params: [
        { key: 'id', value: '0' },
        { key: 'username', value: '{nickname}' },
        { key: 'quantity', value: '{quantity}' },
      ],
      scaleMode: 'combo',
      scaleMax: 20,
      sendMode: 'quantity',
    },
    {
      name: 'Regalo de 10💎+ → caballero oscuro',
      event: 'gift',
      minDiamonds: 10,
      method: 'GET',
      path: '/spawnMonster',
      params: [
        { key: 'id', value: '5' },
        { key: 'username', value: '{nickname}' },
        { key: 'quantity', value: '{quantity}' },
      ],
      scaleMode: 'combo',
      scaleMax: 10,
      sendMode: 'quantity',
    },
    {
      name: 'Regalo de 100💎+ → titán',
      event: 'gift',
      minDiamonds: 100,
      method: 'GET',
      path: '/spawnMonster',
      params: [
        { key: 'id', value: '7' },
        { key: 'username', value: '{nickname}' },
        { key: 'quantity', value: '{quantity}' },
      ],
      scaleMode: 'combo',
      scaleMax: 5,
      sendMode: 'quantity',
    },
    {
      name: 'Cada 50 likes → ghoul',
      event: 'like',
      likesPerTrigger: 50,
      likesPerUser: true,
      method: 'GET',
      path: '/spawnMonster',
      params: [
        { key: 'id', value: '1' },
        { key: 'username', value: '{nickname}' },
        { key: 'quantity', value: '{quantity}' },
      ],
      scaleMode: 'likes',
      scaleMax: 5,
      sendMode: 'quantity',
    },
    {
      name: 'Nuevo seguidor → bestia eléctrica',
      event: 'follow',
      method: 'GET',
      path: '/spawnMonster',
      params: [
        { key: 'id', value: '2' },
        { key: 'username', value: '{nickname}' },
        { key: 'quantity', value: '1' },
      ],
      scaleMode: 'fixed',
      scaleFixed: 1,
      sendMode: 'quantity',
    },
    {
      name: 'Compartir directo → mantarraya',
      event: 'share',
      method: 'GET',
      path: '/spawnMonster',
      params: [
        { key: 'id', value: '4' },
        { key: 'username', value: '{nickname}' },
        { key: 'quantity', value: '1' },
      ],
      scaleMode: 'fixed',
      scaleFixed: 1,
      sendMode: 'quantity',
      cooldownSec: 5,
      cooldownPerUser: true,
    },
    {
      name: 'Nueva suscripción → demonio alado',
      event: 'subscribe',
      method: 'GET',
      path: '/spawnMonster',
      params: [
        { key: 'id', value: '6' },
        { key: 'username', value: '{nickname}' },
        { key: 'quantity', value: '1' },
      ],
      scaleMode: 'fixed',
      scaleFixed: 1,
      sendMode: 'quantity',
    },
  ],
};

// Preset vacío para cualquier otro juego con webhooks locales.
const CUSTOM_GAME = {
  id: 'custom',
  name: 'Juego personalizado',
  icon: '🎮',
  baseUrl: 'http://localhost:8080',
  description:
    'Plantilla en blanco: pon el puerto de tu juego y crea las reglas a mano con sus endpoints.',
  notes: [],
  options: {},
  endpoints: [],
  rules: [
    {
      name: 'Regalo → acción del juego',
      event: 'gift',
      method: 'GET',
      path: '/miEndpoint',
      params: [
        { key: 'username', value: '{nickname}' },
        { key: 'quantity', value: '{quantity}' },
      ],
      scaleMode: 'combo',
      scaleMax: 10,
      sendMode: 'quantity',
    },
  ],
};

export const GAME_PRESETS = [LEAGUE_OF_MONSTERS, CUSTOM_GAME];

// Placeholders soportados, para la ayuda del panel.
export const PLACEHOLDERS = [
  { token: '{nickname}', desc: 'Nombre del espectador (alias de {username} y {user})' },
  { token: '{username}', desc: 'Mismo valor que {nickname}' },
  { token: '{quantity}', desc: 'Cantidad calculada por el escalado de la regla' },
  { token: '{repeatCount}', desc: 'Repeticiones del combo de regalo' },
  { token: '{giftName}', desc: 'Nombre del regalo' },
  { token: '{giftId}', desc: 'ID del regalo en TikTok' },
  { token: '{diamondCount}', desc: 'Monedas de una unidad del regalo' },
  { token: '{totalDiamonds}', desc: 'Monedas totales (unidad × combo)' },
  { token: '{likeCount}', desc: 'Likes del evento' },
  { token: '{totalLikeCount}', desc: 'Likes totales del directo' },
  { token: '{comment}', desc: 'Comentario completo del chat' },
  { token: '{args}', desc: 'Texto después del comando de chat' },
  { token: '{random(0,7)}', desc: 'Número al azar dentro del rango' },
];
