// components/EventLog.jsx
import React, { useState } from "react";

const EVENT_ICONS = {
  chats: "💬",
  gifts: "🎁",
  follows: "➕",
  shares: "↪️",
  likes: "❤️",
  memberJoins: "👋",
};

const EVENT_LABELS = {
  chats: "Comentario",
  gifts: "Donación",
  follows: "Seguidor",
  shares: "Compartida",
  likes: "Likes",
  memberJoins: "Unión",
};

function flattenEvents(events) {
  const all = [];

  Object.entries(events).forEach(([key, list]) => {
    if (!Array.isArray(list)) return;
    list.forEach((event) => {
      all.push({
        ...event,
        _type: key,
        _time: event._time || Date.now(),
      });
    });
  });

  return all.sort((a, b) => b._time - a._time);
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getEventDescription(event) {
  switch (event._type) {
    case "chats":
      return event.comment || "";
    case "gifts":
      return `${event.repeatCount || 1}× ${event.giftName || "Regalo"} ${
        event.diamondCount ? `(${event.diamondCount}💎)` : ""
      }`;
    case "follows":
      return "Comenzó a seguirte";
    case "shares":
      return "Compartió el directo";
    case "likes":
      return `${event.likeCount || 1} likes`;
    case "memberJoins":
      return "Se unió al directo";
    default:
      return "";
  }
}

export default function EventLog({ events }) {
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const allEvents = flattenEvents(events);

  const filtered = allEvents.filter((e) => {
    if (filter !== "all" && e._type !== filter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const user = (e.uniqueId || "").toLowerCase();
      const desc = getEventDescription(e).toLowerCase();
      if (!user.includes(query) && !desc.includes(query)) return false;
    }
    return true;
  });

  const filters = [
    { key: "all", label: "Todo" },
    { key: "chats", label: "💬" },
    { key: "gifts", label: "🎁" },
    { key: "follows", label: "➕" },
    { key: "shares", label: "↪️" },
    { key: "likes", label: "❤️" },
    { key: "memberJoins", label: "👋" },
  ];

  return (
    <div className="page-enter">
      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">📋 Log de Eventos</div>
            <div className="panel-subtitle">
              {filtered.length} eventos{" "}
              {filter !== "all" ? `(${EVENT_LABELS[filter]})` : ""}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div className="filter-tabs" style={{ flex: 1 }}>
            {filters.map((f) => (
              <button
                key={f.key}
                className={`filter-tab ${filter === f.key ? "active" : ""}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            className="input-field"
            style={{ maxWidth: 200 }}
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="event-log">
          {filtered.length > 0 ? (
            filtered.slice(0, 200).map((event, i) => (
              <div key={`${event._type}-${i}`} className="event-log-item">
                <span className="event-log-time">{formatTime(event._time)}</span>
                <span className="event-log-icon">
                  {EVENT_ICONS[event._type] || "🔔"}
                </span>
                <div className="event-log-content">
                  <span className="event-log-user">@{event.uniqueId}</span>{" "}
                  {getEventDescription(event)}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-text">No hay eventos que mostrar</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
