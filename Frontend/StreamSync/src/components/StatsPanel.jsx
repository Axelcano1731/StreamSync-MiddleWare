// components/StatsPanel.jsx
import React from "react";

const STAT_CONFIG = [
  { key: "likes", icon: "❤️", label: "Likes", className: "likes" },
  { key: "comments", icon: "💬", label: "Comentarios", className: "comments" },
  { key: "followers", icon: "➕", label: "Seguidores", className: "followers" },
  { key: "shares", icon: "↪️", label: "Compartidas", className: "shares" },
  { key: "gifts", icon: "🎁", label: "Regalos", className: "gifts" },
  { key: "viewers", icon: "👁️", label: "Espectadores", className: "viewers" },
];

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return String(num);
}

export default function StatsPanel({ liveStats }) {
  return (
    <div className="stats-grid">
      {STAT_CONFIG.map(({ key, icon, label, className }) => (
        <div key={key} className="stat-card">
          <div className={`stat-icon-box ${className}`}>{icon}</div>
          <div className="stat-info">
            <div className="stat-value">{formatNumber(liveStats[key] || 0)}</div>
            <div className="stat-label">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
