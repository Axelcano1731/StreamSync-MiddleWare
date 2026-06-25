// components/SpotifyPanel.jsx
import React, { useState, useEffect } from "react";
import socket from "../services/socketService";

const params = new URLSearchParams(window.location.search);
const backendPort = params.get('backendPort') || '3000';
const API_BASE = `http://localhost:${backendPort}/api/spotify`;

export default function SpotifyPanel() {
  const [clientId, setClientId] = useState(
    localStorage.getItem("spotifyClientId") || ""
  );
  const [status, setStatus] = useState({ isConnected: false });
  const [nowPlaying, setNowPlaying] = useState(null);
  const [commandLog, setCommandLog] = useState([]);

  // Fetch Spotify status
  useEffect(() => {
    socket.emit("getSpotifyStatus", (s) => {
      if (s) setStatus(s);
    });

    socket.on("spotifyStatus", (s) => setStatus(s));
    socket.on("nowPlaying", (track) => setNowPlaying(track));
    socket.on("chatResponse", (data) => {
      setCommandLog((prev) => [data, ...prev].slice(0, 20));
    });

    // Poll now playing
    const interval = setInterval(() => {
      socket.emit("getSpotifyNowPlaying", (track) => {
        if (track) setNowPlaying(track);
      });
    }, 5000);

    return () => {
      clearInterval(interval);
      socket.off("spotifyStatus");
      socket.off("nowPlaying");
      socket.off("chatResponse");
    };
  }, []);

  const connectSpotify = () => {
    if (!clientId.trim()) return;
    localStorage.setItem("spotifyClientId", clientId.trim());
    window.open(
      `${API_BASE}/login?clientId=${encodeURIComponent(clientId.trim())}`,
      "_blank",
      "width=500,height=700"
    );
  };

  const skipSong = async () => {
    try {
      await fetch(`${API_BASE}/skip`, { method: "POST" });
    } catch (err) {
      console.error("Skip error:", err);
    }
  };

  const togglePlay = async () => {
    try {
      await fetch(`${API_BASE}/toggle`, { method: "POST" });
    } catch (err) {
      console.error("Toggle error:", err);
    }
  };

  const disconnect = async () => {
    try {
      await fetch(`${API_BASE}/disconnect`, { method: "POST" });
      setStatus({ isConnected: false });
      setNowPlaying(null);
    } catch (err) {
      console.error("Disconnect error:", err);
    }
  };

  return (
    <div className="page-enter">
      {/* Connection */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">🎵 Spotify</div>
            <div className="panel-subtitle">
              Conecta Spotify para que el chat controle la música
            </div>
          </div>
          <div
            className={`status-badge ${
              status.isConnected ? "online" : "offline"
            }`}
          >
            <span className="status-dot"></span>
            {status.isConnected ? "Conectado" : "Desconectado"}
          </div>
        </div>

        {!status.isConnected ? (
          <div style={{ maxWidth: 500 }}>
            <div className="input-group">
              <label>Spotify Client ID</label>
              <input
                className="input-field"
                type="text"
                placeholder="Tu Client ID de Spotify"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>
            <p
              style={{
                fontSize: "0.8em",
                color: "var(--text-muted)",
                marginBottom: 16,
                lineHeight: 1.6,
              }}
            >
              📋 <strong>Es gratis</strong>. Ve a{" "}
              <a
                href="https://developer.spotify.com/dashboard"
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--color-green)" }}
              >
                developer.spotify.com/dashboard
              </a>
              , crea una app, copia el <strong>Client ID</strong> y pégalo
              aquí. En la app de Spotify, agrega{" "}
              <code
                style={{
                  background: "var(--bg-input)",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                {API_BASE}/callback
              </code>{" "}
              como Redirect URI.
            </p>
            <button className="btn btn-primary" onClick={connectSpotify}>
              🔗 Conectar con Spotify
            </button>
          </div>
        ) : (
          <div>
            {/* Now Playing */}
            {nowPlaying && nowPlaying.isPlaying && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  background: "var(--bg-glass)",
                  padding: 16,
                  borderRadius: "var(--radius-md)",
                  marginBottom: 16,
                }}
              >
                {nowPlaying.albumArt && (
                  <img
                    src={nowPlaying.albumArt}
                    alt="Album"
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 8,
                      objectFit: "cover",
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "1em",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {nowPlaying.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.85em",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {nowPlaying.artist}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" onClick={togglePlay}>
                    ⏯️
                  </button>
                  <button className="btn" onClick={skipSong}>
                    ⏭️
                  </button>
                </div>
              </div>
            )}

            {/* Chat Commands Docs */}
            <div
              className="alert-config-card"
              style={{ marginBottom: 16 }}
            >
              <div className="alert-config-header">
                <div className="alert-config-title">
                  <span>💬</span> Comandos del Chat
                </div>
              </div>
              <table
                style={{
                  width: "100%",
                  fontSize: "0.85em",
                  borderCollapse: "collapse",
                }}
              >
                <tbody>
                  {[
                    ["!play <canción>", "Busca y reproduce una canción"],
                    ["!song / !np", "Muestra la canción actual"],
                    ["!skip", "Salta a la siguiente canción"],
                  ].map(([cmd, desc]) => (
                    <tr
                      key={cmd}
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                      }}
                    >
                      <td
                        style={{
                          padding: "8px 12px",
                          fontWeight: 600,
                          color: "var(--accent-secondary)",
                          fontFamily: "monospace",
                        }}
                      >
                        {cmd}
                      </td>
                      <td
                        style={{
                          padding: "8px 12px",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {desc}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button className="btn btn-danger" onClick={disconnect}>
              Desconectar Spotify
            </button>
          </div>
        )}
      </div>

      {/* Command Log */}
      {commandLog.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">📋 Log de Comandos</div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              maxHeight: 300,
              overflowY: "auto",
            }}
          >
            {commandLog.map((log, i) => (
              <div
                key={i}
                style={{
                  padding: "6px 10px",
                  fontSize: "0.85em",
                  color: "var(--text-secondary)",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                {log.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
