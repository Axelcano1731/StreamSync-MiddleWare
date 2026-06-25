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
  {
    key: "avatar-battle",
    icon: "⚔️",
    title: "Avatar Battle",
    desc: "Juego de viewers: regalos generan guerreros y likes los curan",
    url: `${BACKEND_URL}/overlay/avatar-battle-overlay.html`,
    size: "1920x1080",
  },
  {
    key: "stairs-race",
    icon: "🪜",
    title: "Stairs Race",
    desc: "Juego de viewers: héroes suben y villanos bajan con donaciones",
    url: `${BACKEND_URL}/overlay/stairs-race-overlay.html`,
    size: "1920x1080",
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

    socket.on("alertConfig", handleConfig);
    socket.on("goalProgress", handleGoalProgress);

    return () => {
      socket.off("alertConfig", handleConfig);
      socket.off("goalProgress", handleGoalProgress);
    };
  }, []);

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
