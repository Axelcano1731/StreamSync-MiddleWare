// routes/stickerSoundsRoutes.js
import express from 'express';
import {
  getStickerSounds,
  setStickerSound,
  deleteStickerSound,
} from '../services/stickerSoundService.js';

const router = express.Router();

router.get('/', (_req, res) => {
  res.json(getStickerSounds());
});

router.post('/', (req, res) => {
  const { giftName, fileName, soundData, volume } = req.body;
  if (!giftName || !soundData) {
    return res.status(400).json({ error: 'giftName y soundData son requeridos' });
  }
  const updated = setStickerSound(giftName, {
    fileName: fileName || 'audio',
    soundData,
    volume: typeof volume === 'number' ? volume : 0.8,
  });
  res.json(updated);
});

router.delete('/:giftName', (req, res) => {
  const giftName = decodeURIComponent(req.params.giftName);
  const updated = deleteStickerSound(giftName);
  res.json(updated);
});

export default router;
