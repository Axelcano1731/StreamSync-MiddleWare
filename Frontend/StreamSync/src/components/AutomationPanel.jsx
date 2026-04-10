import React, { useEffect, useState } from "react";
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

export default function AutomationPanel() {
  const [config, setConfig] = useState(null);
  const [webhookDraft, setWebhookDraft] = useState(createEmptyWebhook());
  const [editingWebhookId, setEditingWebhookId] = useState(null);
  const [webhookHistory, setWebhookHistory] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    socket.emit("getAlertConfig", (cfg) => {
      setConfig(cfg);
    });

    socket.emit("getWebhookHistory", (history) => {
      setWebhookHistory(Array.isArray(history) ? history : []);
    });

    const handleConfig = (cfg) => setConfig(cfg);
    const handleWebhookDelivery = (entry) => {
      setWebhookHistory((prev) => [entry, ...prev].slice(0, 50));
    };

    socket.on("alertConfig", handleConfig);
    socket.on("webhookDelivery", handleWebhookDelivery);

    return () => {
      socket.off("alertConfig", handleConfig);
      socket.off("webhookDelivery", handleWebhookDelivery);
    };
  }, []);

  const webhooks = config?.webhooks?.items || [];

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
      setMessage("Webhook guardado correctamente.");
    } catch (error) {
      setMessage(`Encabezados JSON inválidos: ${error.message}`);
    }
  };

  const handleEditWebhook = (webhook) => {
    setEditingWebhookId(webhook.id);
    setWebhookDraft(webhookToDraft(webhook));
    setMessage("");
  };

  const handleDeleteWebhook = (webhookId) => {
    saveWebhooks(webhooks.filter((item) => item.id !== webhookId));
    if (editingWebhookId === webhookId) {
      setEditingWebhookId(null);
      setWebhookDraft(createEmptyWebhook());
    }
    setMessage("Webhook eliminado.");
  };

  const handleTestWebhook = (webhookId) => {
    socket.emit("testWebhook", webhookId, (response) => {
      setMessage(
        response?.ok
          ? "Prueba enviada correctamente."
          : `No se pudo probar el webhook: ${response?.error || "Error desconocido"}`
      );
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
            <div className="panel-title">Automatización por Webhooks</div>
            <div className="panel-subtitle">
              Dispara integraciones externas con los eventos del directo.
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
          {message ? (
            <div style={{ marginTop: 10, fontSize: "0.82em", color: "var(--text-secondary)" }}>
              {message}
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
                  setMessage("");
                }}
              >
                Limpiar
              </button>
            </div>
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
                <span className="event-log-icon">{entry.ok ? "✅" : "⚠️"}</span>
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
    </div>
  );
}
