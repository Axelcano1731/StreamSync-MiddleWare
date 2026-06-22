import React, { useState, useRef, useEffect } from "react";

const WORDLE_URL = "http://localhost:3000/games/wordle/";

export default function WordlePanel() {
  const [launched, setLaunched] = useState(false);
  const iframeRef = useRef(null);

  function handleLaunch() {
    setLaunched(true);
  }

  function handleOpenWindow() {
    window.open(WORDLE_URL, "_blank", "width=700,height=860,toolbar=no,menubar=no");
  }

  function handleReload() {
    if (iframeRef.current) {
      iframeRef.current.src = WORDLE_URL;
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header card */}
      <div className="panel" style={{ marginBottom: 0 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">🟩 StreamWordle — Juego Interactivo</div>
            <div className="panel-subtitle">
              Juego de Wordle en vivo · Los viewers participan por el chat de TikTok
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              className="btn"
              onClick={handleOpenWindow}
              title="Abrir en ventana separada (recomendado para streaming)"
              id="wordle-open-window-btn"
            >
              🪟 Ventana separada
            </button>
            {launched && (
              <button
                className="btn"
                onClick={handleReload}
                title="Recargar el juego"
                id="wordle-reload-btn"
              >
                🔄 Recargar
              </button>
            )}
            {!launched ? (
              <button
                className="btn btn-primary"
                onClick={handleLaunch}
                id="wordle-launch-btn"
              >
                🚀 Iniciar Wordle
              </button>
            ) : (
              <button
                className="btn btn-danger"
                onClick={() => setLaunched(false)}
                id="wordle-close-btn"
              >
                ✖ Cerrar
              </button>
            )}
          </div>
        </div>

        {/* Info chips */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px" }}>
          <div style={chipStyle("#4c1d95", "#8b5cf6")}>
            🎮 Modo Streamer · usa el teclado
          </div>
          <div style={chipStyle("#1e3a5f", "#60a5fa")}>
            👥 Modo Viewers · chat responde
          </div>
          <div style={chipStyle("#14532d", "#4ade80")}>
            😊 Fácil · palabras comunes
          </div>
          <div style={chipStyle("#450a0a", "#f87171")}>
            💀 Hardcore · diccionario completo
          </div>
        </div>
      </div>

      {/* Game iframe */}
      {launched ? (
        <div
          style={{
            borderRadius: "14px",
            overflow: "hidden",
            border: "1px solid rgba(139,92,246,0.3)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            background: "#0f0f13",
            position: "relative",
          }}
        >
          <iframe
            ref={iframeRef}
            src={WORDLE_URL}
            title="StreamWordle"
            id="wordle-iframe"
            style={{
              width: "100%",
              height: "820px",
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
            background: "linear-gradient(135deg, #0f0f13 0%, #1a0a2e 50%, #0d1117 100%)",
            border: "1px dashed rgba(139,92,246,0.4)",
            borderRadius: "14px",
            padding: "80px 24px",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.3s",
          }}
          onClick={handleLaunch}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(139,92,246,0.8)";
            e.currentTarget.style.background =
              "linear-gradient(135deg, #13091e 0%, #1f0d3a 50%, #0d1117 100%)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(139,92,246,0.4)";
            e.currentTarget.style.background =
              "linear-gradient(135deg, #0f0f13 0%, #1a0a2e 50%, #0d1117 100%)";
          }}
        >
          <div style={{ fontSize: "4em", marginBottom: "16px" }}>🟩🟨⬛</div>
          <div
            style={{
              fontSize: "1.4em",
              fontWeight: 700,
              color: "#e2e8f0",
              marginBottom: "8px",
            }}
          >
            StreamWordle
          </div>
          <div style={{ color: "#94a3b8", fontSize: "0.95em", marginBottom: "28px" }}>
            Haz clic para cargar el juego dentro del panel,
            <br />o abre en una ventana separada para hacer stream
          </div>
          <button
            className="btn btn-primary"
            style={{ fontSize: "1em", padding: "12px 32px" }}
            onClick={(e) => {
              e.stopPropagation();
              handleLaunch();
            }}
            id="wordle-launch-placeholder-btn"
          >
            🚀 Iniciar Wordle
          </button>
        </div>
      )}

      {/* Tips */}
      <div className="panel" style={{ marginBottom: 0 }}>
        <div className="panel-title" style={{ marginBottom: "12px" }}>
          💡 Cómo usar StreamWordle
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
    title: "🎮 Modo Streamer",
    desc: "Tú juegas con el teclado. Las palabras tienen tildes y Ñ. Tienes 6 intentos. Elige Fácil o Hardcore.",
  },
  {
    title: "👥 Modo Viewers",
    desc: "Los espectadores escriben palabras de 5 letras en el chat de TikTok. Cada mensaje es un intento.",
  },
  {
    title: "😊 Modo Fácil",
    desc: "Diccionario de ~1000 palabras comunes en español. Ideal para streams familiares.",
  },
  {
    title: "💀 Hardcore",
    desc: "Diccionario completo con más de 10,000 palabras en español. Para los más avezados.",
  },
  {
    title: "🌹 Filtro Rosa/Quiéreme",
    desc: "Solo viewers que enviaron una Rosa o tienen Quiéreme activo pueden participar.",
  },
  {
    title: "🪟 Ventana separada",
    desc: "Usa 'Ventana separada' para capturar el juego en OBS como fuente de ventana.",
  },
];
