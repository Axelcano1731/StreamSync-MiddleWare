import React, { useEffect, useMemo, useState } from "react";
import socket from "../services/socketService";

const params = new URLSearchParams(window.location.search);
const backendPort = params.get('backendPort') || '3000';
const BACKEND_URL = `http://localhost:${backendPort}`;

const BUILTIN_WIDGETS = [
  {
    key: "top-donors",
    icon: "🏆",
    title: "Top Donadores",
    desc: "Leaderboard animado del top 5 donadores",
    url: `${BACKEND_URL}/overlay/top-donors.html`,
    size: "300x350",
  },
  {
    key: "top-likes",
    icon: "❤️",
    title: "Top Likes",
    desc: "Ranking de quien más likes envió",
    url: `${BACKEND_URL}/overlay/top-likes.html`,
    size: "300x350",
  },
  {
    key: "recent-followers",
    icon: "➕",
    title: "Seguidores Recientes",
    desc: "Lista animada de los últimos seguidores",
    url: `${BACKEND_URL}/overlay/recent-followers.html`,
    size: "280x400",
  },
  {
    key: "ticker",
    icon: "⚡",
    title: "Event Ticker",
    desc: "Barra tipo breaking news con eventos en tiempo real",
    url: `${BACKEND_URL}/overlay/ticker.html`,
    size: "1920x40",
  },
  {
    key: "now-playing",
    icon: "🎵",
    title: "Now Playing",
    desc: "Widget de la canción actual en Spotify",
    url: `${BACKEND_URL}/overlay/now-playing.html`,
    size: "320x120",
  },
];

const PLACEMENTS = [
  "top-left",
  "top-center",
  "top-right",
  "center",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

const VS_OVERLAY_URL = `${BACKEND_URL}/overlay/vs-battle-overlay.html`;

const VS_CHIP = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "var(--bg-input)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 999,
  padding: "3px 6px 3px 8px",
  fontSize: "0.78em",
};
const VS_CHIP_X = {
  background: "transparent",
  border: "none",
  color: "var(--text-muted)",
  cursor: "pointer",
  fontSize: "0.9em",
  lineHeight: 1,
};

function createEmptyPreset() {
  return {
    id: "",
    name: "",
    description: "",
    accentColor: "#7c3aed",
    theme: "dark",
    backgroundStyle: "glass",
    position: "top-right",
    maxAlerts: 3,
    showChatBox: true,
    showGoalTracker: true,
    chatPlacement: "bottom-left",
    goalPlacement: "bottom-center",
    width: 1920,
    height: 1080,
  };
}

function sanitizePresetId(name, id) {
  const value = String(id || name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return value || `overlay-${Date.now()}`;
}

function createOverlayUrl(presetId) {
  return `${BACKEND_URL}/overlay?preset=${encodeURIComponent(presetId)}`;
}

export default function OverlayPanel() {
  const [config, setConfig] = useState(null);
  const [presetDraft, setPresetDraft] = useState(createEmptyPreset());
  const [selectedPresetId, setSelectedPresetId] = useState(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [previewKey, setPreviewKey] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [customCSS, setCustomCSS] = useState("");
  const [feedback, setFeedback] = useState("");

  // ----- VS Battle -----
  const [availableGifts, setAvailableGifts] = useState([]);
  const [vsDraft, setVsDraft] = useState(null);
  const [vsTarget, setVsTarget] = useState("A");
  const [vsSearch, setVsSearch] = useState("");
  const [vsCopied, setVsCopied] = useState(false);
  const [vsPreview, setVsPreview] = useState(false);
  const [vsWins, setVsWins] = useState({ a: 0, b: 0 });

  useEffect(() => {
    socket.emit("getAlertConfig", (cfg) => {
      setConfig(cfg);
      setCustomCSS(cfg?.overlay?.customCSS || "");
    });

    const handleConfig = (cfg) => {
      setConfig(cfg);
      setCustomCSS((prev) =>
        prev && prev !== cfg?.overlay?.customCSS ? prev : cfg?.overlay?.customCSS || ""
      );
    };

    const handleGoalProgress = (goals) => {
      setConfig((prev) => (prev ? { ...prev, goals } : prev));
    };

    const handleVsWins = (w) =>
      setVsWins({ a: Number(w?.a) || 0, b: Number(w?.b) || 0 });

    socket.on("alertConfig", handleConfig);
    socket.on("goalProgress", handleGoalProgress);
    socket.on("vsBattle:wins", handleVsWins);

    return () => {
      socket.off("alertConfig", handleConfig);
      socket.off("goalProgress", handleGoalProgress);
      socket.off("vsBattle:wins", handleVsWins);
    };
  }, []);

  // Sincroniza el marcador de wins desde la config (valor persistido).
  useEffect(() => {
    const w = config?.vsBattle?.wins;
    if (w) setVsWins({ a: Number(w.a) || 0, b: Number(w.b) || 0 });
  }, [config?.vsBattle?.wins?.a, config?.vsBattle?.wins?.b]);

  // Catálogo de regalos de TikTok (con imágenes) para el selector del VS Battle.
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/sticker-sounds/available-gifts`)
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setAvailableGifts(d))
      .catch(() => {});
  }, []);

  // Inicializa el borrador del VS Battle la primera vez que llega la config.
  useEffect(() => {
    if (config?.vsBattle && !vsDraft) {
      setVsDraft(JSON.parse(JSON.stringify(config.vsBattle)));
    }
  }, [config?.vsBattle, vsDraft]);

  const presets = config?.overlay?.presets || [];
  const selectedPreset = useMemo(() => {
    return (
      presets.find((preset) => preset.id === selectedPresetId) ||
      presets.find((preset) => preset.id === config?.overlay?.defaultPresetId) ||
      presets[0] ||
      null
    );
  }, [config?.overlay?.defaultPresetId, presets, selectedPresetId]);

  useEffect(() => {
    if (selectedPreset && !isCreatingNew) {
      setPresetDraft(selectedPreset);
      setSelectedPresetId(selectedPreset.id);
    }
  }, [isCreatingNew, selectedPreset?.id]);

  const saveOverlayConfig = (overlayConfig) => {
    socket.emit("updateOverlayConfig", overlayConfig);
  };

  const copyUrl = (key, url) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    });
  };

  const handleSavePreset = () => {
    if (!config) return;

    const safeId = sanitizePresetId(presetDraft.name, presetDraft.id || selectedPresetId);
    const nextPreset = {
      ...presetDraft,
      id: safeId,
      name: presetDraft.name.trim() || safeId,
      description: presetDraft.description.trim(),
      maxAlerts: Number(presetDraft.maxAlerts) || 1,
      width: Number(presetDraft.width) || 1920,
      height: Number(presetDraft.height) || 1080,
    };

    const exists = presets.some((preset) => preset.id === safeId);
    const nextPresets = exists
      ? presets.map((preset) => (preset.id === safeId ? nextPreset : preset))
      : [...presets, nextPreset];

    const nextOverlay = {
      ...config.overlay,
      presets: nextPresets,
      defaultPresetId: config.overlay?.defaultPresetId || safeId,
      customCSS,
    };

    saveOverlayConfig(nextOverlay);
    setIsCreatingNew(false);
    setSelectedPresetId(safeId);
    setPresetDraft(nextPreset);
    setFeedback("Preset de overlay guardado.");
  };

  const handleDeletePreset = (presetId) => {
    if (!config || presets.length <= 1) {
      setFeedback("Necesitas dejar al menos un preset disponible.");
      return;
    }

    const nextPresets = presets.filter((preset) => preset.id !== presetId);
    const nextDefault =
      config.overlay?.defaultPresetId === presetId
        ? nextPresets[0]?.id || null
        : config.overlay?.defaultPresetId;

    saveOverlayConfig({
      ...config.overlay,
      presets: nextPresets,
      defaultPresetId: nextDefault,
      customCSS,
    });

    setSelectedPresetId(nextDefault);
    setFeedback("Preset eliminado.");
  };

  const handleSetDefaultPreset = (presetId) => {
    saveOverlayConfig({
      ...config.overlay,
      defaultPresetId: presetId,
      customCSS,
    });
    setFeedback("Preset principal actualizado.");
  };

  const handleSaveCustomCSS = () => {
    saveOverlayConfig({
      ...config.overlay,
      customCSS,
    });
    setFeedback("CSS global del overlay guardado.");
  };

  const updateGoal = (goalKey, field, value) => {
    if (!config) return;

    socket.emit("updateGoals", {
      ...config.goals,
      [goalKey]: {
        ...config.goals[goalKey],
        [field]: value,
      },
    });
  };

  // ----- VS Battle: helpers -----
  const sameGift = (a, b) => {
    if (a.id != null && b.id != null) return String(a.id) === String(b.id);
    return String(a.name || "").toLowerCase().trim() === String(b.name || "").toLowerCase().trim();
  };

  const giftSide = (gift) => {
    if (!vsDraft) return null;
    const e = { id: gift.id != null ? String(gift.id) : null, name: gift.name };
    if ((vsDraft.sideA.gifts || []).some((g) => sameGift(g, e))) return "A";
    if ((vsDraft.sideB.gifts || []).some((g) => sameGift(g, e))) return "B";
    return null;
  };

  // Asignar/quitar un regalo al lado activo (un regalo solo puede estar en un lado).
  const vsAssignGift = (gift) => {
    setVsDraft((prev) => {
      if (!prev) return prev;
      const d = JSON.parse(JSON.stringify(prev));
      const entry = {
        id: gift.id != null ? String(gift.id) : null,
        name: gift.name,
        image: gift.image || null,
      };
      const targetKey = vsTarget === "A" ? "sideA" : "sideB";
      const already = (d[targetKey].gifts || []).some((g) => sameGift(g, entry));
      d.sideA.gifts = (d.sideA.gifts || []).filter((g) => !sameGift(g, entry));
      d.sideB.gifts = (d.sideB.gifts || []).filter((g) => !sameGift(g, entry));
      if (!already) d[targetKey].gifts.push(entry);
      return d;
    });
  };

  const vsRemoveGift = (sideKey, entry) => {
    setVsDraft((prev) => {
      if (!prev) return prev;
      const d = JSON.parse(JSON.stringify(prev));
      d[sideKey].gifts = (d[sideKey].gifts || []).filter((g) => !sameGift(g, entry));
      return d;
    });
  };

  const vsUpdateSide = (sideKey, field, value) => {
    setVsDraft((prev) =>
      prev ? { ...prev, [sideKey]: { ...prev[sideKey], [field]: value } } : prev
    );
  };

  const vsUpdateField = (field, value) => {
    setVsDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSaveVsBattle = () => {
    if (!vsDraft) return;
    socket.emit("updateAlertConfig", { section: "vsBattle", config: vsDraft });
    setFeedback("VS Battle guardado.");
  };

  const handleResetVsBattle = () => {
    socket.emit("vsBattleControl", "reset");
    setFeedback("Marcador del VS reiniciado.");
  };

  // Wins (rondas ganadas): ajuste manual. Optimista + confirmación del backend.
  const adjustWin = (side, delta) => {
    setVsWins((prev) => {
      const key = side === "A" ? "a" : "b";
      return { ...prev, [key]: Math.max(0, (prev[key] || 0) + delta) };
    });
    socket.emit("vsBattleWins", { side, delta });
  };

  const resetWins = () => {
    setVsWins({ a: 0, b: 0 });
    socket.emit("vsBattleWins", { reset: true });
  };

  const vsCatalog = (() => {
    const q = vsSearch.trim().toLowerCase();
    let list = availableGifts;
    if (q) list = list.filter((g) => (g.name || "").toLowerCase().includes(q));
    return list.slice(0, 80);
  })();

  if (!config) {
    return (
      <div className="page-enter">
        <div className="panel">
          <div className="empty-state">
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-text">Cargando presets de overlay...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ display: "grid", gap: 20 }}>
      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Creador de Overlays</div>
            <div className="panel-subtitle">
              Diseña presets propios para OBS, TikTok LIVE Studio o navegador.
            </div>
          </div>
        </div>

        <div className="alert-config-card" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: "0.82em", color: "var(--text-secondary)", lineHeight: 1.7 }}>
            Cada preset genera una URL propia lista para copiar como Browser Source.
            Puedes controlar posición, tema, chat box, metas y límite de alertas.
          </div>
          {feedback ? (
            <div style={{ marginTop: 10, fontSize: "0.82em", color: "var(--text-secondary)" }}>
              {feedback}
            </div>
          ) : null}
        </div>
      </div>

      {vsDraft ? (
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">⚔️ VS Battle — Marcador de Regalos</div>
              <div className="panel-subtitle">
                Elige qué regalo suma a cada lado. El marcador solo aumenta con esos regalos.
              </div>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={vsDraft.enabled !== false}
                onChange={(e) => vsUpdateField("enabled", e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {/* Ajustes generales */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Título</label>
              <input
                className="input-field"
                value={vsDraft.title || ""}
                onChange={(e) => vsUpdateField("title", e.target.value)}
                placeholder="VS Battle"
              />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Cómo cuenta</label>
              <select
                className="select-field"
                value={vsDraft.by || "count"}
                onChange={(e) => vsUpdateField("by", e.target.value)}
              >
                <option value="count">Por regalo (suma el combo)</option>
                <option value="diamonds">Por diamantes</option>
              </select>
            </div>
          </div>

          {/* Editores de cada lado */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 12,
              marginBottom: 14,
            }}
          >
            {["sideA", "sideB"].map((sideKey) => {
              const s = vsDraft[sideKey];
              const letter = sideKey === "sideA" ? "A" : "B";
              return (
                <div key={sideKey} className="alert-config-card">
                  <div className="alert-config-header">
                    <div className="alert-config-title">
                      <span style={{ color: s.color }}>■</span> Lado {letter}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                    <div className="input-group" style={{ marginBottom: 0, flex: 1 }}>
                      <label>Nombre</label>
                      <input
                        className="input-field"
                        value={s.label || ""}
                        onChange={(e) => vsUpdateSide(sideKey, "label", e.target.value)}
                      />
                    </div>
                    <div className="input-group" style={{ marginBottom: 0, width: 70 }}>
                      <label>Color</label>
                      <input
                        className="input-field"
                        type="color"
                        value={s.color || "#ffffff"}
                        onChange={(e) => vsUpdateSide(sideKey, "color", e.target.value)}
                        style={{ padding: 6, width: 70 }}
                      />
                    </div>
                  </div>
                  <div style={{ fontSize: "0.78em", color: "var(--text-muted)", marginBottom: 6 }}>
                    Regalos asignados ({(s.gifts || []).length})
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minHeight: 34 }}>
                    {(s.gifts || []).length ? (
                      s.gifts.map((g, i) => (
                        <span key={(g.id || g.name) + "-" + i} style={VS_CHIP}>
                          <VsGiftThumb image={g.image} name={g.name} />
                          {g.name}
                          <button
                            onClick={() => vsRemoveGift(sideKey, g)}
                            style={VS_CHIP_X}
                            title="Quitar"
                          >
                            ✕
                          </button>
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: "0.78em", color: "var(--text-muted)" }}>
                        Sin regalos. Elígelos abajo.
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selector de regalos del catálogo */}
          <div className="alert-config-card">
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                marginBottom: 10,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: "0.82em", color: "var(--text-secondary)" }}>
                Click en un regalo para asignarlo a:
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="btn"
                  style={{
                    padding: "4px 12px",
                    ...(vsTarget === "A"
                      ? { background: vsDraft.sideA.color, color: "#000", fontWeight: 700 }
                      : {}),
                  }}
                  onClick={() => setVsTarget("A")}
                >
                  Lado A
                </button>
                <button
                  className="btn"
                  style={{
                    padding: "4px 12px",
                    ...(vsTarget === "B"
                      ? { background: vsDraft.sideB.color, color: "#000", fontWeight: 700 }
                      : {}),
                  }}
                  onClick={() => setVsTarget("B")}
                >
                  Lado B
                </button>
              </div>
            </div>

            <input
              type="text"
              className="input-field"
              placeholder="🔍 Buscar regalo por nombre..."
              value={vsSearch}
              onChange={(e) => setVsSearch(e.target.value)}
              style={{ marginBottom: 10 }}
            />

            {availableGifts.length ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))",
                  gap: 8,
                  maxHeight: 240,
                  overflowY: "auto",
                }}
              >
                {vsCatalog.map((g) => {
                  const side = giftSide(g);
                  const sideColor =
                    side === "A" ? vsDraft.sideA.color : side === "B" ? vsDraft.sideB.color : null;
                  return (
                    <button
                      key={g.id || g.name}
                      onClick={() => vsAssignGift(g)}
                      title={g.name}
                      style={{
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                        padding: "8px 4px",
                        borderRadius: 10,
                        cursor: "pointer",
                        background: "var(--bg-input)",
                        border: `1px solid ${sideColor || "var(--border-subtle)"}`,
                      }}
                    >
                      {side ? (
                        <span
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            fontSize: "0.62em",
                            fontWeight: 800,
                            color: "#000",
                            background: sideColor,
                            borderRadius: 6,
                            padding: "1px 5px",
                          }}
                        >
                          {side}
                        </span>
                      ) : null}
                      <VsGiftThumb image={g.image} name={g.name} large />
                      <span
                        style={{
                          fontSize: "0.68em",
                          textAlign: "center",
                          color: "var(--text-secondary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "100%",
                        }}
                      >
                        {g.name}
                      </span>
                      {g.diamondCount != null ? (
                        <span style={{ fontSize: "0.62em", color: "var(--text-muted)" }}>
                          💎{g.diamondCount}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: "18px 0" }}>
                <div className="empty-state-icon">🎁</div>
                <div className="empty-state-text">
                  Conéctate a tu TikTok Live para cargar el catálogo de regalos.
                  Mientras tanto puedes agregarlos por nombre aquí abajo.
                </div>
              </div>
            )}

            <ManualGiftAdder target={vsTarget} onAdd={(name) => vsAssignGift({ id: null, name, image: null })} />
          </div>

          {/* URL + acciones */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "var(--bg-input)",
              padding: "8px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
              margin: "14px 0 10px",
            }}
          >
            <code
              style={{
                flex: 1,
                color: "var(--accent-secondary)",
                fontSize: "0.76em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {VS_OVERLAY_URL}
            </code>
            <button
              className="btn"
              style={{ padding: "4px 10px" }}
              onClick={() => {
                navigator.clipboard.writeText(VS_OVERLAY_URL);
                setVsCopied(true);
                setTimeout(() => setVsCopied(false), 1800);
              }}
            >
              {vsCopied ? "✓" : "📋"}
            </button>
          </div>

          {/* Wins: marcador de rondas ganadas por lado (ajuste manual) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              flexWrap: "wrap",
              marginBottom: 14,
              padding: "10px 14px",
              background: "var(--bg-secondary, rgba(255,255,255,.03))",
              borderRadius: "var(--radius-sm, 8px)",
            }}
          >
            <span style={{ fontSize: "0.8em", color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1 }}>
              ⚔️ WINS
            </span>
            {[
              { side: "A", label: vsDraft.sideA?.label || "Lado A", color: vsDraft.sideA?.color, val: vsWins.a },
              { side: "B", label: vsDraft.sideB?.label || "Lado B", color: vsDraft.sideB?.color, val: vsWins.b },
            ].map((s) => (
              <div key={s.side} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: s.color, fontWeight: 800, minWidth: 40 }}>{s.label}</span>
                <button
                  className="btn"
                  style={{ padding: "2px 10px", fontSize: "1.1em", lineHeight: 1 }}
                  onClick={() => adjustWin(s.side, -1)}
                  title="Restar una victoria"
                >
                  −
                </button>
                <span style={{ minWidth: 26, textAlign: "center", fontWeight: 900, fontSize: "1.2em" }}>
                  {s.val}
                </span>
                <button
                  className="btn"
                  style={{ padding: "2px 10px", fontSize: "1.1em", lineHeight: 1 }}
                  onClick={() => adjustWin(s.side, 1)}
                  title="Sumar una victoria"
                >
                  +
                </button>
              </div>
            ))}
            <button className="btn" style={{ padding: "4px 10px", fontSize: "0.8em" }} onClick={resetWins}>
              Reiniciar wins
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={handleSaveVsBattle}>
              Guardar VS Battle
            </button>
            <button className="btn" onClick={() => setVsPreview((v) => !v)}>
              {vsPreview ? "Cerrar Preview" : "Preview"}
            </button>
            <button className="btn btn-danger" onClick={handleResetVsBattle}>
              Reiniciar marcador
            </button>
          </div>

          <div style={{ fontSize: "0.75em", color: "var(--text-muted)", marginTop: 8 }}>
            Tamaño sugerido en OBS: 560×320 (Browser Source). Guarda los cambios para
            que el overlay los tome al instante.
          </div>

          {vsPreview ? (
            <div
              style={{
                marginTop: 12,
                background: "#101018",
                borderRadius: "var(--radius-sm)",
                overflow: "hidden",
                height: 220,
              }}
            >
              <iframe
                src={`${VS_OVERLAY_URL}?control=1`}
                title="Preview VS Battle"
                style={{ width: "100%", height: "100%", border: "none" }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 20,
        }}
      >
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Presets Guardados</div>
              <div className="panel-subtitle">{presets.length} overlays disponibles</div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {presets.map((preset) => {
              const url = createOverlayUrl(preset.id);
              const isDefault = config.overlay?.defaultPresetId === preset.id;

              return (
                <div key={preset.id} className="alert-config-card">
                  <div className="alert-config-header">
                    <div className="alert-config-title">
                      <span style={{ color: preset.accentColor || "#7c3aed" }}>■</span>
                      {preset.name}
                    </div>
                    {isDefault ? <span className="event-badge follow">Principal</span> : null}
                  </div>

                  <div style={{ fontSize: "0.8em", color: "var(--text-muted)", marginBottom: 10 }}>
                    {preset.description || "Sin descripción"}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "var(--bg-input)",
                      padding: "8px 10px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-subtle)",
                      marginBottom: 10,
                    }}
                  >
                    <code
                      style={{
                        flex: 1,
                        color: "var(--accent-secondary)",
                        fontSize: "0.76em",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {url}
                    </code>
                    <button className="btn" style={{ padding: "4px 10px" }} onClick={() => copyUrl(preset.id, url)}>
                      {copiedKey === preset.id ? "✓" : "📋"}
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn" onClick={() => {
                      setIsCreatingNew(false);
                      setSelectedPresetId(preset.id);
                      setPresetDraft(preset);
                    }}>
                      Editar
                    </button>
                    <button className="btn" onClick={() => setPreviewKey(previewKey === preset.id ? null : preset.id)}>
                      {previewKey === preset.id ? "Cerrar Preview" : "Preview"}
                    </button>
                    <button className="btn" onClick={() => handleSetDefaultPreset(preset.id)}>
                      Hacer Principal
                    </button>
                    <button className="btn btn-danger" onClick={() => handleDeletePreset(preset.id)}>
                      Eliminar
                    </button>
                  </div>

                  {previewKey === preset.id ? (
                    <div
                      style={{
                        marginTop: 12,
                        background: "#000",
                        borderRadius: "var(--radius-sm)",
                        overflow: "hidden",
                        height: 220,
                      }}
                    >
                      <iframe
                        src={url}
                        title={`Preview ${preset.name}`}
                        style={{ width: "100%", height: "100%", border: "none" }}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Editor del Preset</div>
              <div className="panel-subtitle">
                Ajusta apariencia, chat y metas del overlay seleccionado
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Nombre</label>
                <input
                  className="input-field"
                  value={presetDraft.name || ""}
                  onChange={(e) =>
                    setPresetDraft((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Overlay principal"
                />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Color de acento</label>
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    className="input-field"
                    type="color"
                    value={presetDraft.accentColor || "#7c3aed"}
                    onChange={(e) =>
                      setPresetDraft((prev) => ({
                        ...prev,
                        accentColor: e.target.value,
                      }))
                    }
                    style={{ width: 64, padding: 6 }}
                  />
                  <input
                    className="input-field"
                    value={presetDraft.accentColor || ""}
                    onChange={(e) =>
                      setPresetDraft((prev) => ({
                        ...prev,
                        accentColor: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Descripción</label>
              <input
                className="input-field"
                value={presetDraft.description || ""}
                onChange={(e) =>
                  setPresetDraft((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Alertas, chat y metas en una sola escena"
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Tema</label>
                <select
                  className="select-field"
                  value={presetDraft.theme || "dark"}
                  onChange={(e) =>
                    setPresetDraft((prev) => ({ ...prev, theme: e.target.value }))
                  }
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Fondo</label>
                <select
                  className="select-field"
                  value={presetDraft.backgroundStyle || "glass"}
                  onChange={(e) =>
                    setPresetDraft((prev) => ({
                      ...prev,
                      backgroundStyle: e.target.value,
                    }))
                  }
                >
                  <option value="glass">Glass</option>
                  <option value="solid">Solid</option>
                </select>
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Posición de alertas</label>
                <select
                  className="select-field"
                  value={presetDraft.position || "top-right"}
                  onChange={(e) =>
                    setPresetDraft((prev) => ({ ...prev, position: e.target.value }))
                  }
                >
                  {PLACEMENTS.map((placement) => (
                    <option key={placement} value={placement}>
                      {placement}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Alertas simultáneas</label>
                <input
                  className="input-field"
                  type="number"
                  min="1"
                  value={presetDraft.maxAlerts || 3}
                  onChange={(e) =>
                    setPresetDraft((prev) => ({ ...prev, maxAlerts: e.target.value }))
                  }
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Ubicación del chat</label>
                <select
                  className="select-field"
                  value={presetDraft.chatPlacement || "bottom-left"}
                  onChange={(e) =>
                    setPresetDraft((prev) => ({
                      ...prev,
                      chatPlacement: e.target.value,
                    }))
                  }
                >
                  {PLACEMENTS.map((placement) => (
                    <option key={placement} value={placement}>
                      {placement}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Ubicación de meta</label>
                <select
                  className="select-field"
                  value={presetDraft.goalPlacement || "bottom-center"}
                  onChange={(e) =>
                    setPresetDraft((prev) => ({
                      ...prev,
                      goalPlacement: e.target.value,
                    }))
                  }
                >
                  {PLACEMENTS.map((placement) => (
                    <option key={placement} value={placement}>
                      {placement}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Ancho recomendado</label>
                <input
                  className="input-field"
                  type="number"
                  value={presetDraft.width || 1920}
                  onChange={(e) =>
                    setPresetDraft((prev) => ({ ...prev, width: e.target.value }))
                  }
                />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Alto recomendado</label>
                <input
                  className="input-field"
                  type="number"
                  value={presetDraft.height || 1080}
                  onChange={(e) =>
                    setPresetDraft((prev) => ({ ...prev, height: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="config-row">
              <span className="config-label">Mostrar chat box</span>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={presetDraft.showChatBox ?? true}
                  onChange={(e) =>
                    setPresetDraft((prev) => ({
                      ...prev,
                      showChatBox: e.target.checked,
                    }))
                  }
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="config-row">
              <span className="config-label">Mostrar goal tracker</span>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={presetDraft.showGoalTracker ?? true}
                  onChange={(e) =>
                    setPresetDraft((prev) => ({
                      ...prev,
                      showGoalTracker: e.target.checked,
                    }))
                  }
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn btn-primary" onClick={handleSavePreset}>
                Guardar Preset
              </button>
              <button
                className="btn"
                onClick={() => {
                  setIsCreatingNew(true);
                  setSelectedPresetId(null);
                  setPresetDraft(createEmptyPreset());
                }}
              >
                Nuevo Preset
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">CSS Global del Overlay</div>
            <div className="panel-subtitle">
              Ajustes visuales avanzados para todos los presets
            </div>
          </div>
        </div>

        <textarea
          className="input-field"
          style={{ minHeight: 120, resize: "vertical", marginBottom: 12 }}
          value={customCSS}
          onChange={(e) => setCustomCSS(e.target.value)}
          placeholder=".alert-card { border-radius: 24px; }"
        />

        <button className="btn" onClick={handleSaveCustomCSS}>
          Guardar CSS
        </button>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Metas del Overlay</div>
            <div className="panel-subtitle">
              Define objetivos que se actualizan durante la sesión en vivo
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {Object.entries(config.goals || {}).map(([goalKey, goal]) => (
            <div key={goalKey} className="alert-config-card">
              <div className="alert-config-header">
                <div className="alert-config-title">{goalKey}</div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={goal.enabled ?? false}
                    onChange={(e) => updateGoal(goalKey, "enabled", e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="config-row" style={{ marginBottom: 10 }}>
                <span className="config-label">Progreso actual</span>
                <span className="config-value">{goal.current || 0}</span>
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Meta objetivo</label>
                <input
                  className="input-field"
                  type="number"
                  min="0"
                  value={goal.target || 0}
                  onChange={(e) => updateGoal(goalKey, "target", Number(e.target.value) || 0)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Widgets Especializados</div>
            <div className="panel-subtitle">
              Componentes extra listos para copiar a OBS
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 14,
          }}
        >
          {BUILTIN_WIDGETS.map((widget) => (
            <div key={widget.key} className="alert-config-card">
              <div className="alert-config-header">
                <div className="alert-config-title">
                  <span>{widget.icon}</span>
                  {widget.title}
                </div>
              </div>

              <p style={{ fontSize: "0.8em", color: "var(--text-muted)", marginBottom: 10 }}>
                {widget.desc}
              </p>

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
                  {widget.url}
                </code>
                <button
                  className="btn"
                  style={{ padding: "4px 10px", fontSize: "0.75em" }}
                  onClick={() => copyUrl(widget.key, widget.url)}
                >
                  {copiedKey === widget.key ? "✓" : "📋"}
                </button>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.75em", color: "var(--text-muted)" }}>
                  📐 {widget.size}
                </span>
                <button
                  className="btn"
                  style={{ padding: "4px 10px", fontSize: "0.75em" }}
                  onClick={() =>
                    setPreviewKey(previewKey === widget.key ? null : widget.key)
                  }
                >
                  {previewKey === widget.key ? "Cerrar" : "Preview"}
                </button>
              </div>

              {previewKey === widget.key ? (
                <div
                  style={{
                    marginTop: 10,
                    background: "#000",
                    borderRadius: "var(--radius-sm)",
                    overflow: "hidden",
                    height: 200,
                  }}
                >
                  <iframe
                    src={widget.url}
                    title={`Preview ${widget.title}`}
                    style={{ width: "100%", height: "100%", border: "none" }}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Miniatura de regalo con fallback a emoji si la imagen falla o no existe.
function VsGiftThumb({ image, name, large }) {
  const [failed, setFailed] = useState(false);
  const size = large ? 40 : 20;
  if (!image || failed) {
    return (
      <span style={{ fontSize: large ? 28 : 16 }} role="img" aria-label={name || "regalo"}>
        🎁
      </span>
    );
  }
  return (
    <img
      src={image}
      alt={name || ""}
      width={size}
      height={size}
      style={{ objectFit: "contain" }}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

// Alta manual de regalo por nombre (útil sin estar en vivo o para regalos sin catálogo).
function ManualGiftAdder({ onAdd, target }) {
  const [val, setVal] = useState("");
  const submit = () => {
    const n = val.trim();
    if (!n) return;
    onAdd(n);
    setVal("");
  };
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
      <input
        className="input-field"
        placeholder={`Agregar regalo por nombre a Lado ${target} (ej. Rose)`}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
      />
      <button className="btn" onClick={submit}>
        Agregar
      </button>
    </div>
  );
}
