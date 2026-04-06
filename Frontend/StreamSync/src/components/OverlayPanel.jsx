// components/OverlayPanel.jsx
import React, { useState } from "react";

const WIDGETS = [
  {
    key: "alerts",
    icon: "🔔",
    title: "Alertas + Goal + Chat",
    desc: "Alertas de regalos, seguidores, metas y chat box",
    url: "http://localhost:3000/overlay",
    size: "1920×1080",
  },
  {
    key: "top-donors",
    icon: "🏆",
    title: "Top Donadores",
    desc: "Leaderboard animado del top 5 donadores",
    url: "http://localhost:3000/overlay/top-donors.html",
    size: "300×350",
  },
  {
    key: "top-likes",
    icon: "❤️",
    title: "Top Likes",
    desc: "Ranking de quién más likes envió",
    url: "http://localhost:3000/overlay/top-likes.html",
    size: "300×350",
  },
  {
    key: "recent-followers",
    icon: "➕",
    title: "Seguidores Recientes",
    desc: "Lista animada de los últimos seguidores",
    url: "http://localhost:3000/overlay/recent-followers.html",
    size: "280×400",
  },
  {
    key: "ticker",
    icon: "⚡",
    title: "Event Ticker",
    desc: 'Barra estilo "breaking news" con eventos en tiempo real',
    url: "http://localhost:3000/overlay/ticker.html",
    size: "1920×40",
  },
  {
    key: "now-playing",
    icon: "🎵",
    title: "Now Playing (Spotify)",
    desc: "Widget de la canción que está reproduciendo en Spotify",
    url: "http://localhost:3000/overlay/now-playing.html",
    size: "320×120",
  },
];

export default function OverlayPanel() {
  const [copiedKey, setCopiedKey] = useState(null);
  const [previewKey, setPreviewKey] = useState(null);

  const copyUrl = (key, url) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  return (
    <div className="page-enter">
      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">🎨 Sistema de Overlays</div>
            <div className="panel-subtitle">
              {WIDGETS.length} widgets disponibles para OBS / TikTok LIVE Studio
            </div>
          </div>
        </div>

        {/* Setup Instructions */}
        <div
          className="alert-config-card"
          style={{ marginBottom: 20 }}
        >
          <div className="alert-config-header">
            <div className="alert-config-title">
              <span>📡</span> Cómo agregar un widget
            </div>
          </div>
          <div
            style={{
              fontSize: "0.85em",
              color: "var(--text-secondary)",
              lineHeight: 1.7,
            }}
          >
            <ol
              style={{
                paddingLeft: 20,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <li>Abre OBS Studio o TikTok LIVE Studio</li>
              <li>
                Agrega fuente → <strong>Navegador / Browser</strong>
              </li>
              <li>Copia la URL del widget que quieras</li>
              <li>Ajusta el tamaño recomendado</li>
              <li>
                Activa <em>"Apagar fuente cuando no sea visible"</em>
              </li>
            </ol>
          </div>
        </div>

        {/* Widget Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 14,
          }}
        >
          {WIDGETS.map((w) => (
            <div key={w.key} className="alert-config-card">
              <div className="alert-config-header">
                <div className="alert-config-title">
                  <span>{w.icon}</span>
                  {w.title}
                </div>
              </div>

              <p
                style={{
                  fontSize: "0.8em",
                  color: "var(--text-muted)",
                  marginBottom: 10,
                }}
              >
                {w.desc}
              </p>

              {/* URL bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "var(--bg-input)",
                  padding: "6px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                  marginBottom: 8,
                }}
              >
                <code
                  style={{
                    flex: 1,
                    color: "var(--accent-secondary)",
                    fontSize: "0.75em",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {w.url}
                </code>
                <button
                  className="btn"
                  style={{ padding: "4px 10px", fontSize: "0.75em" }}
                  onClick={() => copyUrl(w.key, w.url)}
                >
                  {copiedKey === w.key ? "✓" : "📋"}
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontSize: "0.75em",
                    color: "var(--text-muted)",
                  }}
                >
                  📐 {w.size}
                </span>
                <button
                  className="btn"
                  style={{ padding: "4px 10px", fontSize: "0.75em" }}
                  onClick={() =>
                    setPreviewKey(previewKey === w.key ? null : w.key)
                  }
                >
                  {previewKey === w.key ? "Cerrar" : "👁️ Preview"}
                </button>
              </div>

              {/* Preview iframe */}
              {previewKey === w.key && (
                <div
                  style={{
                    marginTop: 10,
                    background: "#000",
                    borderRadius: "var(--radius-sm)",
                    overflow: "hidden",
                    height: 200,
                    position: "relative",
                  }}
                >
                  <iframe
                    src={w.url}
                    style={{
                      width: "100%",
                      height: "100%",
                      border: "none",
                      position: "absolute",
                      top: 0,
                      left: 0,
                    }}
                    title={`Preview ${w.title}`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
