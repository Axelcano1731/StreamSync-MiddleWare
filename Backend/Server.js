import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import socketHandler from './socket/socketHandler.js';
import spotifyRoutes from './routes/spotifyRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PORT = Number(process.env.PORT || 3000);
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
]);

let appInstance = null;
let ioInstance = null;
let httpServer = null;

function isAllowedSocketOrigin(origin) {
  if (!origin || origin === 'null' || origin.startsWith('file://')) {
    return true;
  }

  return ALLOWED_ORIGINS.has(origin);
}

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/overlay', express.static(path.join(__dirname, 'overlay')));
  app.use('/sounds', express.static(path.join(__dirname, 'sounds')));
  app.use('/games', express.static(path.join(__dirname, '..', 'games')));

  app.use('/api/spotify', spotifyRoutes);

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

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      httpServer?.off('listening', onListening);
      reject(error);
    };

    const onListening = () => {
      httpServer?.off('error', onError);
      resolve();
    };

    httpServer.once('error', onError);
    httpServer.once('listening', onListening);
    httpServer.listen(port);
  });

  console.log(`🚀 StreamSync Backend corriendo en http://localhost:${port}`);
  console.log(`🎨 Overlay disponible en http://localhost:${port}/overlay`);
  console.log(`🎵 Spotify API en http://localhost:${port}/api/spotify`);

  return { app: appInstance, server: httpServer, io: ioInstance, port };
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
