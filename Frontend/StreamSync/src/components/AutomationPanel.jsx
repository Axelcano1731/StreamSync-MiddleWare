import React, { useEffect, useMemo, useState } from "react";
import socket from "../services/socketService";

const EVENT_TYPES = [
  { key: "gift", label: "Regalos" },
  { key: "follow", label: "Seguidores" },
  { key: "share", label: "Compartidas" },
  { key: "chat", label: "Chat" },
  { key: "like", label: "Likes" },
  { key: "memberJoin", label: "Entradas" },
];

function createEmptyWebhook() {
  return {
    id: "",
    name: "",
    url: "",
    method: "POST",
    enabled: true,
    eventTypes: ["gift"],
    secret: "",
    headersText: "{}",
  };
}

function webhookToDraft(webhook) {
  return {
    id: webhook.id || "",
    name: webhook.name || "",
    url: webhook.url || "",
    method: webhook.method || "POST",
    enabled: webhook.enabled ?? true,
    eventTypes: webhook.eventTypes || [],
    secret: webhook.secret || "",
    headersText: JSON.stringify(webhook.headers || {}, null, 2),
  };
}

function sanitizeId(value) {
  const base = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || `item-${Date.now()}`;
}

function sanitizeMinecraftConfig(config) {
  return {
    ...config,
    minMemoryMb: Number(config.minMemoryMb) || 1024,
    maxMemoryMb: Number(config.maxMemoryMb) || 2048,
    port: Number(config.port) || 25565,
  };
}

export default function AutomationPanel() {
  const [config, setConfig] = useState(null);
  const [webhookDraft, setWebhookDraft] = useState(createEmptyWebhook());
  const [editingWebhookId, setEditingWebhookId] = useState(null);
  const [webhookHistory, setWebhookHistory] = useState([]);
  const [minecraftStatus, setMinecraftStatus] = useState(null);
  const [minecraftDraft, setMinecraftDraft] = useState({
    javaPath: "java",
    serverJar: "",
    serverDirectory: "",
    minMemoryMb: 2048,
    maxMemoryMb: 4096,
    port: 25565,
    autoAcceptEula: false,
    startupArgs: "",
  });
  const [minecraftCommand, setMinecraftCommand] = useState("");
  const [webhookMessage, setWebhookMessage] = useState("");
  const [minecraftMessage, setMinecraftMessage] = useState("");

  useEffect(() => {
    socket.emit("getAlertConfig", (cfg) => {
      setConfig(cfg);
      if (cfg?.minecraft) {
        setMinecraftDraft(cfg.minecraft);
      }
    });

    socket.emit("getWebhookHistory", (history) => {
      setWebhookHistory(Array.isArray(history) ? history : []);
    });

    socket.emit("getMinecraftStatus", (status) => {
      setMinecraftStatus(status);
      if (status?.config) {
        setMinecraftDraft(status.config);
      }
    });

    const handleConfig = (cfg) => {
      setConfig(cfg);
      if (cfg?.minecraft) {
        setMinecraftDraft((prev) => ({
          ...prev,
          ...cfg.minecraft,
        }));
      }
    };

    const handleWebhookDelivery = (entry) => {
      setWebhookHistory((prev) => [entry, ...prev].slice(0, 50));
    };

    const handleMinecraftStatus = (status) => {
      setMinecraftStatus(status);
      if (status?.config) {
        setMinecraftDraft((prev) => ({
          ...prev,
          ...status.config,
        }));
      }
    };

    const handleMinecraftLog = (entry) => {
      setMinecraftStatus((prev) => {
        if (!prev) return prev;
        const logs = [...(prev.logs || []), entry].slice(-250);
        return { ...prev, logs };
      });
    };

    socket.on("alertConfig", handleConfig);
    socket.on("webhookDelivery", handleWebhookDelivery);
    socket.on("minecraftStatus", handleMinecraftStatus);
    socket.on("minecraftLog", handleMinecraftLog);

    return () => {
      socket.off("alertConfig", handleConfig);
      socket.off("webhookDelivery", handleWebhookDelivery);
      socket.off("minecraftStatus", handleMinecraftStatus);
      socket.off("minecraftLog", handleMinecraftLog);
    };
  }, []);

  const webhooks = config?.webhooks?.items || [];
  const minecraftLogs = useMemo(
    () => (minecraftStatus?.logs || []).slice(-80).reverse(),
    [minecraftStatus]
  );

  const saveWebhooks = (items) => {
    if (!config) return;
    socket.emit("updateWebhooks", {
      ...config.webhooks,
      items,
    });
  };

  const toggleEventType = (eventKey) => {
    setWebhookDraft((prev) => {
      const hasEvent = prev.eventTypes.includes(eventKey);
      return {
        ...prev,
        eventTypes: hasEvent
          ? prev.eventTypes.filter((item) => item !== eventKey)
          : [...prev.eventTypes, eventKey],
      };
    });
  };

  const handleSaveWebhook = () => {
    try {
      const headers = JSON.parse(webhookDraft.headersText || "{}");
      const safeId = sanitizeId(webhookDraft.id || webhookDraft.name);
      const nextWebhook = {
        id: safeId,
        name: webhookDraft.name.trim() || safeId,
        url: webhookDraft.url.trim(),
        method: webhookDraft.method,
        enabled: webhookDraft.enabled,
        eventTypes: webhookDraft.eventTypes,
        secret: webhookDraft.secret.trim(),
        headers,
      };

      const nextItems = editingWebhookId
        ? webhooks.map((item) => (item.id === editingWebhookId ? nextWebhook : item))
        : [...webhooks, nextWebhook];

      saveWebhooks(nextItems);
      setEditingWebhookId(null);
      setWebhookDraft(createEmptyWebhook());
      setWebhookMessage("Webhook guardado correctamente.");
    } catch (error) {
      setWebhookMessage(`Encabezados JSON inválidos: ${error.message}`);
    }
  };

  const handleEditWebhook = (webhook) => {
    setEditingWebhookId(webhook.id);
    setWebhookDraft(webhookToDraft(webhook));
    setWebhookMessage("");
  };

  const handleDeleteWebhook = (webhookId) => {
    saveWebhooks(webhooks.filter((item) => item.id !== webhookId));
    if (editingWebhookId === webhookId) {
      setEditingWebhookId(null);
      setWebhookDraft(createEmptyWebhook());
    }
    setWebhookMessage("Webhook eliminado.");
  };

  const handleTestWebhook = (webhookId) => {
    socket.emit("testWebhook", webhookId, (response) => {
      setWebhookMessage(
        response?.ok
          ? "Prueba enviada correctamente."
          : `No se pudo probar el webhook: ${response?.error || "Error desconocido"}`
      );
    });
  };

  const handleSaveMinecraftConfig = () => {
    const payload = sanitizeMinecraftConfig(minecraftDraft);
    socket.emit("updateMinecraftConfig", payload, (response) => {
      setMinecraftMessage(
        response?.ok
          ? "Configuración de Minecraft guardada."
          : `No se pudo guardar: ${response?.error || "Error desconocido"}`
      );
    });
  };

  const handleStartMinecraft = () => {
    const payload = sanitizeMinecraftConfig(minecraftDraft);
    socket.emit("startMinecraftServer", payload, (response) => {
      setMinecraftMessage(
        response?.ok
          ? `Servidor iniciando en ${response.status?.address || "localhost:25565"}`
          : `No se pudo iniciar: ${response?.error || "Error desconocido"}`
      );
    });
  };

  const handleStopMinecraft = () => {
    socket.emit("stopMinecraftServer", (response) => {
      setMinecraftMessage(
        response?.ok
          ? "Solicitud de apagado enviada al servidor."
          : `No se pudo detener: ${response?.error || "Error desconocido"}`
      );
    });
  };

  const handleSendMinecraftCommand = () => {
    if (!minecraftCommand.trim()) return;
    socket.emit("sendMinecraftCommand", minecraftCommand.trim(), (response) => {
      setMinecraftMessage(
        response?.ok
          ? `Comando enviado: ${minecraftCommand.trim()}`
          : `No se pudo enviar el comando: ${response?.error || "Error desconocido"}`
      );
      if (response?.ok) {
        setMinecraftCommand("");
      }
    });
  };

  if (!config) {
    return (
      <div className="page-enter">
        <div className="panel">
          <div className="empty-state">
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-text">Cargando automatizaciones...</div>
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
            <div className="panel-title">Automatización del Stream</div>
            <div className="panel-subtitle">
              Webhooks para integraciones externas y control local de Minecraft.
            </div>
          </div>
        </div>

        <div className="alert-config-card" style={{ marginBottom: 0 }}>
          <div className="alert-config-title" style={{ marginBottom: 10 }}>
            <span>🧩</span> Payload de webhooks
          </div>
          <div style={{ fontSize: "0.82em", color: "var(--text-secondary)", lineHeight: 1.7 }}>
            Cada webhook recibe un JSON con `source`, `timestamp`, `eventType`,
            `user`, `data` y `meta`. Si configuras un secreto, también se envía
            `X-StreamSync-Signature` con firma HMAC SHA256.
          </div>
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
              <div className="panel-title">Creador de Webhooks</div>
              <div className="panel-subtitle">
                {webhooks.length} webhooks configurados
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
                  value={webhookDraft.name}
                  onChange={(e) =>
                    setWebhookDraft((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Discord regalos"
                />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Método</label>
                <select
                  className="select-field"
                  value={webhookDraft.method}
                  onChange={(e) =>
                    setWebhookDraft((prev) => ({ ...prev, method: e.target.value }))
                  }
                >
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="GET">GET</option>
                </select>
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>URL del webhook</label>
              <input
                className="input-field"
                value={webhookDraft.url}
                onChange={(e) =>
                  setWebhookDraft((prev) => ({ ...prev, url: e.target.value }))
                }
                placeholder="https://..."
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Secreto opcional</label>
                <input
                  className="input-field"
                  value={webhookDraft.secret}
                  onChange={(e) =>
                    setWebhookDraft((prev) => ({ ...prev, secret: e.target.value }))
                  }
                  placeholder="clave-hmac"
                />
              </div>

              <div className="config-row" style={{ alignItems: "end", paddingBottom: 6 }}>
                <span className="config-label">Activo</span>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={webhookDraft.enabled}
                    onChange={(e) =>
                      setWebhookDraft((prev) => ({
                        ...prev,
                        enabled: e.target.checked,
                      }))
                    }
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Eventos que disparan el webhook</label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 8,
                }}
              >
                {EVENT_TYPES.map((eventType) => {
                  const checked = webhookDraft.eventTypes.includes(eventType.key);
                  return (
                    <button
                      key={eventType.key}
                      className={`filter-tab ${checked ? "active" : ""}`}
                      type="button"
                      onClick={() => toggleEventType(eventType.key)}
                    >
                      {eventType.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Headers extra en JSON</label>
              <textarea
                className="input-field"
                style={{ minHeight: 110, resize: "vertical" }}
                value={webhookDraft.headersText}
                onChange={(e) =>
                  setWebhookDraft((prev) => ({
                    ...prev,
                    headersText: e.target.value,
                  }))
                }
                placeholder='{"Authorization":"Bearer ..."}'
              />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn btn-primary" onClick={handleSaveWebhook}>
                {editingWebhookId ? "Actualizar Webhook" : "Crear Webhook"}
              </button>
              <button
                className="btn"
                onClick={() => {
                  setEditingWebhookId(null);
                  setWebhookDraft(createEmptyWebhook());
                  setWebhookMessage("");
                }}
              >
                Limpiar
              </button>
            </div>

            {webhookMessage ? (
              <div className="alert-config-card" style={{ padding: 12 }}>
                <div style={{ fontSize: "0.82em", color: "var(--text-secondary)" }}>
                  {webhookMessage}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Lista de Webhooks</div>
              <div className="panel-subtitle">
                Edita, prueba o elimina integraciones existentes
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {webhooks.length > 0 ? (
              webhooks.map((webhook) => (
                <div key={webhook.id} className="alert-config-card">
                  <div className="alert-config-header">
                    <div className="alert-config-title">
                      <span>{webhook.enabled ? "🟢" : "⚪"}</span>
                      {webhook.name}
                    </div>
                  </div>

                  <div style={{ fontSize: "0.8em", color: "var(--text-muted)", marginBottom: 10 }}>
                    {webhook.url}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginBottom: 12,
                    }}
                  >
                    {(webhook.eventTypes || []).map((eventType) => (
                      <span key={eventType} className="event-badge share">
                        {eventType}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn" onClick={() => handleEditWebhook(webhook)}>
                      Editar
                    </button>
                    <button className="btn" onClick={() => handleTestWebhook(webhook.id)}>
                      Probar
                    </button>
                    <button className="btn btn-danger" onClick={() => handleDeleteWebhook(webhook.id)}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state" style={{ padding: 24 }}>
                <div className="empty-state-icon">🪝</div>
                <div className="empty-state-text">
                  Todavía no hay webhooks creados.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Historial de Entregas</div>
            <div className="panel-subtitle">
              Últimos eventos enviados hacia tus integraciones
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {webhookHistory.length > 0 ? (
            webhookHistory.slice(0, 12).map((entry) => (
              <div key={entry.id} className="event-log-item" style={{ borderRadius: 10 }}>
                <span className="event-log-time">
                  {new Date(entry.createdAt).toLocaleTimeString("es", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                <span className="event-log-icon">
                  {entry.ok ? "✅" : "⚠️"}
                </span>
                <div className="event-log-content">
                  <span className="event-log-user">{entry.webhookName}</span>{" "}
                  {entry.eventType} · {entry.httpStatus || entry.error || "sin respuesta"}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-state-text">Sin entregas todavía.</div>
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Servidor Local de Minecraft</div>
            <div className="panel-subtitle">
              Levanta un servidor Java desde la app y contrólalo por localhost.
            </div>
          </div>

          <div className={`status-badge ${minecraftStatus?.status || "stopped"}`}>
            <span className="status-dot"></span>
            {(minecraftStatus?.status || "stopped").toUpperCase()}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label>Ruta del .jar</label>
            <input
              className="input-field"
              value={minecraftDraft.serverJar || ""}
              onChange={(e) =>
                setMinecraftDraft((prev) => ({ ...prev, serverJar: e.target.value }))
              }
              placeholder="C:\\Minecraft\\server.jar"
            />
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label>Carpeta del servidor</label>
            <input
              className="input-field"
              value={minecraftDraft.serverDirectory || ""}
              onChange={(e) =>
                setMinecraftDraft((prev) => ({
                  ...prev,
                  serverDirectory: e.target.value,
                }))
              }
              placeholder="C:\\Minecraft"
            />
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label>Ruta de Java</label>
            <input
              className="input-field"
              value={minecraftDraft.javaPath || ""}
              onChange={(e) =>
                setMinecraftDraft((prev) => ({ ...prev, javaPath: e.target.value }))
              }
              placeholder="java"
            />
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label>Puerto local</label>
            <input
              className="input-field"
              type="number"
              value={minecraftDraft.port || 25565}
              onChange={(e) =>
                setMinecraftDraft((prev) => ({ ...prev, port: e.target.value }))
              }
            />
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label>Memoria mínima (MB)</label>
            <input
              className="input-field"
              type="number"
              value={minecraftDraft.minMemoryMb || 1024}
              onChange={(e) =>
                setMinecraftDraft((prev) => ({
                  ...prev,
                  minMemoryMb: e.target.value,
                }))
              }
            />
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label>Memoria máxima (MB)</label>
            <input
              className="input-field"
              type="number"
              value={minecraftDraft.maxMemoryMb || 2048}
              onChange={(e) =>
                setMinecraftDraft((prev) => ({
                  ...prev,
                  maxMemoryMb: e.target.value,
                }))
              }
            />
          </div>
        </div>

        <div className="input-group" style={{ marginBottom: 16 }}>
          <label>Argumentos extra de arranque</label>
          <input
            className="input-field"
            value={minecraftDraft.startupArgs || ""}
            onChange={(e) =>
              setMinecraftDraft((prev) => ({
                ...prev,
                startupArgs: e.target.value,
              }))
            }
            placeholder="-Dcom.mojang.eula.agree=true"
          />
        </div>

        <div className="config-row" style={{ marginBottom: 16 }}>
          <span className="config-label">Aceptar automáticamente el EULA</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={minecraftDraft.autoAcceptEula ?? false}
              onChange={(e) =>
                setMinecraftDraft((prev) => ({
                  ...prev,
                  autoAcceptEula: e.target.checked,
                }))
              }
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <button className="btn" onClick={handleSaveMinecraftConfig}>
            Guardar Configuración
          </button>
          <button className="btn btn-primary" onClick={handleStartMinecraft}>
            Iniciar Servidor
          </button>
          <button className="btn btn-danger" onClick={handleStopMinecraft}>
            Detener Servidor
          </button>
        </div>

        <div
          className="alert-config-card"
          style={{ display: "grid", gap: 12, marginBottom: 16 }}
        >
          <div className="config-row">
            <span className="config-label">Dirección publicada</span>
            <span className="config-value">{minecraftStatus?.address || "localhost:25565"}</span>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <input
              className="input-field"
              value={minecraftCommand}
              onChange={(e) => setMinecraftCommand(e.target.value)}
              placeholder="say Hola chat"
              disabled={!minecraftStatus?.isRunning}
            />
            <button className="btn" onClick={handleSendMinecraftCommand} disabled={!minecraftStatus?.isRunning}>
              Enviar
            </button>
          </div>
        </div>

        {minecraftMessage ? (
          <div className="alert-config-card" style={{ padding: 12, marginBottom: 16 }}>
            <div style={{ fontSize: "0.82em", color: "var(--text-secondary)" }}>
              {minecraftMessage}
            </div>
          </div>
        ) : null}

        <div className="alert-config-card">
          <div className="alert-config-title" style={{ marginBottom: 10 }}>
            <span>📜</span> Consola del servidor
          </div>
          <div
            style={{
              background: "rgba(0,0,0,0.35)",
              borderRadius: 10,
              padding: 12,
              maxHeight: 280,
              overflowY: "auto",
              fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
              fontSize: "0.78em",
              lineHeight: 1.6,
              color: "var(--text-secondary)",
            }}
          >
            {minecraftLogs.length > 0 ? (
              minecraftLogs.map((entry) => (
                <div key={entry.id}>
                  [{new Date(entry.timestamp).toLocaleTimeString("es", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}] {entry.source}: {entry.line}
                </div>
              ))
            ) : (
              <div>Sin logs todavía.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
