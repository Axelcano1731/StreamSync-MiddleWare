import React, { useEffect, useState } from "react";
import socket from "../services/socketService";

const ALERT_TYPES = [
  { key: "gift", icon: "🎁", label: "Regalos / Donaciones" },
  { key: "follow", icon: "➕", label: "Nuevos Seguidores" },
  { key: "share", icon: "↪️", label: "Compartidas" },
  { key: "chat", icon: "💬", label: "Chat / Comentarios" },
  { key: "like", icon: "❤️", label: "Likes" },
  { key: "memberJoin", icon: "👋", label: "Unirse al directo" },
];

const ANIMATIONS = ["slideIn", "fadeIn", "bounce", "pop", "none"];

export default function AlertsPanel() {
  const [config, setConfig] = useState(null);
  const [previewMessage, setPreviewMessage] = useState("");

  useEffect(() => {
    socket.emit("getAlertConfig", (cfg) => {
      if (cfg) setConfig(cfg);
    });

    const handleConfig = (cfg) => {
      setConfig(cfg);
    };

    socket.on("alertConfig", handleConfig);

    return () => {
      socket.off("alertConfig", handleConfig);
    };
  }, []);

  const updateAlert = (alertKey, field, value) => {
    if (!config) return;

    const updated = {
      ...config.alerts,
      [alertKey]: {
        ...config.alerts[alertKey],
        [field]: value,
      },
    };

    socket.emit("updateAlerts", updated);
  };

  const triggerPreview = (alertKey) => {
    socket.emit("previewAlert", alertKey, (response) => {
      setPreviewMessage(
        response?.ok
          ? `Vista previa enviada para ${alertKey}.`
          : `No se pudo generar la prueba: ${response?.error || "Error desconocido"}`
      );
    });
  };

  if (!config) {
    return (
      <div className="page-enter">
        <div className="panel">
          <div className="empty-state">
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-text">Cargando configuración...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ display: "grid", gap: 20 }}>
      <div className="panel" style={{ marginBottom: 0 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">Configuración de Alertas</div>
            <div className="panel-subtitle">
              Diseña textos, sonidos y comportamiento de cada evento.
            </div>
          </div>
        </div>

        <div className="alert-config-card" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: "0.82em", color: "var(--text-secondary)", lineHeight: 1.7 }}>
            Placeholders disponibles: <code>{"{user}"}</code>, <code>{"{comment}"}</code>,{" "}
            <code>{"{giftName}"}</code>, <code>{"{repeatCount}"}</code>,{" "}
            <code>{"{diamondCount}"}</code>, <code>{"{likeCount}"}</code>.
          </div>
          {previewMessage ? (
            <div style={{ marginTop: 10, fontSize: "0.82em", color: "var(--text-secondary)" }}>
              {previewMessage}
            </div>
          ) : null}
        </div>
      </div>

      <div className="alerts-grid">
        {ALERT_TYPES.map(({ key, icon, label }) => {
          const alertCfg = config.alerts?.[key] || {};

          return (
            <div key={key} className="alert-config-card">
              <div className="alert-config-header">
                <div className="alert-config-title">
                  <span>{icon}</span>
                  {label}
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={alertCfg.enabled ?? false}
                    onChange={(e) => updateAlert(key, "enabled", e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="alert-config-body">
                <div className="config-row">
                  <span className="config-label">Overlay</span>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={alertCfg.showOverlay ?? false}
                      onChange={(e) => updateAlert(key, "showOverlay", e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="config-row">
                  <span className="config-label">TTS</span>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={alertCfg.tts ?? false}
                      onChange={(e) => updateAlert(key, "tts", e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div>
                  <span className="config-label">Título</span>
                  <input
                    className="input-field"
                    value={alertCfg.titleTemplate || ""}
                    onChange={(e) => updateAlert(key, "titleTemplate", e.target.value)}
                    placeholder="Nuevo regalo"
                  />
                </div>

                <div>
                  <span className="config-label">Mensaje</span>
                  <textarea
                    className="input-field"
                    style={{ minHeight: 72, resize: "vertical" }}
                    value={alertCfg.messageTemplate || ""}
                    onChange={(e) => updateAlert(key, "messageTemplate", e.target.value)}
                    placeholder="{user} envio {repeatCount}x {giftName}"
                  />
                </div>

                <div>
                  <span className="config-label">Archivo de sonido</span>
                  <input
                    className="input-field"
                    value={alertCfg.sound || ""}
                    onChange={(e) => updateAlert(key, "sound", e.target.value || null)}
                    placeholder="default_gift.mp3"
                  />
                </div>

                {key === "gift" ? (
                  <div>
                    <span className="config-label">Diamantes mínimos</span>
                    <input
                      className="input-field"
                      type="number"
                      min="0"
                      value={alertCfg.minDiamonds || 0}
                      onChange={(e) =>
                        updateAlert(key, "minDiamonds", Number(e.target.value) || 0)
                      }
                    />
                  </div>
                ) : null}

                <div className="config-row">
                  <span className="config-label">Animación</span>
                  <select
                    className="select-field"
                    value={alertCfg.animation || "slideIn"}
                    onChange={(e) => updateAlert(key, "animation", e.target.value)}
                  >
                    {ANIMATIONS.map((animation) => (
                      <option key={animation} value={animation}>
                        {animation}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="config-row">
                  <span className="config-label">
                    Volumen ({Math.round((alertCfg.volume || 0.5) * 100)}%)
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={alertCfg.volume || 0.5}
                  onChange={(e) => updateAlert(key, "volume", parseFloat(e.target.value))}
                />

                <div className="config-row">
                  <span className="config-label">
                    Duración ({((alertCfg.duration || 5000) / 1000).toFixed(1)}s)
                  </span>
                </div>
                <input
                  type="range"
                  min="1000"
                  max="15000"
                  step="500"
                  value={alertCfg.duration || 5000}
                  onChange={(e) => updateAlert(key, "duration", parseInt(e.target.value, 10))}
                />

                <button className="btn" onClick={() => triggerPreview(key)}>
                  Probar Alerta
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel" style={{ marginTop: 0 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">Configuración TTS Global</div>
            <div className="panel-subtitle">
              Ajustes globales para lectura de comentarios y eventos.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="config-row">
            <span className="config-label">TTS activado</span>
            <label className="toggle">
              <input
                type="checkbox"
                checked={config.tts?.enabled ?? true}
                onChange={(e) => {
                  socket.emit("updateTTS", {
                    ...config.tts,
                    enabled: e.target.checked,
                  });
                }}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="config-row">
            <span className="config-label">Leer nombre de usuario</span>
            <label className="toggle">
              <input
                type="checkbox"
                checked={config.tts?.readUsername ?? true}
                onChange={(e) => {
                  socket.emit("updateTTS", {
                    ...config.tts,
                    readUsername: e.target.checked,
                  });
                }}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="config-row">
            <span className="config-label">Filtro anti-spam</span>
            <label className="toggle">
              <input
                type="checkbox"
                checked={config.tts?.filterSpam ?? true}
                onChange={(e) => {
                  socket.emit("updateTTS", {
                    ...config.tts,
                    filterSpam: e.target.checked,
                  });
                }}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div>
            <span className="config-label">
              Velocidad ({config.tts?.rate?.toFixed(1) || "1.0"})
            </span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={config.tts?.rate || 1}
              onChange={(e) => {
                socket.emit("updateTTS", {
                  ...config.tts,
                  rate: parseFloat(e.target.value),
                });
              }}
            />
          </div>

          <div>
            <span className="config-label">
              Tono ({config.tts?.pitch?.toFixed(1) || "1.0"})
            </span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={config.tts?.pitch || 1}
              onChange={(e) => {
                socket.emit("updateTTS", {
                  ...config.tts,
                  pitch: parseFloat(e.target.value),
                });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
