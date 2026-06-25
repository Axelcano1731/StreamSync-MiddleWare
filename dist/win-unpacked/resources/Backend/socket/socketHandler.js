import { connectToTikTok, cancelReconnect } from '../controllers/tiktokController.js';
import { disconnectConnection } from '../services/tiktokService.js';
import { getConfig, updateConfig, loadConfig } from '../config/alertConfig.js';
import { getAllStats, getTopDonors, getTopChatters, getSessionSummary } from '../services/statsTracker.js';
import { initEngine, startSpotifyBroadcast, emitPreviewAlert, resetGoalProgress } from '../services/eventEngine.js';
import { getSpotifyStatus, getCurrentTrack } from '../services/spotifyService.js';
import { getWebhookHistory, getWebhookEmitter, sendTestWebhook } from '../services/webhookService.js';
import {
  getMinecraftStatus,
  validateMinecraftConfig,
  startMinecraftServer,
  stopMinecraftServer,
  sendMinecraftCommand,
  getMinecraftEmitter,
  getSuggestedMinecraftPaths,
} from '../services/minecraftServerService.js';

function emitConfig(io, config) {
  io.emit('alertConfig', config);
  io.of('/overlay').emit('config', config);
}

function resolveCallback(arg1, arg2) {
  if (typeof arg1 === 'function') {
    return { payload: undefined, callback: arg1 };
  }

  return {
    payload: arg1,
    callback: typeof arg2 === 'function' ? arg2 : null,
  };
}

export default function socketHandler(io) {
  initEngine(io);
  loadConfig();
  startSpotifyBroadcast();

  const webhookEmitter = getWebhookEmitter();
  webhookEmitter.on('delivery', (entry) => {
    io.emit('webhookDelivery', entry);
  });

  const minecraftEmitter = getMinecraftEmitter();
  minecraftEmitter.on('status', (status) => {
    io.emit('minecraftStatus', status);
  });
  minecraftEmitter.on('log', (entry) => {
    io.emit('minecraftLog', entry);
  });

  setInterval(() => {
    const donors = getTopDonors(5);
    const chatters = getTopChatters(5);
    io.emit('topDonorsUpdate', donors);
    io.of('/overlay').emit('topDonorsUpdate', donors);
    io.emit('topChattersUpdate', chatters);
  }, 5000);

  io.of('/overlay').on('connection', (socket) => {
    console.log('Overlay client connected:', socket.id);
    socket.emit('config', getConfig());

    socket.on('disconnect', () => {
      console.log('Overlay client disconnected:', socket.id);
    });
  });

  io.on('connection', (socket) => {
    console.log('Dashboard client connected:', socket.id);
    socket.emit('minecraftStatus', getMinecraftStatus());

    socket.on('connectToTikTok', async (username) => {
      await connectToTikTok(username, io);
    });

    socket.on('disconnectFromTikTok', () => {
      cancelReconnect();
      disconnectConnection();
      resetGoalProgress();
      io.emit('status', { status: 'offline' });
    });

    socket.on('getAlertConfig', (callback) => {
      const config = getConfig();
      if (typeof callback === 'function') callback(config);
      else socket.emit('alertConfig', config);
    });

    socket.on('updateAlertConfig', (data) => {
      const { section, config } = data;
      const updated = updateConfig(section, config);
      emitConfig(io, updated);
    });

    socket.on('updateAlerts', (alertsConfig) => {
      const updated = updateConfig('alerts', alertsConfig);
      emitConfig(io, updated);
    });

    socket.on('updateTTS', (ttsConfig) => {
      const updated = updateConfig('tts', ttsConfig);
      io.emit('alertConfig', updated);
    });

    socket.on('updateGoals', (goalsConfig) => {
      const updated = updateConfig('goals', goalsConfig);
      emitConfig(io, updated);
    });

    socket.on('updateOverlayConfig', (overlayConfig) => {
      const updated = updateConfig('overlay', overlayConfig);
      emitConfig(io, updated);
    });

    socket.on('previewAlert', (eventType, callback) => {
      try {
        const preview = emitPreviewAlert(eventType);
        if (typeof callback === 'function') {
          callback({ ok: true, preview });
        }
      } catch (error) {
        if (typeof callback === 'function') {
          callback({ ok: false, error: error.message });
        }
      }
    });

    socket.on('updateWebhooks', (webhooksConfig) => {
      const updated = updateConfig('webhooks', webhooksConfig);
      io.emit('alertConfig', updated);
      socket.emit('webhookHistory', getWebhookHistory());
    });

    socket.on('getWebhookHistory', (callback) => {
      const history = getWebhookHistory();
      if (typeof callback === 'function') callback(history);
      else socket.emit('webhookHistory', history);
    });

    socket.on('testWebhook', async (webhookId, callback) => {
      try {
        const result = await sendTestWebhook(webhookId);
        if (typeof callback === 'function') {
          callback({ ok: true, result });
        } else {
          socket.emit('webhookTestResult', { ok: true, result });
        }
      } catch (error) {
        if (typeof callback === 'function') {
          callback({ ok: false, error: error.message });
        } else {
          socket.emit('webhookTestResult', { ok: false, error: error.message });
        }
      }
    });

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

    socket.on('getMinecraftStatus', (callback) => {
      const status = getMinecraftStatus();
      if (typeof callback === 'function') callback(status);
      else socket.emit('minecraftStatus', status);
    });

    socket.on('getMinecraftSuggestedPaths', (arg1, arg2) => {
      const { payload, callback } = resolveCallback(arg1, arg2);
      const version = typeof payload === 'string' ? payload : payload?.minecraftVersion;
      const paths = getSuggestedMinecraftPaths(version || '1.21');
      if (typeof callback === 'function') callback(paths);
    });

    socket.on('validateMinecraftConfig', async (arg1, arg2) => {
      const { payload, callback } = resolveCallback(arg1, arg2);

      try {
        const result = await validateMinecraftConfig(payload || {});
        if (callback) {
          callback({ ok: true, result });
        } else {
          socket.emit('minecraftValidation', { ok: true, result });
        }
      } catch (error) {
        if (callback) {
          callback({ ok: false, error: error.message });
        } else {
          socket.emit('minecraftValidation', { ok: false, error: error.message });
        }
      }
    });

    socket.on('updateMinecraftConfig', (arg1, arg2) => {
      const { payload, callback } = resolveCallback(arg1, arg2);
      const updated = updateConfig('minecraft', payload || {});
      const status = getMinecraftStatus();
      io.emit('alertConfig', updated);
      io.emit('minecraftStatus', status);

      if (callback) {
        callback({ ok: true, config: updated.minecraft, status });
      }
    });

    socket.on('startMinecraftServer', async (arg1, arg2) => {
      const { payload, callback } = resolveCallback(arg1, arg2);

      try {
        if (payload && typeof payload === 'object' && Object.keys(payload).length > 0) {
          updateConfig('minecraft', payload);
        }

        const status = await startMinecraftServer(payload || {});
        if (callback) callback({ ok: true, status });
      } catch (error) {
        if (callback) callback({ ok: false, error: error.message });
      }
    });

    socket.on('stopMinecraftServer', async (callback) => {
      try {
        const status = await stopMinecraftServer();
        if (typeof callback === 'function') callback({ ok: true, status });
      } catch (error) {
        if (typeof callback === 'function') callback({ ok: false, error: error.message });
      }
    });

    socket.on('sendMinecraftCommand', async (command, callback) => {
      try {
        const status = await sendMinecraftCommand(command);
        if (typeof callback === 'function') callback({ ok: true, status });
      } catch (error) {
        if (typeof callback === 'function') callback({ ok: false, error: error.message });
      }
    });

    socket.on('disconnect', () => {
      console.log('Dashboard client disconnected:', socket.id);
    });
  });
}
