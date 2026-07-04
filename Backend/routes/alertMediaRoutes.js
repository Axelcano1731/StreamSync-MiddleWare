// routes/alertMediaRoutes.js
import express from 'express';
import {
  getAlertMedia,
  setAlertMedia,
  updateAlertMedia,
  deleteAlertMedia,
  ALERT_EVENT_TYPES,
} from '../services/alertMediaService.js';

const router = express.Router();

router.get('/', (_req, res) => {
  res.json(getAlertMedia());
});

// Una clave válida es un evento conocido o un regalo específico (gift:<id|nombre>).
function isValidKey(key) {
  return ALERT_EVENT_TYPES.includes(key) || (typeof key === 'string' && key.startsWith('gift:'));
}

// Crea/define la media de un evento. Acepta image/video/sound como data URL.
router.post('/:eventType', (req, res) => {
  const { eventType } = req.params;
  if (!isValidKey(eventType)) {
    return res.status(400).json({ error: 'Tipo de evento no válido' });
  }
  const { image, video, loop, sound, title, message, duration, soundVolume, animation, cooldownSec, minDiamonds, enabled, giftName, giftImage } = req.body;

  const config = {};
  if (image !== undefined) config.image = image;
  if (video !== undefined) config.video = video;
  if (loop !== undefined) config.loop = !!loop;
  if (sound !== undefined) config.sound = sound;
  if (giftName !== undefined) config.giftName = giftName;
  if (giftImage !== undefined) config.giftImage = giftImage;
  if (title !== undefined) config.title = title;
  if (message !== undefined) config.message = message;
  if (duration !== undefined) config.duration = Number(duration) || 5000;
  if (soundVolume !== undefined) config.soundVolume = Math.min(1, Math.max(0, Number(soundVolume) || 0));
  if (animation !== undefined) config.animation = animation;
  if (cooldownSec !== undefined) {
    config.cooldownSec = cooldownSec === null || cooldownSec === '' ? null : Math.max(0, Number(cooldownSec) || 0);
  }
  if (minDiamonds !== undefined) config.minDiamonds = Math.max(0, Number(minDiamonds) || 0);
  config.enabled = enabled === undefined ? true : !!enabled;

  res.json(setAlertMedia(eventType, config));
});

// Actualización parcial (texto, volumen, enabled, cooldown, etc.).
router.patch('/:eventType', (req, res) => {
  const { eventType } = req.params;
  if (!isValidKey(eventType)) {
    return res.status(400).json({ error: 'Tipo de evento no válido' });
  }
  const partial = {};
  const b = req.body;
  if (b.title !== undefined) partial.title = b.title;
  if (b.message !== undefined) partial.message = b.message;
  if (b.image !== undefined) partial.image = b.image;
  if (b.video !== undefined) partial.video = b.video;
  if (b.loop !== undefined) partial.loop = !!b.loop;
  if (b.sound !== undefined) partial.sound = b.sound;
  if (b.giftName !== undefined) partial.giftName = b.giftName;
  if (b.giftImage !== undefined) partial.giftImage = b.giftImage;
  if (b.enabled !== undefined) partial.enabled = !!b.enabled;
  if (b.duration !== undefined) partial.duration = Number(b.duration) || 5000;
  if (b.soundVolume !== undefined) partial.soundVolume = Math.min(1, Math.max(0, Number(b.soundVolume) || 0));
  if (b.animation !== undefined) partial.animation = b.animation;
  if (b.minDiamonds !== undefined) partial.minDiamonds = Math.max(0, Number(b.minDiamonds) || 0);
  if (b.cooldownSec !== undefined) {
    partial.cooldownSec = b.cooldownSec === null || b.cooldownSec === '' ? null : Math.max(0, Number(b.cooldownSec) || 0);
  }
  res.json(updateAlertMedia(eventType, partial));
});

// Borra un campo concreto (image|sound) de un evento.
router.delete('/:eventType/:field', (req, res) => {
  const { eventType, field } = req.params;
  res.json(deleteAlertMedia(eventType, field));
});

// Borra el evento completo.
router.delete('/:eventType', (req, res) => {
  res.json(deleteAlertMedia(req.params.eventType, null));
});

export default router;
