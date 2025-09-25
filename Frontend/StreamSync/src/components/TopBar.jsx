// components/TopBar.jsx
import React from "react";

export default function TopBar({ status, username, disconnectFromTikTok }) {
  return (
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
        {status === "online" ? (
          <>
            <span className="live-status-indicator"></span>
            <span className="live-text">EN VIVO {username}</span>
            <button className="disconnect-button" onClick={disconnectFromTikTok}>
              Desconectar
            </button>
          </>
        ) : (
          <span className="offline-text">No está en vivo</span>
        )}
      </div>
    </div>
  );
}
