import React from "react";

const NAV_ITEMS = [
  { key: "dashboard", icon: "📊", label: "Dashboard" },
  { key: "chat", icon: "💬", label: "Chat" },
  { key: "alerts", icon: "🔔", label: "Alertas" },
  { key: "events", icon: "📋", label: "Eventos" },
  { key: "overlay", icon: "🎨", label: "Overlays" },
  { key: "automation", icon: "🧩", label: "Automatización" },
  { key: "spotify", icon: "🎵", label: "Spotify" },
];

const BOTTOM_ITEMS = [{ key: "settings", icon: "⚙️", label: "Configuración" }];

export default function Sidebar({ currentPage, onNavigate }) {
  return (
    <nav className="sidebar">
      <div className="sidebar-logo">S</div>

      <div className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={`sidebar-item ${currentPage === item.key ? "active" : ""}`}
            onClick={() => onNavigate(item.key)}
          >
            {item.icon}
            <span className="sidebar-tooltip">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-bottom">
        {BOTTOM_ITEMS.map((item) => (
          <button
            key={item.key}
            className={`sidebar-item ${currentPage === item.key ? "active" : ""}`}
            onClick={() => onNavigate(item.key)}
          >
            {item.icon}
            <span className="sidebar-tooltip">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
