import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import socketHandler from './socket/socketHandler.js';
import spotifyRoutes from './routes/spotifyRoutes.js';
import stickerSoundsRoutes from './routes/stickerSoundsRoutes.js';
import { processEvent } from './services/eventEngine.js';
import { controlBattle } from './services/avatarBattleService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PORT = Number(process.env.PORT || 3000);
let appInstance = null;
let ioInstance = null;
let httpServer = null;

function isAllowedSocketOrigin(origin) {
  if (!origin || origin === 'null' || origin.startsWith('file://')) {
    return true;
  }

  // Accept any localhost origin regardless of port
  try {
    const url = new URL(origin);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/overlay', express.static(path.join(__dirname, 'overlay')));
  app.use('/sounds', express.static(path.join(__dirname, 'sounds')));
  app.use('/games', express.static(path.join(__dirname, '..', 'games')));

  app.use('/api/spotify', spotifyRoutes);
  app.use('/api/sticker-sounds', stickerSoundsRoutes);

  // Rutas de prueba locales (simular eventos sin live). Desactivar en produccion.
  if (process.env.NODE_ENV !== 'production') {
    app.get('/test/gift', (req, res) => {
      const diamonds = parseInt(req.query.d || '5', 10);
      const eventData = {
        uniqueId: req.query.u || 'tester',
        giftName: req.query.name || 'rose',
        repeatCount: Math.max(1, parseInt(req.query.c || '1', 10) || 1),
        diamondCount: Number.isFinite(diamonds) ? diamonds : 5,
        giftImage: null,
        profilePic: null,
        giftId: req.query.id || null,
        giftType: 0,
        repeatEnd: 1,
      };
      if (ioInstance) ioInstance.emit('gift', eventData);
      processEvent('gift', eventData);
      res.json({ ok: true, simulated: eventData });
    });

    app.get('/test/like', (req, res) => {
      const eventData = {
        uniqueId: req.query.u || 'tester',
        likeCount: Math.max(1, parseInt(req.query.c || '30', 10) || 1),
      };
      if (ioInstance) ioInstance.emit('like', eventData);
      processEvent('like', eventData);
      res.json({ ok: true, simulated: eventData });
    });

    app.get('/test/battle', (req, res) => {
      controlBattle(req.query.action || 'reset');
      res.json({ ok: true, action: req.query.action || 'reset' });
    });

    app.get('/test/chat', (req, res) => {
      const eventData = {
        uniqueId: req.query.u || 'tester',
        comment: req.query.msg || req.query.c || '',
        profilePic: null,
      };
      if (ioInstance) ioInstance.emit('chat', eventData);
      processEvent('chat', eventData);
      res.json({ ok: true, simulated: eventData });
    });
  }

  return app;
}

export async function startBackendServer({ port = DEFAULT_PORT } = {}) {
  if (httpServer) {
    return { app: appInstance, server: httpServer, io: ioInstance, port };
  }

  appInstance = createApp();
  httpServer = http.createServer(appInstance);

  ioInstance = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (isAllowedSocketOrigin(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin no permitido: ${origin}`));
      },
      methods: ['GET', 'POST'],
    },
  });

  socketHandler(ioInstance);

  let currentPort = port;

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`⚠️ Puerto ${currentPort} en uso, probando ${currentPort + 1}...`);
        currentPort++;
        httpServer.listen(currentPort);
      } else {
        httpServer?.off('listening', onListening);
        reject(error);
      }
    };

    const onListening = () => {
      httpServer?.off('error', onError);
      resolve();
    };

    httpServer.on('error', onError);
    httpServer.once('listening', onListening);
    httpServer.listen(currentPort);
  });

  console.log(`🚀 StreamSync Backend corriendo en http://localhost:${currentPort}`);
  console.log(`🎨 Overlay disponible en http://localhost:${currentPort}/overlay`);
  console.log(`🎵 Spotify API en http://localhost:${currentPort}/api/spotify`);

  return { app: appInstance, server: httpServer, io: ioInstance, port: currentPort };
}

export async function stopBackendServer() {
  if (!httpServer) {
    return;
  }

  const serverToClose = httpServer;
  const ioToClose = ioInstance;

  httpServer = null;
  ioInstance = null;
  appInstance = null;

  await new Promise((resolve) => {
    ioToClose?.close(() => {
      serverToClose.close(() => resolve());
    });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  startBackendServer().catch((error) => {
    console.error('❌ No se pudo iniciar el backend:', error);
    process.exitCode = 1;
  });
}
