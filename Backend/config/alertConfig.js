// config/alertConfig.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, '..', 'data', 'alertConfig.json');

// Default alert configuration
const DEFAULT_CONFIG = {
  alerts: {
    gift: {
      enabled: true,
      sound: 'default_gift.mp3',
      volume: 0.8,
      duration: 5000,
      animation: 'slideIn',
      minDiamonds: 1,      // Minimum diamonds to trigger alert
      showOverlay: true,
      tts: false,
    },
    follow: {
      enabled: true,
      sound: 'default_follow.mp3',
      volume: 0.6,
      duration: 3000,
      animation: 'fadeIn',
      showOverlay: true,
      tts: false,
    },
    share: {
      enabled: true,
      sound: 'default_share.mp3',
      volume: 0.5,
      duration: 3000,
      animation: 'fadeIn',
      showOverlay: true,
      tts: false,
    },
    chat: {
      enabled: true,
      sound: null,           // No sound by default for chat
      volume: 0.5,
      duration: 0,           // Stays until next message
      animation: 'none',
      showOverlay: false,
      tts: true,             // TTS enabled for chat by default
    },
    like: {
      enabled: true,
      sound: null,
      volume: 0.3,
      duration: 2000,
      animation: 'pop',
      showOverlay: false,
      tts: false,
    },
    memberJoin: {
      enabled: false,        // Disabled by default (too frequent)
      sound: null,
      volume: 0.3,
      duration: 2000,
      animation: 'fadeIn',
      showOverlay: false,
      tts: false,
    },
  },
  tts: {
    enabled: true,
    voice: null,              // Use system default
    rate: 1.0,
    pitch: 1.0,
    volume: 0.8,
    maxLength: 200,           // Max chars for TTS
    filterSpam: true,
    blockedWords: [],
    readUsername: true,        // Read "user says:" prefix
    queueMode: 'fifo',       // fifo | priority (donors first)
  },
  overlay: {
    position: 'top-right',    // top-left, top-right, bottom-left, bottom-right, center
    maxAlerts: 3,             // Max simultaneous alerts
    theme: 'dark',
    customCSS: '',
  },
  goals: {
    likes: { target: 0, current: 0, enabled: false },
    followers: { target: 0, current: 0, enabled: false },
    gifts: { target: 0, current: 0, enabled: false },
    diamonds: { target: 0, current: 0, enabled: false },
  },
};

let currentConfig = null;

/**
 * Ensure data directory exists
 */
function ensureDataDir() {
  const dataDir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

/**
 * Load config from disk or return defaults
 */
export function loadConfig() {
  try {
    ensureDataDir();
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      currentConfig = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } else {
      currentConfig = { ...DEFAULT_CONFIG };
      saveConfig(currentConfig);
    }
  } catch (err) {
    console.warn('⚠️ Error loading config, using defaults:', err.message);
    currentConfig = { ...DEFAULT_CONFIG };
  }
  return currentConfig;
}

/**
 * Save config to disk
 */
export function saveConfig(config) {
  try {
    ensureDataDir();
    currentConfig = config;
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    console.log('💾 Alert config saved');
  } catch (err) {
    console.error('❌ Error saving config:', err.message);
  }
}

/**
 * Get current config (from memory)
 */
export function getConfig() {
  if (!currentConfig) return loadConfig();
  return currentConfig;
}

/**
 * Update a specific section of the config
 */
export function updateConfig(section, data) {
  const config = getConfig();
  config[section] = { ...config[section], ...data };
  saveConfig(config);
  return config;
}

export { DEFAULT_CONFIG };
