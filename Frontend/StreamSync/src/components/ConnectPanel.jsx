// components/ConnectPanel.jsx
import React from "react";

export default function ConnectPanel({ username, setUsername, connectToTikTok }) {
  return (
    <div className="connect-panel">
      <h2 className="panel-title">Conecta tu cuenta</h2>
      <p className="panel-subtitle">
        Introduce tu nombre de usuario de TikTok para verificar si estás en vivo.
      </p>
      <label htmlFor="username-input">Nombre de usuario</label>
      <input
        id="username-input"
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <button className="connect-button" onClick={connectToTikTok}>
        Conectar y Verificar
      </button>
    </div>
  );
}
