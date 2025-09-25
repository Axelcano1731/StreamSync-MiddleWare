// components/InteractionsPanel.jsx
import React from "react";

export default function InteractionsPanel({ events }) {
  const categories = [
    { key: "shares", label: "Compartidores ↪️", text: "Compartió el directo" },
    { key: "follows", label: "Seguidores ➕", text: "Comenzó a seguirte" },
    { key: "likes", label: "Likes ❤️", text: "Dio likes" },
    { key: "gifts", label: "Donaciones 🎁", text: "Envió" },
    { key: "chats", label: "Comentarios 💬", text: "" },
  ];

  return (
    <div className="interactions-panel-columns">
      <h2 className="panel-title">Interacciones en Tiempo Real</h2>
      <p className="panel-subtitle">
        Las interacciones se muestran en tiempo real en las siguientes categorías.
      </p>
      <div className="interactions-grid">
        {categories.map(({ key, label, text }) => (
          <div key={key} className="column">
            <h3>{label}</h3>
            <div className="column-list">
              {events[key].map((event, index) => (
                <div key={index} className="interaction-card">
                  <p className="interaction-text">
                    <span className="username">@{event.uniqueId}</span>
                    <br />
                    {key === "chats" ? event.comment : `${text} ${event.giftName || ""} x${event.repeatCount || ""}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
