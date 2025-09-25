// components/StatsPanel.jsx
import React from "react";

export default function StatsPanel({ liveStats }) {
  return (
    <div className="stats-panel">
      <h2 className="panel-title">Estadísticas en Vivo</h2>
      <div className="stat-item"><span>❤️</span> {liveStats.likes}</div>
      <div className="stat-item"><span>↪️</span> {liveStats.shares}</div>
      <div className="stat-item"><span>💬</span> {liveStats.comments}</div>
      <div className="stat-item"><span>➕</span> {liveStats.followers}</div>
      <div className="stat-item"><span>🎁</span> {liveStats.gifts}</div>
    </div>
  );
}
