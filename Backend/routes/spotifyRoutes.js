// routes/spotifyRoutes.js
import express from 'express';
import {
  getAuthUrl,
  handleCallback,
  getCurrentTrack,
  searchAndPlay,
  skipTrack,
  togglePlayback,
  getSpotifyStatus,
  disconnectSpotify,
  setRedirectUri,
} from '../services/spotifyService.js';

const router = express.Router();

/**
 * GET /api/spotify/login?clientId=xxx
 * Generates Spotify OAuth URL with PKCE and redirects the user
 */
router.get('/login', async (req, res) => {
  const { clientId } = req.query;
  if (!clientId) {
    return res.status(400).json({ error: 'clientId is required' });
  }

  const host = req.get('host');
  setRedirectUri(`http://${host}/api/spotify/callback`);

  try {
    const authUrl = await getAuthUrl(clientId);
    res.redirect(authUrl);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/spotify/callback
 * Handles OAuth callback from Spotify
 */
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.send(`
      <html><body style="background:#0f0f14;color:#fff;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
        <div style="text-align:center;">
          <h1>❌ Error</h1>
          <p>${error}</p>
          <p>Puedes cerrar esta ventana.</p>
        </div>
      </body></html>
    `);
  }

  if (!code) {
    return res.status(400).json({ error: 'No authorization code received' });
  }

  try {
    await handleCallback(code);
    res.send(`
      <html><body style="background:#0f0f14;color:#fff;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
        <div style="text-align:center;">
          <h1>✅ ¡Spotify Conectado!</h1>
          <p style="color:rgba(255,255,255,0.6);">Tu cuenta de Spotify está conectada con StreamSync.</p>
          <p style="color:rgba(255,255,255,0.4);margin-top:16px;">Puedes cerrar esta ventana y volver a la app.</p>
        </div>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send(`
      <html><body style="background:#0f0f14;color:#fff;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
        <div style="text-align:center;">
          <h1>❌ Error de conexión</h1>
          <p style="color:rgba(255,255,255,0.6);">${err.message}</p>
        </div>
      </body></html>
    `);
  }
});

/**
 * GET /api/spotify/now-playing
 */
router.get('/now-playing', async (req, res) => {
  const track = await getCurrentTrack();
  res.json(track || { isPlaying: false });
});

/**
 * POST /api/spotify/play
 * Body: { query: "song name" }
 */
router.post('/play', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });

  const result = await searchAndPlay(query);
  if (!result) return res.status(404).json({ error: 'Track not found or playback unavailable' });

  res.json(result);
});

/**
 * POST /api/spotify/skip
 */
router.post('/skip', async (req, res) => {
  const track = await skipTrack();
  res.json(track || { isPlaying: false });
});

/**
 * POST /api/spotify/toggle
 */
router.post('/toggle', async (req, res) => {
  const track = await togglePlayback();
  res.json(track || { isPlaying: false });
});

/**
 * GET /api/spotify/status
 */
router.get('/status', (req, res) => {
  res.json(getSpotifyStatus());
});

/**
 * POST /api/spotify/disconnect
 */
router.post('/disconnect', (req, res) => {
  disconnectSpotify();
  res.json({ success: true });
});

export default router;
