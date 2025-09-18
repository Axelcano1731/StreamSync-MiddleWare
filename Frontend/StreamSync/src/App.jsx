import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:3000'); // Conectar con el backend

function App() {
  const [events, setEvents] = useState([]);
<<<<<<< HEAD
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState('offline'); // 'online', 'offline', 'error'

  useEffect(() => {
    // Recibir likes
    socket.on('like', data => {
      setEvents(prev => [...prev, `❤️ ${data.uniqueId} envió ${data.likeCount} likes`]);
    });

    // Recibir chats
=======

  useEffect(() => {
    // Likes
    socket.on('like', data => {
      setEvents(prev => [...prev, `❤️ ${data.uniqueId}`]);
    });

    // Chats
>>>>>>> origin/main
    socket.on('chat', data => {
      setEvents(prev => [...prev, `💬 ${data.uniqueId}: ${data.comment}`]);
    });

<<<<<<< HEAD
    // Recibir seguidores
    socket.on('follow', data => {
      setEvents(prev => [...prev, `➕ ${data.uniqueId} ahora sigue al streamer`]);
    });

    // Recibir gifts
=======
    // Seguidores
    socket.on('follow', data => {
      setEvents(prev => [...prev, `➕ ${data.uniqueId}`]);
    });

    // Donaciones
>>>>>>> origin/main
    socket.on('gift', data => {
      setEvents(prev => [
        ...prev,
        `🎁 ${data.uniqueId} envió ${data.giftName} x${data.repeatCount} (${data.diamondCount} diamantes)`
      ]);
    });

<<<<<<< HEAD
    // Recibir estado de conexión
    socket.on('status', data => {
      setStatus(data.status);
      if (data.status === 'error') {
        alert(`Error: ${data.message}`);
      }
    });

=======
>>>>>>> origin/main
    return () => {
      socket.off('like');
      socket.off('chat');
      socket.off('follow');
      socket.off('gift');
<<<<<<< HEAD
      socket.off('status');
    };
  }, []);

  const handleConnect = () => {
    if (!username.trim()) {
      alert("Por favor ingresa un nombre de usuario");
      return;
    }
    socket.emit('connectToTikTok', username.trim());
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', margin: 0 }}>
      
      {/* Columna izquierda (negra) */}
      <div style={{ flex: '0 0 400px', backgroundColor: '#0d0d0d', color: '#fff', padding: '20px' }}>
        <h1>StreamSync - TikTok Live</h1>

        {/* Input y botón para conectar */}
        <div>
          <input
            type="text"
            placeholder="Usuario de TikTok"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '10px',
              borderRadius: '8px',
              border: '1px solid #333',
              backgroundColor: '#1e1e1e',
              color: '#fff'
            }}
          />
          <button
            onClick={handleConnect}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#ff0050',
              border: 'none',
              color: 'white',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Conectar
          </button>
        </div>

        {/* Estado de conexión */}
        <div style={{ marginTop: '20px' }}>
          <strong>Estado:</strong>{" "}
          <span style={{ color: status === 'online' ? 'limegreen' : status === 'offline' ? 'red' : 'orange' }}>
            {status === 'online' ? 'En Vivo' : status === 'offline' ? 'Desconectado' : 'Error'}
          </span>
        </div>

        {/* Mantener los títulos originales */}
        <div style={{ marginTop: '30px' }}>
          <h2>Likes ❤️</h2>
          <h2>Mensajes 💬</h2>
          <h2>Seguidores ➕</h2>
          <h2>Donaciones 🎁</h2>
        </div>
      </div>

      {/* Columna derecha (gris) */}
=======
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
>>>>>>> origin/main
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
