// routes/stickerSoundsRoutes.js
import express from 'express';
import {
  getStickerSounds,
  setStickerSound,
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
  const { giftName, fileName, soundData, volume, giftImage, label, type } = req.body;
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
  });
  res.json(updated);
});

router.delete('/:giftName', (req, res) => {
  const giftName = decodeURIComponent(req.params.giftName);
  const updated = deleteStickerSound(giftName);
  res.json(updated);
});

export default router;
