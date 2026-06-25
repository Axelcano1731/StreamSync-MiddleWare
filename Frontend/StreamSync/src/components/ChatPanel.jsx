// components/ChatPanel.jsx
import React, { useRef, useEffect, useState, useCallback } from "react";

function formatTime(ts) {
  return new Date(ts || Date.now()).toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function ChatPanel({ events }) {
  const chats = events?.chats || [];
  const feedRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [chats.length, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!feedRef.current) return;
    setAutoScroll(feedRef.current.scrollTop > -50);
  }, []);

  return (
    <div className="panel page-enter chat-panel-full">
      <div className="panel-header">
        <div>
          <div className="panel-title">💬 Chat en Vivo</div>
          <div className="panel-subtitle">{chats.length} mensajes recibidos</div>
        </div>
        <button
          className={`autoscroll-btn ${autoScroll ? "active" : ""}`}
          onClick={() => setAutoScroll((v) => !v)}
          title={autoScroll ? "Auto-scroll activo" : "Auto-scroll pausado"}
        >
          {autoScroll ? "🟢 Live" : "⏸ Pausado"}
        </button>
      </div>

      <div
        className="chat-feed chat-feed-full"
        ref={feedRef}
        onScroll={handleScroll}
      >
        {chats.length > 0 ? (
          chats.map((msg, i) => (
            <div
              key={`chat-${i}-${msg._time}`}
              className="chat-message chat-message-full"
            >
              <div className="chat-avatar">
                {msg.profilePic ? (
                  <img src={msg.profilePic} alt="" />
                ) : (
                  "👤"
                )}
              </div>
              <div className="chat-body">
                <div className="chat-meta-row">
                  <span className="chat-username">@{msg.uniqueId}</span>
                  {msg.isModerator && (
                    <span className="user-badge mod-badge">MOD</span>
                  )}
                  {msg.isSubscriber && (
                    <span className="user-badge sub-badge">SUB</span>
                  )}
                  {msg.topFanLevel > 0 && (
                    <span className="user-badge fan-badge">
                      Fan Lv.{msg.topFanLevel}
                    </span>
                  )}
                  {msg.followRole > 0 && (
                    <span className="user-badge follow-badge">Siguiendo</span>
                  )}
                  <span className="chat-time">{formatTime(msg._time)}</span>
                </div>
                <span className="chat-text">{msg.comment}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <div className="empty-state-text">
              Los mensajes del chat aparecerán aquí en tiempo real
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
