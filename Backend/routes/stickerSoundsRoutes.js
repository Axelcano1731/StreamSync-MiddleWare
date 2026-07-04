// routes/stickerSoundsRoutes.js
import express from 'express';
import {
  getStickerSounds,
  setStickerSound,
  updateStickerSound,
  deleteStickerSound,
} from '../services/stickerSoundService.js';
import { getAvailableGiftsList } from '../services/tiktokService.js';

const router = express.Router();

router.get('/', (_req, res) => {
  res.json(getStickerSounds());
});

// Lista completa de stickers/regalos disponibles de TikTok (con imágenes)
// para que el usuario los seleccione visualmente sin escribir el nombre.
router.get('/available-gifts', (_req, res) => {
  res.json(getAvailableGiftsList());
});

router.post('/', (req, res) => {
  const { giftName, fileName, soundData, volume, giftImage, label, type, cooldownSec } = req.body;
  if (!giftName || !soundData) {
    return res.status(400).json({ error: 'giftName y soundData son requeridos' });
  }
  const updated = setStickerSound(giftName, {
    fileName: fileName || 'audio',
    soundData,
    volume: typeof volume === 'number' ? volume : 0.8,
    giftImage: giftImage || null,
    label: label || null,
    type: type || 'gift',
    enabled: true,
    cooldownSec: Number.isFinite(Number(cooldownSec)) ? Number(cooldownSec) : null,
  });
  res.json(updated);
});

// Edición parcial: volumen, activar/desactivar, cooldown propio, etiqueta.
router.patch('/:giftName', (req, res) => {
  const giftName = decodeURIComponent(req.params.giftName);
  const { volume, enabled, cooldownSec, label } = req.body;
  const partial = {};
  if (volume !== undefined) partial.volume = Math.min(1, Math.max(0, Number(volume) || 0));
  if (enabled !== undefined) partial.enabled = !!enabled;
  if (cooldownSec !== undefined) {
    partial.cooldownSec =
      cooldownSec === null || cooldownSec === '' ? null : Math.max(0, Number(cooldownSec) || 0);
  }
  if (label !== undefined) partial.label = label;
  const updated = updateStickerSound(giftName, partial);
  res.json(updated);
});

router.delete('/:giftName', (req, res) => {
  const giftName = decodeURIComponent(req.params.giftName);
  const updated = deleteStickerSound(giftName);
  res.json(updated);
});

export default router;
