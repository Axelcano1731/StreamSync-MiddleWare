// components/InteractionsPanel.jsx
import React, { useRef, useEffect, useState, useCallback } from "react";

const EVENT_CONFIG = {
  chats: { icon: "💬", color: "var(--color-purple)" },
  gifts: { icon: "🎁", color: "var(--color-yellow)" },
  follows: { icon: "➕", color: "var(--color-green)" },
  shares: { icon: "↪️", color: "var(--color-blue)" },
  likes: { icon: "❤️", color: "var(--color-red)" },
  memberJoins: { icon: "👋", color: "var(--color-purple)" },
};

function formatTime(date) {
  return new Date(date || Date.now()).toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildUnifiedFeed(events) {
  const feed = [];

  if (events.chats) {
    events.chats.forEach((e) =>
      feed.push({ ...e, _type: "chats", _time: e._time || Date.now() })
    );
  }
  if (events.gifts) {
    events.gifts.forEach((e) =>
      feed.push({ ...e, _type: "gifts", _time: e._time || Date.now() })
    );
  }
  if (events.follows) {
    events.follows.forEach((e) =>
      feed.push({ ...e, _type: "follows", _time: e._time || Date.now() })
    );
  }
  if (events.shares) {
    events.shares.forEach((e) =>
      feed.push({ ...e, _type: "shares", _time: e._time || Date.now() })
    );
  }
  if (events.likes) {
    events.likes.forEach((e) =>
      feed.push({ ...e, _type: "likes", _time: e._time || Date.now() })
    );
  }
  if (events.memberJoins) {
    events.memberJoins.forEach((e) =>
      feed.push({ ...e, _type: "memberJoins", _time: e._time || Date.now() })
    );
  }

  return feed.sort((a, b) => b._time - a._time).slice(0, 100);
}

function renderEventContent(event) {
  switch (event._type) {
    case "chats":
      return <span className="chat-text">{event.comment}</span>;
    case "gifts":
      return (
        <span className="event-badge gift">
          🎁 {event.repeatCount || 1}× {event.giftName || "Regalo"}{" "}
          {event.diamondCount ? `• ${event.diamondCount}💎` : ""}
        </span>
      );
    case "follows":
      return <span className="event-badge follow">➕ Comenzó a seguirte</span>;
    case "shares":
      return <span className="event-badge share">↪️ Compartió el directo</span>;
    case "likes":
      return (
        <span className="event-badge like">
          ❤️ {event.likeCount || 1} likes
        </span>
      );
    case "memberJoins":
      return <span className="event-badge join">👋 Se unió al directo</span>;
    default:
      return null;
  }
}

export default function InteractionsPanel({ events, topDonors = [] }) {
  const feedRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState("all");

  const feed = buildUnifiedFeed(events);

  const filteredFeed =
    filter === "all" ? feed : feed.filter((e) => e._type === filter);

  const handleScroll = useCallback(() => {
    if (!feedRef.current) return;
    const { scrollTop } = feedRef.current;
    setAutoScroll(scrollTop > -50);
  }, []);

  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [feed.length, autoScroll]);

  const filters = [
    { key: "all", label: "Todo" },
    { key: "chats", label: "💬 Chat" },
    { key: "gifts", label: "🎁 Gifts" },
    { key: "follows", label: "➕ Follows" },
    { key: "shares", label: "↪️ Shares" },
    { key: "likes", label: "❤️ Likes" },
  ];

  return (
    <div className="interactions-layout page-enter">
      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Feed en Tiempo Real</div>
            <div className="panel-subtitle">
              {feed.length} eventos capturados
            </div>
          </div>
        </div>

        <div className="filter-tabs">
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

        <div className="chat-feed" ref={feedRef} onScroll={handleScroll}>
          {filteredFeed.length > 0 ? (
            filteredFeed.map((event, index) => (
              <div key={`${event._type}-${index}-${event._time}`} className="chat-message">
                <div className="chat-avatar">
                  {event.profilePic ? (
                    <img src={event.profilePic} alt="" />
                  ) : (
                    (EVENT_CONFIG[event._type]?.icon || "👤")
                  )}
                </div>
                <div className="chat-body">
                  <span className="chat-username">@{event.uniqueId}</span>
                  <span className="chat-time">{formatTime(event._time)}</span>
                  <br />
                  {renderEventContent(event)}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📡</div>
              <div className="empty-state-text">
                Esperando eventos del stream...
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="side-panel">
        {/* Top Donors */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">🏆 Top Donadores</div>
          </div>
          <div className="donor-list">
            {topDonors.length > 0 ? (
              topDonors.slice(0, 5).map((donor, i) => (
                <div key={donor.uniqueId} className="donor-item">
                  <div
                    className={`donor-rank ${
                      i === 0
                        ? "top-1"
                        : i === 1
                        ? "top-2"
                        : i === 2
                        ? "top-3"
                        : "top-other"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <div className="donor-name">@{donor.uniqueId}</div>
                  <div className="donor-amount">{donor.totalDiamonds} 💎</div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <div className="empty-state-text">Sin donaciones aún</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
