// components/TopBar.jsx
import React from "react";

export default function TopBar({ status, username, disconnectFromTikTok, pageTitle }) {
  const statusLabels = {
    online: "EN VIVO",
    offline: "Desconectado",
    reconnecting: "Reconectando...",
    ended: "Stream finalizado",
    error: "Error",
  };

  return (
    <div className="top-bar">
      <div className="topbar-left">
        <span className="topbar-title">{pageTitle || "Dashboard"}</span>
      </div>

      <div className="topbar-right">
        {status === "online" && username && (
          <span style={{ fontSize: "0.85em", color: "var(--text-secondary)" }}>
            @{username}
          </span>
        )}

        <div className={`status-badge ${status}`}>
          <span className="status-dot"></span>
          {statusLabels[status] || status}
        </div>

        {status === "online" && (
          <button className="btn btn-danger" onClick={disconnectFromTikTok}>
            Desconectar
          </button>
        )}
      </div>
    </div>
  );
}
