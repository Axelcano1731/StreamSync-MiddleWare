// services/stickerSoundService.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOUNDS_FILE = path.join(__dirname, '../data/stickerSounds.json');

function load() {
  try {
    if (!fs.existsSync(SOUNDS_FILE)) return {};
    return JSON.parse(fs.readFileSync(SOUNDS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function save(data) {
  fs.writeFileSync(SOUNDS_FILE, JSON.stringify(data, null, 2));
}

export function getStickerSounds() {
  return load();
}

export function setStickerSound(giftName, config) {
  const sounds = load();
  sounds[giftName] = config;
  save(sounds);
  return sounds;
}

export function deleteStickerSound(giftName) {
  const sounds = load();
  delete sounds[giftName];
  save(sounds);
  return sounds;
}

export function getStickerSoundForGift(giftName) {
  if (!giftName) return null;
  const sounds = load();
  return sounds[giftName] || null;
}
