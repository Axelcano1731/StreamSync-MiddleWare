import React, { useState, useRef, useEffect } from "react";
import socket from "../services/socketService";

const params = new URLSearchParams(window.location.search);
const backendPort = params.get('backendPort') || '3000';
const BATTLE_URL = `http://localhost:${backendPort}/overlay/avatar-battle-overlay.html`;

export default function AvatarBattlePanel() {
  const [launched, setLaunched] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef(null);

  useEffect(() => {
    socket.emit("getAlertConfig", (cfg) => {
      setEnabled(cfg?.avatarBattle?.enabled !== false);
    });

    const handleConfig = (cfg) => {
      setEnabled(cfg?.avatarBattle?.enabled !== false);
    };

    socket.on("alertConfig", handleConfig);
    return () => socket.off("alertConfig", handleConfig);
  }, []);

  function handleLaunch() {
    setLaunched(true);
  }

  function handleOpenWindow() {
    window.open(BATTLE_URL, "_blank", "width=1280,height=720,toolbar=no,menubar=no");
  }

  function handleReload() {
    if (iframeRef.current) {
      iframeRef.current.src = BATTLE_URL;
    }
  }

  function handleCopyUrl() {
    navigator.clipboard.writeText(BATTLE_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function handleReset() {
    socket.emit("battleControl", "reset", () => {});
  }

  function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    socket.emit("updateAlertConfig", {
      section: "avatarBattle",
      config: { enabled: next },
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header card */}
      <div className="panel" style={{ marginBottom: 0 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">⚔️ Avatar Battle — Juego de Viewers</div>
            <div className="panel-subtitle">
              Los regalos generan guerreros y los likes los curan · Pelea de equipos en vivo
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <label className="toggle" title="Activar o pausar el juego">
              <input type="checkbox" checked={enabled} onChange={toggleEnabled} />
              <span className="toggle-slider"></span>
            </label>
            <button
              className="btn"
              onClick={handleCopyUrl}
              title="Copiar URL para Browser Source en OBS"
              id="battle-copy-url-btn"
            >
              {copied ? "✓ Copiada" : "📋 Copiar URL"}
            </button>
            <button
              className="btn"
              onClick={handleOpenWindow}
              title="Abrir en ventana separada (recomendado para capturar en OBS)"
              id="battle-open-window-btn"
            >
              🪟 Ventana separada
            </button>
            <button
              className="btn btn-danger"
              onClick={handleReset}
              title="Reiniciar la ronda y limpiar el ring"
              id="battle-reset-btn"
            >
              🔄 Reiniciar ronda
            </button>
            {!launched ? (
              <button
                className="btn btn-primary"
                onClick={handleLaunch}
                id="battle-launch-btn"
              >
                🚀 Iniciar Battle
              </button>
            ) : (
              <button
                className="btn"
                onClick={handleReload}
                title="Recargar el overlay embebido"
                id="battle-reload-btn"
              >
                ♻️ Recargar
              </button>
            )}
          </div>
        </div>

        {/* Info chips */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px" }}>
          <div style={chipStyle("#1e3a5f", "#5ad7ff")}>
            🔵 Equipo A · guerreros entran balanceados
          </div>
          <div style={chipStyle("#450a0a", "#ff7a6b")}>
            🔴 Equipo B · el rival
          </div>
          <div style={chipStyle("#14532d", "#4ade80")}>
            🎁 Regalo · spawnea guerrero (HP/poder por 💎)
          </div>
          <div style={chipStyle("#4c1d95", "#8b5cf6")}>
            ❤️ Likes · curan al equipo
          </div>
          <div style={chipStyle("#78350f", "#fbbf24")}>
            ☄️ 100💎 · meteoro global
          </div>
        </div>
      </div>

      {/* Game iframe */}
      {launched ? (
        <div
          style={{
            borderRadius: "14px",
            overflow: "hidden",
            border: "1px solid rgba(90,215,255,0.3)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            background: "#0d1117",
            position: "relative",
          }}
        >
          <iframe
            ref={iframeRef}
            src={BATTLE_URL}
            title="Avatar Battle"
            id="battle-iframe"
            style={{
              width: "100%",
              height: "640px",
              border: "none",
              display: "block",
            }}
            allow="autoplay"
          />
        </div>
      ) : (
        /* Launch placeholder */
        <div
          style={{
            background: "linear-gradient(135deg, #0d1117 0%, #0a1e2e 50%, #1a0a14 100%)",
            border: "1px dashed rgba(90,215,255,0.4)",
            borderRadius: "14px",
            padding: "80px 24px",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.3s",
          }}
          onClick={handleLaunch}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(90,215,255,0.8)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(90,215,255,0.4)";
          }}
        >
          <div style={{ fontSize: "4em", marginBottom: "16px" }}>⚔️🛡️</div>
          <div
            style={{
              fontSize: "1.4em",
              fontWeight: 700,
              color: "#e2e8f0",
              marginBottom: "8px",
            }}
          >
            Avatar Battle
          </div>
          <div style={{ color: "#94a3b8", fontSize: "0.95em", marginBottom: "28px" }}>
            Haz clic para previsualizar el ring dentro del panel,
            <br />o abre en una ventana separada para capturarlo en OBS
          </div>
          <button
            className="btn btn-primary"
            style={{ fontSize: "1em", padding: "12px 32px" }}
            onClick={(e) => {
              e.stopPropagation();
              handleLaunch();
            }}
            id="battle-launch-placeholder-btn"
          >
            🚀 Iniciar Battle
          </button>
        </div>
      )}

      {/* Tips */}
      <div className="panel" style={{ marginBottom: 0 }}>
        <div className="panel-title" style={{ marginBottom: "12px" }}>
          💡 Cómo usar Avatar Battle
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "12px",
          }}
        >
          {TIPS.map((tip, i) => (
            <div
              key={i}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "10px",
                padding: "12px 14px",
                fontSize: "0.85em",
                color: "#94a3b8",
                lineHeight: "1.5",
              }}
            >
              <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{tip.title}</span>
              <br />
              {tip.desc}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function chipStyle(bg, color) {
  return {
    background: bg,
    color: color,
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "0.78em",
    fontWeight: 600,
    border: `1px solid ${color}33`,
  };
}

const TIPS = [
  {
    title: "🪟 Ventana separada / URL",
    desc: "Copia la URL o abre la ventana separada y agrégala como Browser Source (1920x1080) en OBS o TikTok LIVE Studio.",
  },
  {
    title: "🎁 Regalos = guerreros",
    desc: "Cada regalo de un viewer mete un guerrero al ring. A más diamantes, más HP y poder (espada, martillo...).",
  },
  {
    title: "❤️ Likes = curación",
    desc: "Cada cierta cantidad de likes acumulados se lanza una oleada de curación para el equipo.",
  },
  {
    title: "🔄 Reiniciar ronda",
    desc: "Limpia el ring y empieza una nueva pelea sin tener que recargar el overlay en OBS.",
  },
  {
    title: "⏸️ Activado",
    desc: "El interruptor pausa o reactiva el juego sin cerrar el overlay. Útil entre segmentos del stream.",
  },
];
