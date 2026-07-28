import React, { useCallback, useEffect, useMemo, useState } from "react";
import socket from "../services/socketService";

const params = new URLSearchParams(window.location.search);
const backendPort = params.get("backendPort") || "3000";
const BACKEND_URL = `http://127.0.0.1:${backendPort}`;
const API = `${BACKEND_URL}/api/game-actions`;

const EVENT_LABELS = {
  gift: "🎁 Regalo",
  like: "❤️ Likes",
  follow: "➕ Nuevo seguidor",
  share: "↪️ Compartir directo",
  chat: "💬 Comentario",
  subscribe: "⭐ Suscripción",
  memberJoin: "👋 Entrada al directo",
};

const CHAT_MODES = [
  { value: "any", label: "Cualquier comentario" },
  { value: "equals", label: "El texto exacto" },
  { value: "startsWith", label: "Empieza por" },
  { value: "contains", label: "Contiene" },
];

const SCALE_MODES = [
  { value: "fixed", label: "Cantidad fija" },
  { value: "combo", label: "Según el combo del regalo" },
  { value: "diamonds", label: "Según las monedas del regalo" },
  { value: "likes", label: "Según los umbrales de likes cruzados" },
];

const AUDIENCE_KEYS = [
  { key: "everyone", label: "Todos" },
  { key: "moderators", label: "Mods" },
  { key: "subscribers", label: "Subs" },
  { key: "followers", label: "Seguidores" },
  { key: "fansClub", label: "Club de fans" },
];

function newRule() {
  return {
    id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: "Nueva regla",
    enabled: true,
    event: "gift",
    giftName: "",
    giftId: "",
    minDiamonds: 0,
    maxDiamonds: 0,
    chatMode: "any",
    chatText: "",
    audience: { everyone: true, moderators: false, subscribers: false, followers: false, fansClub: false },
    likesPerTrigger: 0,
    likesPerUser: true,
    method: "GET",
    path: "",
    params: [{ key: "username", value: "{nickname}" }],
    scaleMode: "fixed",
    scaleFixed: 1,
    scalePer: 1,
    scaleMax: 10,
    sendMode: "quantity",
    spacingMs: 0,
    cooldownSec: 0,
    cooldownPerUser: false,
  };
}

// Vista previa de la URL que se llamará, con los placeholders sin resolver.
function previewUrl(baseUrl, rule) {
  if (!rule.path) return "(sin endpoint)";
  const isAbsolute = /^https?:\/\//i.test(rule.path);
  const base = isAbsolute ? rule.path : `${baseUrl}/${rule.path.replace(/^\/+/, "")}`;
  const query = rule.params
    .filter((p) => p.key)
    .map((p) => `${p.key}=${p.value}`)
    .join("&");
  return query ? `${base}?${query}` : base;
}

function Field({ label, children, style }) {
  return (
    <div className="input-group" style={{ marginBottom: 0, ...style }}>
      <label>{label}</label>
      {children}
    </div>
  );
}

function RuleCard({ rule, baseUrl, preset, onChange, onDelete, onTest, testResult }) {
  const [open, setOpen] = useState(false);
  const set = (patch) => onChange({ ...rule, ...patch });

  const setParam = (i, patch) =>
    set({ params: rule.params.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });

  const addParam = () => set({ params: [...rule.params, { key: "", value: "" }] });
  const removeParam = (i) => set({ params: rule.params.filter((_, idx) => idx !== i) });

  // Al elegir un endpoint documentado del juego, rellenamos sus parámetros
  // habituales sin pisar los que el usuario ya haya escrito.
  const applyEndpoint = (endpoint) => {
    if (!endpoint) return;
    const existing = new Map(rule.params.map((p) => [p.key, p.value]));
    const defaults = { username: "{nickname}", quantity: "{quantity}", id: "0" };
    const merged = endpoint.params.map((key) => ({
      key,
      value: existing.get(key) ?? defaults[key] ?? "",
    }));
    const extras = rule.params.filter((p) => p.key && !endpoint.params.includes(p.key));
    set({ path: endpoint.path, params: [...merged, ...extras] });
  };

  const monsters = preset?.options?.monsters || [];
  const idParamIndex = rule.params.findIndex((p) => p.key === "id");

  return (
    <div className="alert-config-card" style={{ opacity: rule.enabled ? 1 : 0.6 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label className="toggle" style={{ flex: "0 0 auto" }} title="Activar regla">
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={(e) => set({ enabled: e.target.checked })}
          />
          <span className="toggle-slider"></span>
        </label>

        <input
          className="input-field"
          style={{ flex: "1 1 200px", fontWeight: 600 }}
          value={rule.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Nombre de la regla"
        />

        <select
          className="select-field"
          style={{ flex: "0 1 190px" }}
          value={rule.event}
          onChange={(e) => set({ event: e.target.value })}
        >
          {Object.entries(EVENT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <button className="btn" onClick={() => setOpen((v) => !v)}>
          {open ? "▲ Cerrar" : "▼ Editar"}
        </button>
        <button className="btn" onClick={onTest} title="Guarda y lanza esta regla contra el juego">
          🎯 Probar
        </button>
        <button className="btn btn-danger" onClick={onDelete} title="Eliminar regla">
          ✕
        </button>
      </div>

      <div
        style={{
          marginTop: 10,
          fontSize: "0.78em",
          color: "var(--text-muted)",
          fontFamily: "Consolas, monospace",
          wordBreak: "break-all",
        }}
      >
        {rule.method} {previewUrl(baseUrl, rule)}
      </div>

      {testResult ? (
        <div
          className={testResult.ok ? "minecraft-validation-ok" : "minecraft-validation-errors"}
          style={{ marginTop: 10, fontSize: "0.82em" }}
        >
          {testResult.ok
            ? `Llamada enviada (HTTP ${testResult.status}).`
            : `No se pudo llamar al juego: ${testResult.error || `HTTP ${testResult.status}`}`}
        </div>
      ) : null}

      {open ? (
        <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
          {/* ── Condiciones ── */}
          <div style={{ fontWeight: 700, fontSize: "0.85em" }}>1 · Cuándo se dispara</div>

          {rule.event === "gift" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
              <Field label="Nombre del regalo (vacío = cualquiera)">
                <input
                  className="input-field"
                  value={rule.giftName}
                  onChange={(e) => set({ giftName: e.target.value })}
                  placeholder="Rose"
                />
              </Field>
              <Field label="ID del regalo (opcional)">
                <input
                  className="input-field"
                  value={rule.giftId}
                  onChange={(e) => set({ giftId: e.target.value })}
                  placeholder="5655"
                />
              </Field>
              <Field label="Mínimo 💎">
                <input
                  className="input-field"
                  type="number"
                  value={rule.minDiamonds}
                  onChange={(e) => set({ minDiamonds: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="Máximo 💎 (0 = sin tope)">
                <input
                  className="input-field"
                  type="number"
                  value={rule.maxDiamonds}
                  onChange={(e) => set({ maxDiamonds: Number(e.target.value) || 0 })}
                />
              </Field>
            </div>
          ) : null}

          {rule.event === "chat" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              <Field label="Coincidencia">
                <select
                  className="select-field"
                  value={rule.chatMode}
                  onChange={(e) => set({ chatMode: e.target.value })}
                >
                  {CHAT_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>
              {rule.chatMode !== "any" ? (
                <Field label="Texto del comando">
                  <input
                    className="input-field"
                    value={rule.chatText}
                    onChange={(e) => set({ chatText: e.target.value })}
                    placeholder="B"
                  />
                </Field>
              ) : null}
            </div>
          ) : null}

          {rule.event === "like" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              <Field label="Likes necesarios (0 = cada evento)">
                <input
                  className="input-field"
                  type="number"
                  value={rule.likesPerTrigger}
                  onChange={(e) => set({ likesPerTrigger: Number(e.target.value) || 0 })}
                />
              </Field>
              <div className="config-row" style={{ alignItems: "end", paddingBottom: 6 }}>
                <span className="config-label">Contar por espectador</span>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={rule.likesPerUser}
                    onChange={(e) => set({ likesPerUser: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          ) : null}

          <Field label="Quién puede activarla">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {AUDIENCE_KEYS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  className={`filter-tab ${rule.audience[a.key] ? "active" : ""}`}
                  onClick={() =>
                    set({
                      audience:
                        a.key === "everyone"
                          ? { ...rule.audience, everyone: !rule.audience.everyone }
                          : { ...rule.audience, everyone: false, [a.key]: !rule.audience[a.key] },
                    })
                  }
                >
                  {a.label}
                </button>
              ))}
            </div>
          </Field>

          {/* ── Petición ── */}
          <div style={{ fontWeight: 700, fontSize: "0.85em", marginTop: 4 }}>2 · Qué llama en el juego</div>

          {preset?.endpoints?.length ? (
            <Field label="Endpoints del juego">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {preset.endpoints.map((ep) => (
                  <button
                    key={ep.path}
                    type="button"
                    className={`filter-tab ${rule.path === ep.path ? "active" : ""}`}
                    title={ep.hint}
                    onClick={() => applyEndpoint(ep)}
                  >
                    {ep.label}
                  </button>
                ))}
              </div>
            </Field>
          ) : null}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Field label="Método" style={{ flex: "0 0 110px" }}>
              <select
                className="select-field"
                value={rule.method}
                onChange={(e) => set({ method: e.target.value })}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </Field>
            <Field label="Ruta (o URL completa)" style={{ flex: "1 1 220px" }}>
              <input
                className="input-field"
                style={{ fontFamily: "Consolas, monospace" }}
                value={rule.path}
                onChange={(e) => set({ path: e.target.value })}
                placeholder="/spawnMonster"
              />
            </Field>
          </div>

          <Field label="Parámetros de la URL">
            <div style={{ display: "grid", gap: 8 }}>
              {rule.params.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    className="input-field"
                    style={{ flex: "0 1 150px" }}
                    value={p.key}
                    onChange={(e) => setParam(i, { key: e.target.value })}
                    placeholder="id"
                  />
                  {p.key === "id" && monsters.length && i === idParamIndex ? (
                    <select
                      className="select-field"
                      style={{ flex: 1 }}
                      value={monsters.some((m) => m.id === p.value) ? p.value : ""}
                      onChange={(e) => setParam(i, { value: e.target.value })}
                    >
                      <option value="">— valor personalizado ({p.value || "vacío"}) —</option>
                      {monsters.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input-field"
                      style={{ flex: 1, fontFamily: "Consolas, monospace" }}
                      value={p.value}
                      onChange={(e) => setParam(i, { value: e.target.value })}
                      placeholder="{nickname}"
                    />
                  )}
                  <button className="btn btn-danger" onClick={() => removeParam(i)}>
                    ✕
                  </button>
                </div>
              ))}
              <button className="btn" style={{ justifySelf: "start" }} onClick={addParam}>
                ➕ Añadir parámetro
              </button>
            </div>
          </Field>

          {/* ── Escalado ── */}
          <div style={{ fontWeight: 700, fontSize: "0.85em", marginTop: 4 }}>3 · Cuánto genera</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            <Field label="Cantidad calculada por">
              <select
                className="select-field"
                value={rule.scaleMode}
                onChange={(e) => set({ scaleMode: e.target.value })}
              >
                {SCALE_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>

            {rule.scaleMode === "fixed" ? (
              <Field label="Cantidad">
                <input
                  className="input-field"
                  type="number"
                  value={rule.scaleFixed}
                  onChange={(e) => set({ scaleFixed: Number(e.target.value) || 1 })}
                />
              </Field>
            ) : null}

            {rule.scaleMode === "diamonds" ? (
              <Field label="Monedas por unidad">
                <input
                  className="input-field"
                  type="number"
                  value={rule.scalePer}
                  onChange={(e) => set({ scalePer: Number(e.target.value) || 1 })}
                />
              </Field>
            ) : null}

            <Field label="Máximo por evento">
              <input
                className="input-field"
                type="number"
                value={rule.scaleMax}
                onChange={(e) => set({ scaleMax: Number(e.target.value) || 1 })}
              />
            </Field>

            <Field label="Forma de enviar">
              <select
                className="select-field"
                value={rule.sendMode}
                onChange={(e) => set({ sendMode: e.target.value })}
              >
                <option value="quantity">1 llamada con quantity={"{quantity}"}</option>
                <option value="repeat">Repetir la llamada N veces</option>
              </select>
            </Field>

            {rule.sendMode === "repeat" ? (
              <Field label="Pausa entre llamadas (ms)">
                <input
                  className="input-field"
                  type="number"
                  value={rule.spacingMs}
                  onChange={(e) => set({ spacingMs: Number(e.target.value) || 0 })}
                />
              </Field>
            ) : null}

            <Field label="Enfriamiento (s)">
              <input
                className="input-field"
                type="number"
                value={rule.cooldownSec}
                onChange={(e) => set({ cooldownSec: Number(e.target.value) || 0 })}
              />
            </Field>

            <div className="config-row" style={{ alignItems: "end", paddingBottom: 6 }}>
              <span className="config-label">Enfriar por espectador</span>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={rule.cooldownPerUser}
                  onChange={(e) => set({ cooldownPerUser: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function GamesPanel() {
  const [config, setConfig] = useState(null);
  const [presets, setPresets] = useState([]);
  const [placeholders, setPlaceholders] = useState([]);
  const [presetId, setPresetId] = useState("league-of-monsters");
  const [history, setHistory] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [ping, setPing] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    fetch(API)
      .then((r) => r.json())
      .then((data) => {
        if (!data?.config) return;
        setConfig(data.config);
        setPresets(data.presets || []);
        setPlaceholders(data.placeholders || []);
        setHistory(data.history || []);
      })
      .catch(() => setMessage("No se pudo conectar con el backend."));

    const onDelivery = (entry) => setHistory((prev) => [entry, ...prev].slice(0, 40));
    socket.on("gameActionDelivery", onDelivery);
    return () => socket.off("gameActionDelivery", onDelivery);
  }, []);

  const preset = useMemo(
    () => presets.find((p) => p.id === presetId) || presets[0] || null,
    [presets, presetId]
  );

  const flash = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 4000);
  };

  const patchConfig = (patch) => {
    setConfig((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  // Guarda la config completa (ajustes + todas las reglas) y devuelve la
  // versión normalizada por el backend.
  const save = useCallback(
    async (override) => {
      const body = override || config;
      if (!body) return null;

      const res = await fetch(API, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: body.enabled,
          baseUrl: body.baseUrl,
          timeoutMs: body.timeoutMs,
          rules: body.rules,
        }),
      });

      const saved = await res.json();
      setConfig(saved);
      setDirty(false);
      return saved;
    },
    [config]
  );

  const handleSave = async () => {
    try {
      await save();
      flash("Reglas guardadas. Ya están activas en el directo.");
    } catch {
      flash("No se pudieron guardar las reglas.");
    }
  };

  const updateRule = (index, next) => {
    setConfig((prev) => ({
      ...prev,
      rules: prev.rules.map((r, i) => (i === index ? next : r)),
    }));
    setDirty(true);
  };

  const addRule = () => {
    setConfig((prev) => ({ ...prev, rules: [...prev.rules, newRule()] }));
    setDirty(true);
  };

  const removeRule = (index) => {
    setConfig((prev) => ({ ...prev, rules: prev.rules.filter((_, i) => i !== index) }));
    setDirty(true);
  };

  const testRule = async (rule) => {
    try {
      const saved = await save();
      const target = saved?.rules?.find((r) => r.id === rule.id) || rule;
      const res = await fetch(`${API}/rules/${encodeURIComponent(target.id)}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setTestResults((prev) => ({
        ...prev,
        [rule.id]: data.result || { ok: false, error: data.error },
      }));
    } catch (error) {
      setTestResults((prev) => ({ ...prev, [rule.id]: { ok: false, error: error.message } }));
    }
  };

  const loadPreset = async (mode) => {
    if (!preset) return;
    if (mode === "replace" && !window.confirm(`Esto borrará tus reglas actuales y pondrá las de ${preset.name}. ¿Seguir?`)) {
      return;
    }

    const res = await fetch(`${API}/presets/${preset.id}?mode=${mode}`, { method: "POST" });
    const saved = await res.json();
    setConfig(saved);
    setDirty(false);
    flash(`Reglas de ${preset.name} cargadas.`);
  };

  const testConnection = async () => {
    setPing({ loading: true });
    try {
      const res = await fetch(`${API}/ping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: config.baseUrl }),
      });
      setPing(await res.json());
    } catch (error) {
      setPing({ reachable: false, error: error.message });
    }
  };

  const resetCounters = async () => {
    await fetch(`${API}/reset-counters`, { method: "POST" });
    flash("Contadores de likes y enfriamientos reiniciados.");
  };

  if (!config) {
    return (
      <div className="page-enter">
        <div className="panel">
          <div className="empty-state">
            <div className="empty-state-icon">🎮</div>
            <div className="empty-state-text">{message || "Cargando juegos..."}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ display: "grid", gap: 20 }}>
      {/* ── Conexión con el juego ── */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Conexión con el juego</div>
            <div className="panel-subtitle">
              StreamSync llama a los webhooks locales de tu juego cuando pasa algo en el directo.
            </div>
          </div>
          <label className="toggle" title="Activar o desactivar todas las reglas">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => patchConfig({ enabled: e.target.checked })}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <Field label="Juego">
            <select
              className="select-field"
              value={preset?.id || ""}
              onChange={(e) => setPresetId(e.target.value)}
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.icon} {p.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="URL del juego">
            <input
              className="input-field"
              style={{ fontFamily: "Consolas, monospace" }}
              value={config.baseUrl}
              onChange={(e) => patchConfig({ baseUrl: e.target.value })}
              placeholder="http://localhost:5729"
            />
          </Field>

          <Field label="Timeout (ms)">
            <input
              className="input-field"
              type="number"
              value={config.timeoutMs}
              onChange={(e) => patchConfig({ timeoutMs: Number(e.target.value) || 5000 })}
            />
          </Field>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <button className="btn" onClick={testConnection}>
            📡 Probar conexión
          </button>
          <button className="btn" onClick={() => loadPreset("append")} disabled={!preset}>
            ➕ Añadir reglas de {preset?.name || "preset"}
          </button>
          <button className="btn btn-danger" onClick={() => loadPreset("replace")} disabled={!preset}>
            ♻️ Reemplazar por las del preset
          </button>
          <button className="btn" onClick={resetCounters}>
            🔄 Reiniciar contadores
          </button>
          <button className="btn" onClick={() => setShowHelp((v) => !v)}>
            {showHelp ? "Ocultar ayuda" : "❔ Ayuda y variables"}
          </button>
        </div>

        {ping ? (
          <div
            className={
              ping.loading ? "minecraft-info-card" : ping.reachable ? "minecraft-validation-ok" : "minecraft-validation-errors"
            }
            style={{ marginTop: 14 }}
          >
            {ping.loading
              ? "Comprobando..."
              : ping.reachable
              ? `El juego responde en ${config.baseUrl} (HTTP ${ping.status}, ${ping.durationMs} ms).`
              : `No responde: ${ping.error}. Abre el juego y comprueba el puerto.`}
          </div>
        ) : null}

        {message ? (
          <div className="minecraft-info-card" style={{ marginTop: 14 }}>
            {message}
          </div>
        ) : null}

        {showHelp ? (
          <div className="minecraft-info-card" style={{ marginTop: 14, display: "grid", gap: 12 }}>
            {preset?.notes?.length ? (
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{preset.icon} {preset.name}</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.83em", lineHeight: 1.7 }}>
                  {preset.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Variables disponibles</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 6 }}>
                {placeholders.map((p) => (
                  <div key={p.token} style={{ fontSize: "0.8em" }}>
                    <code style={{ color: "var(--text-primary)" }}>{p.token}</code>{" "}
                    <span style={{ color: "var(--text-muted)" }}>{p.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Reglas ── */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Reglas: evento del directo → acción del juego</div>
            <div className="panel-subtitle">
              {config.rules.length} reglas · {config.rules.filter((r) => r.enabled).length} activas
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" onClick={addRule}>
              ➕ Nueva regla
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!dirty}>
              {dirty ? "💾 Guardar cambios" : "✔ Guardado"}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {config.rules.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-state-icon">🕹️</div>
              <div className="empty-state-text">
                Sin reglas todavía. Carga las de {preset?.name || "un preset"} o crea una desde cero.
              </div>
            </div>
          ) : (
            config.rules.map((rule, index) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                baseUrl={config.baseUrl}
                preset={preset}
                testResult={testResults[rule.id]}
                onChange={(next) => updateRule(index, next)}
                onDelete={() => removeRule(index)}
                onTest={() => testRule(rule)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Historial ── */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Llamadas al juego</div>
            <div className="panel-subtitle">Últimas peticiones enviadas, en tiempo real</div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {history.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-state-text">Sin llamadas todavía.</div>
            </div>
          ) : (
            history.map((entry) => (
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
                  <span className="event-log-user">{entry.ruleName}</span>{" "}
                  {entry.test ? "(prueba) " : ""}
                  {entry.user} · x{entry.quantity} ·{" "}
                  {entry.ok ? `HTTP ${entry.status}` : entry.error || `HTTP ${entry.status}`}
                  <div
                    style={{
                      fontSize: "0.75em",
                      color: "var(--text-muted)",
                      fontFamily: "Consolas, monospace",
                      wordBreak: "break-all",
                    }}
                  >
                    {entry.url}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
