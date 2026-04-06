import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import socketHandler from './socket/socketHandler.js';
import spotifyRoutes from './routes/spotifyRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:4173"],
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files for overlays and sounds
app.use('/overlay', express.static(path.join(__dirname, 'overlay')));
app.use('/sounds', express.static(path.join(__dirname, 'sounds')));
app.use('/games', express.static(path.join(__dirname, '..', 'games')));

// API Routes
app.use('/api/spotify', spotifyRoutes);

const PORT = 3000;

// Initialize socket handler with all events
socketHandler(io);

server.listen(PORT, () => {
  console.log(`🚀 StreamSync Backend corriendo en http://localhost:${PORT}`);
  console.log(`🎨 Overlay disponible en http://localhost:${PORT}/overlay`);
  console.log(`🎵 Spotify API en http://localhost:${PORT}/api/spotify`);
});
