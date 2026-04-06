// components/ConnectPanel.jsx
import React from "react";

export default function ConnectPanel({ username, setUsername, connectToTikTok }) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter") connectToTikTok();
  };

  return (
    <div className="connect-panel">
      <div className="connect-card">
        <div className="connect-icon">📡</div>
        <h2>Conecta tu cuenta</h2>
        <p>
          Introduce tu nombre de usuario de TikTok para conectar con tu
          transmisión en vivo.
        </p>
        <div className="input-group">
          <label htmlFor="username-input">Nombre de usuario</label>
          <input
            id="username-input"
            className="input-field"
            type="text"
            placeholder="usuario_tiktok"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <button className="connect-btn" onClick={connectToTikTok}>
          Conectar y Verificar
        </button>
      </div>
    </div>
  );
}
