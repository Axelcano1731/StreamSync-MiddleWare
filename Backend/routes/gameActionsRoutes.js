// routes/gameActionsRoutes.js
import express from 'express';
import {
  getGameActions,
  setGameActions,
  saveRule,
  deleteRule,
  applyPreset,
  testRule,
  pingGame,
  getGameActionHistory,
  clearGameActionHistory,
  resetGameCounters,
  GAME_EVENT_TYPES,
} from '../services/gameActionsService.js';
import { GAME_PRESETS, PLACEHOLDERS } from '../services/gamePresets.js';

const router = express.Router();

// Config completa + metadatos que necesita el panel para pintarse.
router.get('/', (_req, res) => {
  res.json({
    config: getGameActions(),
    presets: GAME_PRESETS,
    placeholders: PLACEHOLDERS,
    eventTypes: GAME_EVENT_TYPES,
    history: getGameActionHistory(),
  });
});

// Ajustes globales: activar/desactivar, URL base del juego, timeout.
router.patch('/', (req, res) => {
  const patch = {};
  if (req.body.enabled !== undefined) patch.enabled = !!req.body.enabled;
  if (req.body.baseUrl !== undefined) patch.baseUrl = req.body.baseUrl;
  if (req.body.timeoutMs !== undefined) patch.timeoutMs = req.body.timeoutMs;
  if (Array.isArray(req.body.rules)) patch.rules = req.body.rules;
  res.json(setGameActions(patch));
});

// Crea o actualiza una regla (el id decide cuál de las dos).
router.put('/rules/:id', (req, res) => {
  try {
    res.json(saveRule({ ...req.body, id: req.params.id }));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/rules/:id', (req, res) => {
  res.json(deleteRule(req.params.id));
});

// Lanza la regla contra el juego con datos de ejemplo, saltándose los filtros.
router.post('/rules/:id/test', async (req, res) => {
  try {
    const result = await testRule(req.params.id, req.body || {});
    res.json({ ok: result.ok, result });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// Carga el set de reglas de un juego. ?mode=replace sustituye las actuales.
router.post('/presets/:presetId', (req, res) => {
  try {
    const mode = req.query.mode === 'replace' ? 'replace' : 'append';
    res.json(applyPreset(req.params.presetId, mode));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ¿Está el juego escuchando en la URL base?
router.post('/ping', async (req, res) => {
  try {
    res.json(await pingGame(req.body?.baseUrl));
  } catch (error) {
    res.status(400).json({ reachable: false, error: error.message });
  }
});

router.get('/history', (req, res) => {
  res.json(getGameActionHistory(Number(req.query.limit) || 40));
});

router.delete('/history', (_req, res) => {
  res.json(clearGameActionHistory());
});

// Vacía acumuladores de likes y cooldowns (útil entre partidas).
router.post('/reset-counters', (_req, res) => {
  resetGameCounters();
  res.json({ ok: true });
});

export default router;
