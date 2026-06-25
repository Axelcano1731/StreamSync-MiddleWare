// config/alertConfig.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, '..', 'data', 'alertConfig.json');

function createOverlayPreset({
  id,
  name,
  description,
  accentColor = '#7c3aed',
  theme = 'dark',
  backgroundStyle = 'glass',
  position = 'top-right',
  maxAlerts = 3,
  showChatBox = true,
  showGoalTracker = true,
  width = 1920,
  height = 1080,
} = {}) {
  return {
    id,
    name,
    description,
    accentColor,
    theme,
    backgroundStyle,
    position,
    maxAlerts,
    showChatBox,
    showGoalTracker,
    width,
    height,
    chatPlacement: 'bottom-left',
    goalPlacement: 'bottom-center',
  };
}

// Default alert configuration
const DEFAULT_CONFIG = {
  alerts: {
    gift: {
      enabled: true,
      sound: 'default_gift.mp3',
      volume: 0.8,
      duration: 5000,
      animation: 'slideIn',
      minDiamonds: 1,
      showOverlay: true,
      tts: false,
      titleTemplate: 'Nuevo regalo',
      messageTemplate: '{user} envio {repeatCount}x {giftName}',
    },
    follow: {
      enabled: true,
      sound: 'default_follow.mp3',
      volume: 0.6,
      duration: 3000,
      animation: 'fadeIn',
      showOverlay: true,
      tts: false,
      titleTemplate: 'Nuevo seguidor',
      messageTemplate: '{user} empezo a seguirte',
    },
    share: {
      enabled: true,
      sound: 'default_share.mp3',
      volume: 0.5,
      duration: 3000,
      animation: 'fadeIn',
      showOverlay: true,
      tts: false,
      titleTemplate: 'Directo compartido',
      messageTemplate: '{user} compartio tu live',
    },
    chat: {
      enabled: true,
      sound: null,
      volume: 0.5,
      duration: 0,
      animation: 'none',
      showOverlay: false,
      tts: true,
      titleTemplate: 'Nuevo comentario',
      messageTemplate: '{user}: {comment}',
    },
    like: {
      enabled: true,
      sound: null,
      volume: 0.3,
      duration: 2000,
      animation: 'pop',
      showOverlay: false,
      tts: false,
      titleTemplate: 'Likes en vivo',
      messageTemplate: '{user} envio {likeCount} likes',
    },
    memberJoin: {
      enabled: false,
      sound: null,
      volume: 0.3,
      duration: 2000,
      animation: 'fadeIn',
      showOverlay: false,
      tts: false,
      titleTemplate: 'Nuevo viewer',
      messageTemplate: '{user} se unio al directo',
    },
  },
  tts: {
    enabled: true,
    voice: null,
    rate: 1.0,
    pitch: 1.0,
    volume: 0.8,
    maxLength: 200,
    filterSpam: true,
    blockedWords: [],
    readUsername: true,
    queueMode: 'fifo',
  },
  overlay: {
    position: 'top-right',
    maxAlerts: 3,
    theme: 'dark',
    customCSS: '',
    defaultPresetId: 'overlay-main',
    presets: [
      createOverlayPreset({
        id: 'overlay-main',
        name: 'Overlay Principal',
        description: 'Alertas, chat y metas en una sola escena.',
        accentColor: '#7c3aed',
        backgroundStyle: 'glass',
        position: 'top-right',
        maxAlerts: 3,
        showChatBox: true,
        showGoalTracker: true,
      }),
      createOverlayPreset({
        id: 'overlay-compact',
        name: 'Overlay Compacto',
        description: 'Solo alertas rapidas para escenas mas cargadas.',
        accentColor: '#ec4899',
        backgroundStyle: 'solid',
        position: 'top-right',
        maxAlerts: 2,
        showChatBox: false,
        showGoalTracker: false,
        width: 1280,
        height: 720,
      }),
    ],
  },
  goals: {
    likes: { target: 0, current: 0, enabled: false },
    followers: { target: 0, current: 0, enabled: false },
    gifts: { target: 0, current: 0, enabled: false },
    diamonds: { target: 0, current: 0, enabled: false },
  },
  webhooks: {
    timeoutMs: 8000,
    items: [],
  },
  minecraft: {
    minecraftVersion: '1.21',
    javaPath: 'java',
    serverJar: '',
    serverDirectory: '',
    minMemoryMb: 2048,
    maxMemoryMb: 4096,
    port: 25565,
    autoAcceptEula: false,
    startupArgs: '',
  },
  minecraftActions: {
    enabled: false,
    rules: [],
  },
  avatarBattle: {
    enabled: true,
    likesBuff: true,
    likesPerBuff: 50,
    rules: {
      byId: {},
      byName: {
        rose: { type: 'avatar', hp: 80, power: 8, weapon: 'fist', tint: '#ff5fa2', scaleWithCombo: true },
        heart: { type: 'effect', effect: 'heal', target: 'A', intensity: 1 },
      },
      byTier: [
        { minDiamonds: 1, action: { type: 'avatar', hp: 80, power: 8, weapon: 'fist', scaleWithCombo: true } },
        { minDiamonds: 5, action: { type: 'avatar', hp: 120, power: 15, weapon: 'sword' } },
        { minDiamonds: 50, action: { type: 'avatar', hp: 200, power: 30, weapon: 'hammer' } },
        { minDiamonds: 100, action: { type: 'effect', effect: 'meteor', target: 'all', intensity: 1 } },
      ],
      default: { type: 'avatar', hp: 80, power: 8, weapon: 'fist' },
    },
  },
};

let currentConfig = null;

function ensureDataDir() {
  const dataDir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, override) {
  if (Array.isArray(base)) {
    return Array.isArray(override) ? [...override] : [...base];
  }

  if (!isPlainObject(base)) {
    return override === undefined ? base : override;
  }

  const result = { ...base };

  if (!isPlainObject(override)) {
    return result;
  }

  for (const [key, value] of Object.entries(override)) {
    if (Array.isArray(value)) {
      result[key] = [...value];
      continue;
    }

    if (isPlainObject(value) && isPlainObject(base[key])) {
      result[key] = deepMerge(base[key], value);
      continue;
    }

    result[key] = value;
  }

  return result;
}

function normalizeConfig(config) {
  const normalized = deepMerge(DEFAULT_CONFIG, config || {});

  if (!Array.isArray(normalized.overlay?.presets) || normalized.overlay.presets.length === 0) {
    normalized.overlay.presets = [...DEFAULT_CONFIG.overlay.presets];
  }

  if (!normalized.overlay.defaultPresetId) {
    normalized.overlay.defaultPresetId = normalized.overlay.presets[0]?.id || 'overlay-main';
  }

  if (!Array.isArray(normalized.webhooks?.items)) {
    normalized.webhooks.items = [];
  }

  return normalized;
}

export function loadConfig() {
  try {
    ensureDataDir();
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      currentConfig = normalizeConfig(JSON.parse(raw));
    } else {
      currentConfig = normalizeConfig(DEFAULT_CONFIG);
      saveConfig(currentConfig);
    }
  } catch (err) {
    console.warn('⚠️ Error loading config, using defaults:', err.message);
    currentConfig = normalizeConfig(DEFAULT_CONFIG);
  }
  return currentConfig;
}

export function saveConfig(config) {
  try {
    ensureDataDir();
    currentConfig = normalizeConfig(config);
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2), 'utf-8');
    console.log('💾 Alert config saved');
  } catch (err) {
    console.error('❌ Error saving config:', err.message);
  }
}

export function getConfig() {
  if (!currentConfig) return loadConfig();
  return currentConfig;
}

export function updateConfig(section, data) {
  const config = getConfig();
  config[section] = deepMerge(config[section], data);
  saveConfig(config);
  return config;
}

export { DEFAULT_CONFIG, createOverlayPreset, normalizeConfig };
