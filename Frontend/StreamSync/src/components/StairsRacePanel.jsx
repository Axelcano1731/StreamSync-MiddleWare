import React, { useState, useRef, useEffect } from "react";
import socket from "../services/socketService";

const params = new URLSearchParams(window.location.search);
const backendPort = params.get('backendPort') || '3000';
const BASE_URL = `http://localhost:${backendPort}/overlay/stairs-race-overlay.html`;

const MODE_LABELS = {
  tug: "🪢 Tira y afloja (1 escalador)",
  race: "🏁 Carrera (2 escaladores)",
};

export default function StairsRacePanel() {
  const [launched, setLaunched] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState("tug");
  const [goal, setGoal] = useState(1000);
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef(null);

  const overlayUrl = `${BASE_URL}?mode=${mode}&goal=${goal}`;

  useEffect(() => {
    const apply = (cfg) => {
      const s = cfg?.stairsRace;
      if (!s) return;
      setEnabled(s.enabled !== false);
      setMode(s.mode === "race" ? "race" : "tug");
      setGoal(Number(s.goal) || 1000);
    };
    socket.emit("getAlertConfig", apply);
    socket.on("alertConfig", apply);
    return () => socket.off("alertConfig", apply);
  }, []);

  function patchConfig(partial) {
    socket.emit("updateAlertConfig", { section: "stairsRace", config: partial });
  }

  function handleLaunch() {
    setLaunched(true);
  }

  function handleOpenWindow() {
    window.open(overlayUrl, "_blank", "width=1280,height=720,toolbar=no,menubar=no");
  }

  function handleReload() {
    if (iframeRef.current) iframeRef.current.src = overlayUrl;
  }

  function handleCopyUrl() {
    navigator.clipboard.writeText(overlayUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function handleReset() {
    socket.emit("stairsControl", "reset", () => {});
  }

  function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    patchConfig({ enabled: next });
  }

  function changeMode(next) {
    setMode(next);
    patchConfig({ mode: next });
  }

  function changeGoal(value) {
    const g = Math.max(50, Number(value) || 0);
    setGoal(g);
    patchConfig({ goal: g });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header card */}
      <div className="panel" style={{ marginBottom: 0 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">🪜 Stairs Race — Juego de Viewers</div>
            <div className="panel-subtitle">
              Héroes suben y villanos bajan con donaciones · El chat elige bando con keywords
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <label className="toggle" title="Activar o pausar el juego">
              <input type="checkbox" checked={enabled} onChange={toggleEnabled} />
              <span className="toggle-slider"></span>
            </label>
            <button className="btn" onClick={handleCopyUrl} id="stairs-copy-url-btn"
              title="Copiar URL para Browser Source en OBS">
              {copied ? "✓ Copiada" : "📋 Copiar URL"}
            </button>
            <button className="btn" onClick={handleOpenWindow} id="stairs-open-window-btn"
              title="Abrir en ventana separada (recomendado para OBS)">
              🪟 Ventana separada
            </button>
            <button className="btn btn-danger" onClick={handleReset} id="stairs-reset-btn"
              title="Reiniciar la ronda">
              🔄 Reiniciar ronda
            </button>
            {!launched ? (
              <button className="btn btn-primary" onClick={handleLaunch} id="stairs-launch-btn">
                🚀 Iniciar
              </button>
            ) : (
              <button className="btn" onClick={handleReload} id="stairs-reload-btn"
                title="Recargar el overlay embebido">
                ♻️ Recargar
              </button>
            )}
          </div>
        </div>

        {/* Controls row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginTop: 12,
          }}
        >
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label>Modo de juego</label>
            <select
              className="select-field"
              value={mode}
              onChange={(e) => changeMode(e.target.value)}
            >
              <option value="tug">{MODE_LABELS.tug}</option>
              <option value="race">{MODE_LABELS.race}</option>
            </select>
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label>Meta (pasos para ganar)</label>
            <input
              className="input-field"
              type="number"
              min="50"
              step="50"
              value={goal}
              onChange={(e) => changeGoal(e.target.value)}
            />
          </div>
        </div>

        {/* Info chips */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "12px" }}>
          <div style={chipStyle("#1e3a5f", "#38bdf8")}>🦸 HÉROES · suben</div>
          <div style={chipStyle("#450a0a", "#fb7155")}>🦹 VILLANOS · bajan</div>
          <div style={chipStyle("#14532d", "#4ade80")}>🎁 Regalo · empuja según 💎</div>
          <div style={chipStyle("#4c1d95", "#8b5cf6")}>💬 Chat · "heroe" / "villano" elige bando</div>
        </div>
      </div>

      {/* Game iframe */}
      {launched ? (
        <div
          style={{
            borderRadius: "14px",
            overflow: "hidden",
            border: "1px solid rgba(56,189,248,0.3)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            background: "#0d1117",
          }}
        >
          <iframe
            ref={iframeRef}
            src={overlayUrl}
            title="Stairs Race"
            id="stairs-iframe"
            style={{ width: "100%", height: "640px", border: "none", display: "block" }}
            allow="autoplay"
          />
        </div>
      ) : (
        <div
          style={{
            background: "linear-gradient(135deg, #0d1117 0%, #0a1e2e 50%, #1a0a14 100%)",
            border: "1px dashed rgba(56,189,248,0.4)",
            borderRadius: "14px",
            padding: "80px 24px",
            textAlign: "center",
            cursor: "pointer",
          }}
          onClick={handleLaunch}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(56,189,248,0.8)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(56,189,248,0.4)"; }}
        >
          <div style={{ fontSize: "4em", marginBottom: "16px" }}>🪜🦸🦹</div>
          <div style={{ fontSize: "1.4em", fontWeight: 700, color: "#e2e8f0", marginBottom: "8px" }}>
            Stairs Race
          </div>
          <div style={{ color: "#94a3b8", fontSize: "0.95em", marginBottom: "28px" }}>
            Haz clic para previsualizar dentro del panel,
            <br />o abre en ventana separada para capturarlo en OBS
          </div>
          <button
            className="btn btn-primary"
            style={{ fontSize: "1em", padding: "12px 32px" }}
            onClick={(e) => { e.stopPropagation(); handleLaunch(); }}
            id="stairs-launch-placeholder-btn"
          >
            🚀 Iniciar
          </button>
        </div>
      )}

      {/* Tips */}
      <div className="panel" style={{ marginBottom: 0 }}>
        <div className="panel-title" style={{ marginBottom: "12px" }}>
          💡 Cómo usar Stairs Race
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
    color,
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "0.78em",
    fontWeight: 600,
    border: `1px solid ${color}33`,
  };
}

const TIPS = [
  {
    title: "🪢 Modo Tira y afloja",
    desc: "Un solo escalador en el centro. Los héroes lo suben, los villanos lo bajan. Gana el bando que lo lleve a su extremo.",
  },
  {
    title: "🏁 Modo Carrera",
    desc: "Cada bando tiene su propio escalador. Los regalos lo hacen subir. Gana el primero en llegar a la meta.",
  },
  {
    title: "🎁 Regalos = empuje",
    desc: "Cada regalo empuja a su bando; a más diamantes, más pasos (5 / 50 / 150 / 500 / 1000).",
  },
  {
    title: "💬 Keywords del chat",
    desc: "Si un viewer escribe 'heroe' o 'villano', se une a ese bando y luego TODOS sus regalos cuentan para él.",
  },
  {
    title: "🪟 Ventana separada / URL",
    desc: "Copia la URL o abre la ventana y agrégala como Browser Source (1920x1080) en OBS o TikTok LIVE Studio.",
  },
  {
    title: "🔄 Reiniciar ronda",
    desc: "Limpia las posiciones y empieza de nuevo sin recargar el overlay. El modo y la meta se cambian desde aquí.",
  },
];
