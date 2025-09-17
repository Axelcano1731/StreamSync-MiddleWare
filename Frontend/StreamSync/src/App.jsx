import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:3000'); // Conectar con el backend

function App() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    // Likes
    socket.on('like', data => {
      setEvents(prev => [...prev, `❤️ ${data.uniqueId}`]);
    });

    // Chats
    socket.on('chat', data => {
      setEvents(prev => [...prev, `💬 ${data.uniqueId}: ${data.comment}`]);
    });

    // Seguidores
    socket.on('follow', data => {
      setEvents(prev => [...prev, `➕ ${data.uniqueId}`]);
    });

    // Donaciones
    socket.on('gift', data => {
      setEvents(prev => [
        ...prev,
        `🎁 ${data.uniqueId} envió ${data.giftName} x${data.repeatCount} (${data.diamondCount} diamantes)`
      ]);
    });

    return () => {
      socket.off('like');
      socket.off('chat');
      socket.off('follow');
      socket.off('gift');
    };
  }, []);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', margin: 0 }}>
      {/* Columna izquierda (negra) */}
      <div style={{ flex: '0 0 400px', backgroundColor: '#0d0d0d', color: '#fff', padding: '20px' }}>
        <h1>StreamSync - TikTok Live</h1>
        <h2>Likes ❤️</h2>
        <h2>Mensajes 💬</h2>
        <h2>Seguidores ➕</h2>
        <h2>Donaciones 🎁</h2>
      </div>

      {/* Columna derecha (gris, llena el resto del espacio) */}
      <div style={{ flex: 1, backgroundColor: '#1e1e1e', color: '#fff', padding: '20px', overflowY: 'auto' }}>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {events.map((event, index) => (
            <li key={index} style={{ marginBottom: '8px' }}>{event}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
