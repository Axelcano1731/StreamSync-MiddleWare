import React, { useEffect, useState } from "react";
import io from "socket.io-client";
import "./App.css"; // Importamos el archivo CSS externo

const socket = io("http://localhost:3000"); // Conectar con el backend

const USERNAME_KEY = "tiktokUsername";

function App() {
  const [events, setEvents] = useState({
    follows: [],
    likes: [],
    gifts: [],
    chats: [],
    shares: [],
  });
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("offline");
  const [liveStats, setLiveStats] = useState({
    likes: 0,
    comments: 0,
    followers: 0,
    shares: 0,
    gifts: 0,
  });

  // Lógica para manejar eventos y limitar el array a 20
  const handleNewEvent = (data, type) => {
    setEvents((prev) => {
      const newEvents = { ...prev };
      const eventArray = newEvents[`${type}s`];
      newEvents[`${type}s`] = [data, ...eventArray].slice(0, 20);
      return newEvents;
    });
  };

  useEffect(() => {
    // 1. Cargar el nombre de usuario de localStorage al iniciar
    const savedUsername = localStorage.getItem(USERNAME_KEY);
    if (savedUsername) {
      setUsername(savedUsername);
    }

    // Los oyentes se configuran aquí para que se reinicien cuando cambia el username
    socket.on("like", (data) => {
      handleNewEvent(data, "like");
      setLiveStats((prev) => ({ ...prev, likes: prev.likes + data.likeCount }));
    });

    socket.on("chat", (data) => {
      handleNewEvent(data, "chat");
      setLiveStats((prev) => ({ ...prev, comments: prev.comments + 1 }));
    });

    socket.on("follow", (data) => {
      handleNewEvent(data, "follow");
      setLiveStats((prev) => ({ ...prev, followers: prev.followers + 1 }));
    });

    socket.on("share", (data) => {
      handleNewEvent(data, "share");
      setLiveStats((prev) => ({ ...prev, shares: prev.shares + 1 }));
    });

    socket.on("gift", (data) => {
      handleNewEvent(data, "gift");
      setLiveStats((prev) => ({ ...prev, gifts: prev.gifts + 1 }));
    });

    // 3. Manejar estado de conexión y errores
    socket.on("status", (data) => {
      setStatus(data.status);
      if (data.status === "error") {
        alert(`Error: ${data.message}`);
      }
    });

    // 4. Limpiar los listeners cuando el componente se desmonte o el username cambie
    return () => {
      socket.off("like");
      socket.off("chat");
      socket.off("follow");
      socket.off("gift");
      socket.off("status");
      socket.off("share");
    };
  }, []); // El array vacío asegura que esto solo se ejecute una vez

  // Lógica para guardar el usuario y conectar
  const handleConnect = () => {
    if (!username.trim()) {
      alert("Por favor, ingresa un nombre de usuario.");
      return;
    }
    // Guardar en localStorage
    localStorage.setItem(USERNAME_KEY, username.trim());

    // Se reinician estados y se desconecta primero para asegurar una conexión limpia
    socket.emit("disconnectFromTikTok");
    setEvents({ follows: [], likes: [], gifts: [], shares: [], chats: [] });
    setLiveStats({ likes: 0, comments: 0, followers: 0, shares: 0, gifts: 0 });
    socket.emit("connectToTikTok", username.trim());
  };

  // Lógica para desconectar y limpiar estados
  const handleDisconnect = () => {
    socket.emit("disconnectFromTikTok");
    setStatus("offline");
    setEvents({ follows: [], likes: [], gifts: [], shares: [], chats: [] });
    setLiveStats({ likes: 0, comments: 0, followers: 0, shares: 0, gifts: 0 });
    // Mantener el nombre de usuario en el input para que pueda reconectar
  };

  const renderContent = () => {
    if (status === "online") {
      return (
        <div className="main-container">
          <div className="stats-panel">
            <h2 className="panel-title">Estadísticas en Vivo</h2>
            <div className="stat-item">
              <span className="stat-icon">❤️</span>
              <span className="stat-count">{liveStats.likes}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">↪️</span>
              <span className="stat-count">{liveStats.shares}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">💬</span>
              <span className="stat-count">{liveStats.comments}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">➕</span>
              <span className="stat-count">{liveStats.followers}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">🎁</span>
              <span className="stat-count">{liveStats.gifts}</span>
            </div>
          </div>
          <div className="interactions-panel-columns">
            <h2 className="panel-title">Interacciones en Tiempo Real</h2>
            <p className="panel-subtitle">
              Las interacciones se muestran en tiempo real en las siguientes
              categorías.
            </p>
            <div className="interactions-grid">
              <div className="column">
                <h3>Compartidores ↪️</h3>
                <div className="column-list">
                  {events.shares.map((event, index) => (
                    <div key={index} className="interaction-card">
                      <p className="interaction-text">
                        <span className="username">@{event.uniqueId}</span>
                        <br />
                        Compartió el directo
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="column">
                <h3>Seguidores ➕</h3>
                <div className="column-list">
                  {events.follows.map((event, index) => (
                    <div key={index} className="interaction-card">
                      <p className="interaction-text">
                        <span className="username">@{event.uniqueId}</span>
                        <br />
                        Comenzó a seguirte
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="column">
                <h3>Likes ❤️</h3>
                <div className="column-list">
                  {events.likes.map((event, index) => (
                    <div key={index} className="interaction-card">
                      <p className="interaction-text">
                        <span className="username">@{event.uniqueId}</span>
                        <br />
                        Dio {event.count} likes
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="column">
                <h3>Donaciones 🎁</h3>
                <div className="column-list">
                  {events.gifts.map((event, index) => (
                    <div key={index} className="interaction-card">
                      <p className="interaction-text">
                        <span className="username">@{event.uniqueId}</span>
                        <br />
                        Envió {event.giftName} x{event.repeatCount}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="column">
                <h3>Comentarios 💬</h3>
                <div className="column-list">
                  {events.chats.map((event, index) => (
                    <div key={index} className="interaction-card">
                      <p className="interaction-text">
                        <span className="username">@{event.uniqueId}</span>
                        <br />
                        {event.comment}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="main-container center-content">
          <div className="connect-panel">
            <h2 className="panel-title">Conecta tu cuenta</h2>
            <p className="panel-subtitle">
              Introduce tu nombre de usuario de TikTok para verificar si estás
              en vivo.
            </p>
            <label htmlFor="username-input">Nombre de usuario</label>
            <input
              id="username-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <button className="connect-button" onClick={handleConnect}>
              Conectar y Verificar
            </button>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="app-container">
      <div className="top-bar">
        <div className="logo-section">
          <img
            src="https://www.svgrepo.com/show/303115/tiktok-logo-tiktok.svg"
            alt="TikTok Logo"
            className="tiktok-icon"
          />
          <span className="app-name">
            {status === "online" ? "Monitor en Vivo" : "TikTok Live Monitor"}
          </span>
        </div>
        <div className="status-section">
          {status === "online" && (
            <>
              <span className="live-status-indicator"></span>
              <span className="live-text">EN VIVO {username} </span>
              <button className="disconnect-button" onClick={handleDisconnect}>
                Desconectar
              </button>
            </>
          )}
          {status === "offline" && (
            <span className="offline-text">No está en vivo</span>
          )}
        </div>
      </div>
      {renderContent()}
    </div>
  );
}

export default App;
