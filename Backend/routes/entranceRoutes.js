// routes/entranceRoutes.js
import express from 'express';
import {
  getEntrances,
  setEntrance,
  updateEntrance,
  deleteEntrance,
  normUser,
  ENTRANCE_DEFAULT_KEYS,
} from '../services/entranceService.js';

const router = express.Router();

router.get('/', (_req, res) => {
  res.json(getEntrances());
});

// Una clave válida es un default reservado (*subscriber/*superfan) o un nombre de
// usuario normalizado (minúsculas, sin @).
function resolveKey(raw) {
  if (ENTRANCE_DEFAULT_KEYS.includes(raw)) return raw;
  const k = normUser(raw);
  return k || null;
}

// Toma solo los campos conocidos del body para no guardar basura.
function pickFields(b) {
  const out = {};
  if (b.user !== undefined) out.user = b.user;
  if (b.avatar !== undefined) out.avatar = b.avatar;
  if (b.video !== undefined) out.video = b.video;
  if (b.sound !== undefined) out.sound = b.sound;
  if (b.loop !== undefined) out.loop = !!b.loop;
  if (b.muteVideo !== undefined) out.muteVideo = !!b.muteVideo;
  if (b.title !== undefined) out.title = b.title;
  if (b.message !== undefined) out.message = b.message;
  if (b.animation !== undefined) out.animation = b.animation;
  if (b.duration !== undefined) out.duration = Number(b.duration) || 8000;
  if (b.soundVolume !== undefined) out.soundVolume = Math.min(1, Math.max(0, Number(b.soundVolume) || 0));
  if (b.enabled !== undefined) out.enabled = !!b.enabled;
  if (b.cooldownSec !== undefined) {
    out.cooldownSec = b.cooldownSec === null || b.cooldownSec === '' ? null : Math.max(0, Number(b.cooldownSec) || 0);
  }
  if (b.presenceGapSec !== undefined) {
    out.presenceGapSec = b.presenceGapSec === null || b.presenceGapSec === '' ? null : Math.max(0, Number(b.presenceGapSec) || 0);
  }
  if (b.triggers !== undefined && b.triggers && typeof b.triggers === 'object') {
    out.triggers = {
      join: b.triggers.join !== false,
      subscribe: b.triggers.subscribe !== false,
      activity: b.triggers.activity !== false,
    };
  }
  return out;
}

// Crea/define la entrada de una clave. Acepta video/sound como data URL.
router.post('/:key', (req, res) => {
  const key = resolveKey(req.params.key);
  if (!key) return res.status(400).json({ error: 'Clave de entrada no válida' });

  const config = pickFields(req.body);
  if (config.enabled === undefined) config.enabled = true;
  res.json(setEntrance(key, config));
});

// Actualización parcial (texto, volumen, enabled, cooldown, etc.).
router.patch('/:key', (req, res) => {
  const key = resolveKey(req.params.key);
  if (!key) return res.status(400).json({ error: 'Clave de entrada no válida' });
  res.json(updateEntrance(key, pickFields(req.body)));
});

// Borra un campo concreto (video|sound) de una entrada.
router.delete('/:key/:field', (req, res) => {
  const key = resolveKey(req.params.key);
  if (!key) return res.status(400).json({ error: 'Clave de entrada no válida' });
  res.json(deleteEntrance(key, req.params.field));
});

// Borra la entrada completa.
router.delete('/:key', (req, res) => {
  const key = resolveKey(req.params.key);
  if (!key) return res.status(400).json({ error: 'Clave de entrada no válida' });
  res.json(deleteEntrance(key, null));
});

export default router;
