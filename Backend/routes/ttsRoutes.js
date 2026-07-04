// routes/ttsRoutes.js
import express from 'express';
import { listVoices, synthesize } from '../services/ttsService.js';

const router = express.Router();

// Lista de voces neuronales disponibles (español primero).
router.get('/voices', async (_req, res) => {
  try {
    const voices = await listVoices();
    res.json(voices);
  } catch (err) {
    console.error('[tts] Error al obtener voces:', err.message);
    res.status(502).json({ error: 'No se pudieron obtener las voces' });
  }
});

// Sintetiza texto y devuelve audio MP3.
router.post('/speak', async (req, res) => {
  const { text, voice, rate, pitch } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ error: 'Falta el texto a sintetizar' });
  }
  try {
    const audio = await synthesize(text, { voice, rate, pitch });
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'no-store');
    res.send(audio);
  } catch (err) {
    console.error('[tts] Error al sintetizar:', err.message);
    res.status(502).json({ error: 'No se pudo generar el audio' });
  }
});

export default router;
