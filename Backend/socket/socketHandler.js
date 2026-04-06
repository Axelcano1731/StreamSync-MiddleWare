// socket/socketHandler.js
import { connectToTikTok, cancelReconnect } from '../controllers/tiktokController.js';
import { disconnectConnection } from '../services/tiktokService.js';
import { getConfig, updateConfig, loadConfig } from '../config/alertConfig.js';
import { getAllStats, getTopDonors, getTopChatters, getSessionSummary } from '../services/statsTracker.js';
import { initEngine, startSpotifyBroadcast } from '../services/eventEngine.js';
import { getSpotifyStatus, getCurrentTrack } from '../services/spotifyService.js';

export default function socketHandler(io) {
  // Initialize event engine with io reference
  initEngine(io);

  // Load config on startup
  loadConfig();

  // Start Spotify now-playing broadcast loop
  startSpotifyBroadcast();

  // Periodic ranking broadcast to overlay widgets (every 5s)
  setInterval(() => {
    const donors = getTopDonors(5);
    const chatters = getTopChatters(5);
    io.emit('topDonorsUpdate', donors);
    io.of('/overlay').emit('topDonorsUpdate', donors);
    io.emit('topChattersUpdate', chatters);
  }, 5000);

  // ====== OVERLAY NAMESPACE ======
  io.of('/overlay').on('connection', (socket) => {
    console.log('🎨 Overlay client connected:', socket.id);
    // Send current config to overlay
    socket.emit('config', getConfig());

    socket.on('disconnect', () => {
      console.log('🎨 Overlay client disconnected:', socket.id);
    });
  });

  // ====== MAIN NAMESPACE (Dashboard) ======
  io.on('connection', (socket) => {
    console.log('📱 Dashboard client connected:', socket.id);

    // ── TikTok Connection ──
    socket.on('connectToTikTok', async (username) => {
      await connectToTikTok(username, io);
    });

    socket.on('disconnectFromTikTok', () => {
      cancelReconnect();
      disconnectConnection();
      io.emit('status', { status: 'offline' });
    });

    // ── Alert Configuration ──
    socket.on('getAlertConfig', (callback) => {
      const config = getConfig();
      if (typeof callback === 'function') callback(config);
      else socket.emit('alertConfig', config);
    });

    socket.on('updateAlertConfig', (data) => {
      const { section, config } = data;
      const updated = updateConfig(section, config);
      io.emit('alertConfig', updated);
      io.of('/overlay').emit('config', updated);
    });

    socket.on('updateAlerts', (alertsConfig) => {
      const updated = updateConfig('alerts', alertsConfig);
      io.emit('alertConfig', updated);
      io.of('/overlay').emit('config', updated);
    });

    socket.on('updateTTS', (ttsConfig) => {
      const updated = updateConfig('tts', ttsConfig);
      io.emit('alertConfig', updated);
    });

    socket.on('updateGoals', (goalsConfig) => {
      const updated = updateConfig('goals', goalsConfig);
      io.emit('alertConfig', updated);
      io.of('/overlay').emit('config', updated);
    });

    // ── Stats ──
    socket.on('getStats', (callback) => {
      const stats = getAllStats();
      if (typeof callback === 'function') callback(stats);
      else socket.emit('stats', stats);
    });

    socket.on('getTopDonors', (callback) => {
      const donors = getTopDonors(10);
      if (typeof callback === 'function') callback(donors);
      else socket.emit('topDonors', donors);
    });

    socket.on('getTopChatters', (callback) => {
      const chatters = getTopChatters(10);
      if (typeof callback === 'function') callback(chatters);
      else socket.emit('topChatters', chatters);
    });

    socket.on('getSessionSummary', (callback) => {
      const summary = getSessionSummary();
      if (typeof callback === 'function') callback(summary);
      else socket.emit('sessionSummary', summary);
    });

    // ── Spotify ──
    socket.on('getSpotifyStatus', (callback) => {
      const status = getSpotifyStatus();
      if (typeof callback === 'function') callback(status);
      else socket.emit('spotifyStatus', status);
    });

    socket.on('getSpotifyNowPlaying', async (callback) => {
      const track = await getCurrentTrack();
      if (typeof callback === 'function') callback(track || { isPlaying: false });
      else socket.emit('nowPlaying', track || { isPlaying: false });
    });

    socket.on('disconnect', () => {
      console.log('📱 Dashboard client disconnected:', socket.id);
    });
  });
}
