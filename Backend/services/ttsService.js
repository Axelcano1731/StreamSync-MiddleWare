// services/ttsService.js
//
// TTS neuronal usando el motor "Read Aloud" de Microsoft Edge (mismas voces que
// Azure Neural TTS) a través del paquete msedge-tts. Es gratis y no requiere API
// key, pero necesita conexión a internet. Sustituye a las voces robóticas de la
// Web Speech API (SAPI) que expone Electron en Windows.
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const DEFAULT_VOICE = 'es-MX-DaliaNeural';

let voicesCache = null;

// Limpia el nombre comercial: "Microsoft Dalia Online (Natural) - Spanish (Mexico)"
// -> "Dalia".
function friendlyName(voice) {
  const raw = voice.FriendlyName || voice.ShortName || '';
  const match = raw.match(/Microsoft\s+(.+?)\s+Online/i);
  if (match) return match[1];
  return raw.replace(/^Microsoft\s+/i, '');
}

export async function listVoices() {
  if (voicesCache) return voicesCache;

  const tts = new MsEdgeTTS();
  const raw = await tts.getVoices();

  voicesCache = raw
    .map((v) => ({
      shortName: v.ShortName,
      name: friendlyName(v),
      locale: v.Locale,
      gender: (v.Gender || '').toLowerCase(), // "female" | "male"
    }))
    .sort((a, b) => {
      // Español primero (es el idioma de uso), luego por locale y nombre.
      const aEs = a.locale.startsWith('es') ? 0 : 1;
      const bEs = b.locale.startsWith('es') ? 0 : 1;
      if (aEs !== bEs) return aEs - bEs;
      if (a.locale !== b.locale) return a.locale.localeCompare(b.locale);
      return a.name.localeCompare(b.name);
    });

  return voicesCache;
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// El tono (pitch) de la Web Speech API es un multiplicador (1 = normal). SSML
// espera un porcentaje relativo, así que lo convertimos: 1.2 -> "+20%".
function pitchToPercent(pitch) {
  const p = Number(pitch);
  if (!Number.isFinite(p) || p === 1) return '+0%';
  const clamped = Math.min(2, Math.max(0.5, p));
  const pct = Math.round((clamped - 1) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

/**
 * Sintetiza texto a audio MP3.
 * @param {string} text
 * @param {{voice?: string, rate?: number, pitch?: number}} opts
 *   rate/pitch son multiplicadores estilo Web Speech (1 = normal).
 * @returns {Promise<Buffer>} audio MP3
 */
export async function synthesize(text, { voice, rate = 1, pitch = 1 } = {}) {
  const clean = escapeXml(String(text || '').trim());
  if (!clean) throw new Error('Texto vacío');

  const tts = new MsEdgeTTS();
  await tts.setMetadata(
    voice || DEFAULT_VOICE,
    OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
  );

  // rate como número relativo (1 = normal) lo acepta msedge-tts directamente.
  const safeRate = Math.min(2, Math.max(0.5, Number(rate) || 1));

  const { audioStream } = tts.toStream(clean, {
    rate: safeRate,
    pitch: pitchToPercent(pitch),
  });

  const chunks = [];
  await new Promise((resolve, reject) => {
    audioStream.on('data', (d) => chunks.push(d));
    audioStream.on('end', resolve);
    audioStream.on('close', resolve);
    audioStream.on('error', reject);
  });

  return Buffer.concat(chunks);
}
