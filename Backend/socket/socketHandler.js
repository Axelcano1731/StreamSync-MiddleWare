// socket/socketHandler.js
import { connectToTikTok } from '../controllers/tiktokController.js';

export default function socketHandler(io) {
  io.on('connection', (socket) => {
    console.log('Cliente conectado al frontend:', socket.id);

    socket.on('connectToTikTok', async (username) => {
      await connectToTikTok(username, io);
    });
  });
}
