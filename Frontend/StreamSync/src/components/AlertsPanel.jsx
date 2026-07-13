import React, { useEffect, useRef, useState, useCallback } from "react";
import socket from "../services/socketService";

const params = new URLSearchParams(window.location.search);
const backendPort = params.get("backendPort") || "3000";
// 127.0.0.1 (no "localhost"): TikTok LIVE Studio conecta el socket de forma
// fiable por 127.0.0.1.
const BACKEND_URL = `http://127.0.0.1:${backendPort}`;
const ALERTS_OVERLAY_URL = `${BACKEND_URL}/overlay/alerts-overlay.html`;

const ALERT_TYPES = [
  { key: "gift", icon: "🎁", label: "Regalos / Donaciones", defTitle: "🎁 ¡{user} envió {giftName}!", defMsg: "{repeatCount}x {giftName} · {diamondCount}💎" },
  { key: "follow", icon: "➕", label: "Nuevos Seguidores", defTitle: "➕ ¡Nuevo seguidor!", defMsg: "{user} te sigue" },
  { key: "share", icon: "↪️", label: "Compartir directo", defTitle: "↪️ ¡Gracias por compartir!", defMsg: "{user} compartió el live" },
  { key: "subscribe", icon: "⭐", label: "Suscriptores", defTitle: "⭐ ¡Nueva suscripción!", defMsg: "{user} se suscribió" },
  { key: "like", icon: "❤️", label: "Likes", defTitle: "❤️ ¡Likes!", defMsg: "{user} envió {likeCount} likes" },
  { key: "memberJoin", icon: "👋", label: "Unirse al directo", defTitle: "👋 ¡Bienvenido!", defMsg: "{user} se unió" },
];

const ANIMATIONS = ["pop", "slideIn", "fadeIn", "bounce"];

const TEMPLATE_VARS = [
  { label: "Usuario", v: "{user}" },
  { label: "Regalo", v: "{giftName}" },
  { label: "Cantidad", v: "{repeatCount}" },
  { label: "Diamantes", v: "{diamondCount}" },
  { label: "Likes", v: "{likeCount}" },
];

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AlertsPanel() {
  const [config, setConfig] = useState(null); // para TTS + tts por evento
  const [media, setMedia] = useState({}); // alert-media por tipo
  const [selected, setSelected] = useState("gift");
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);
  const [feedback, setFeedback] = useState("");

  // Catálogo de regalos + cuál regalo se está configurando (alertas por regalo).
  const [availableGifts, setAvailableGifts] = useState([]);
  const [giftKey, setGiftKey] = useState("gift"); // 'gift' = cualquier regalo
  const [selectedGift, setSelectedGift] = useState({ key: "gift", name: "Cualquier regalo", image: null });
  const [giftSearch, setGiftSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  // Refs para insertar variables en el campo enfocado (título/mensaje).
  const titleRef = useRef(null);
  const msgRef = useRef(null);
  const lastFocusedRef = useRef("message");

  useEffect(() => {
    socket.emit("getAlertConfig", (cfg) => cfg && setConfig(cfg));
    const handleConfig = (cfg) => setConfig(cfg);
    socket.on("alertConfig", handleConfig);

    fetch(`${BACKEND_URL}/api/alert-media`)
      .then((r) => r.json())
      .then((d) => d && typeof d === "object" && setMedia(d))
      .catch(() => {});

    fetch(`${BACKEND_URL}/api/sticker-sounds/available-gifts`)
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setAvailableGifts(d))
      .catch(() => {});

    return () => socket.off("alertConfig", handleConfig);
  }, []);

  const isGift = selected === "gift";
  const editKey = isGift ? giftKey : selected;
  const baseEvent = isGift ? "gift" : selected;
  const m = (editKey && media[editKey]) || {};
  const meta = ALERT_TYPES.find((t) => t.key === selected) || ALERT_TYPES[0];
  const normName = (s) =>
    String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

  // ---- Persistencia ----
  const patchMedia = useCallback(async (key, partial) => {
    setMedia((prev) => ({ ...prev, [key]: { ...prev[key], ...partial } })); // optimista
    try {
      const res = await fetch(`${BACKEND_URL}/api/alert-media/${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      if (res.ok) setMedia(await res.json());
    } catch (err) {
      console.error("Error guardando alerta:", err);
    }
  }, []);

  const uploadMedia = useCallback(async (key, field, file, extra = {}) => {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await fetch(`${BACKEND_URL}/api/alert-media/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: dataUrl, ...extra }),
      });
      if (res.ok) {
        setMedia(await res.json());
        setFeedback(field === "image" ? "Imagen/GIF cargada." : field === "video" ? "Video cargado." : "Sonido cargado.");
      } else {
        setFeedback("No se pudo subir (¿archivo muy pesado?).");
      }
    } catch (err) {
      console.error("Error subiendo media:", err);
    }
  }, []);

  const removeMedia = useCallback(async (key, field) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/alert-media/${encodeURIComponent(key)}/${field}`, { method: "DELETE" });
      if (res.ok) setMedia(await res.json());
    } catch (err) {
      console.error("Error eliminando media:", err);
    }
  }, []);

  // Borra la alerta completa de una clave (evento o regalo específico).
  const deleteEntry = useCallback(async (key) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/alert-media/${encodeURIComponent(key)}`, { method: "DELETE" });
      if (res.ok) {
        setMedia(await res.json());
        setFeedback("Alerta eliminada.");
      }
    } catch (err) {
      console.error("Error eliminando alerta:", err);
    }
  }, []);

  const testAlert = useCallback((key) => {
    socket.emit("previewAlertMedia", key, (res) => {
      setFeedback(res?.ok ? "Vista previa enviada al overlay." : `Error: ${res?.error || "?"}`);
    });
  }, []);

  // ---- Helpers de regalo (alerta por regalo específico) ----
  const giftExtra = () =>
    isGift && editKey !== "gift" && selectedGift
      ? { giftName: selectedGift.name, giftImage: selectedGift.image || null }
      : {};
  const doPatch = (partial) => patchMedia(editKey, { ...giftExtra(), ...partial });
  const doUpload = (field, file) => uploadMedia(editKey, field, file, giftExtra());
  const doRemove = (field) => removeMedia(editKey, field);
  const doTest = () => testAlert(editKey);

  const configuredGiftKeys = Object.keys(media).filter((k) => k.startsWith("gift:"));
  const giftCatalog = (() => {
    const q = giftSearch.trim().toLowerCase();
    let list = availableGifts;
    if (q) list = list.filter((g) => (g.name || "").toLowerCase().includes(q));
    return list.slice(0, 60);
  })();
  const selectGiftKey = (key, name, image) => {
    setGiftKey(key);
    setSelectedGift({ key, name: name || "Regalo", image: image || null });
  };
  const assignGift = (g) => {
    const key = g.id != null ? `gift:${g.id}` : `gift:${normName(g.name)}`;
    selectGiftKey(key, g.name, g.image || null);
  };
  const deleteGiftAlert = (k) => {
    deleteEntry(k);
    if (editKey === k) selectGiftKey("gift", "Cualquier regalo", null);
  };

  // Inserta una variable en el campo enfocado por última vez (título/mensaje).
  const insertVar = (token) => {
    const field = lastFocusedRef.current === "title" ? "title" : "message";
    const ref = field === "title" ? titleRef : msgRef;
    const el = ref.current;
    if (!el) {
      doPatch({ [field]: (m[field] || "") + token });
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.value = el.value.slice(0, start) + token + el.value.slice(end);
    const pos = start + token.length;
    el.focus();
    try { el.setSelectionRange(pos, pos); } catch {}
    doPatch({ [field]: el.value });
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(ALERTS_OVERLAY_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (!config) {
    return (
      <div className="page-enter">
        <div className="panel">
          <div className="empty-state">
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-text">Cargando alertas...</div>
          </div>
        </div>
      </div>
    );
  }

  const enabled = m.enabled !== false && (m.image || m.video || m.sound || m.title || m.message);

  return (
    <div className="page-enter" style={{ display: "grid", gap: 20 }}>
      {/* Intro + URL del overlay */}
      <div className="panel" style={{ marginBottom: 0 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">✨ Alertas Visuales</div>
            <div className="panel-subtitle">
              Sube imagen/GIF + sonido + texto para cada evento. Se muestran en el overlay de alertas.
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "var(--bg-input)", padding: "8px 10px",
            borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)",
          }}
        >
          <code style={{ flex: 1, color: "var(--accent-secondary)", fontSize: "0.78em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ALERTS_OVERLAY_URL}
          </code>
          <button className="btn" style={{ padding: "4px 10px" }} onClick={copyUrl}>{copied ? "✓" : "📋 Copiar"}</button>
          <button className="btn" style={{ padding: "4px 10px" }} onClick={() => setPreview((v) => !v)}>{preview ? "Cerrar" : "Preview"}</button>
        </div>
        {feedback ? (
          <div style={{ marginTop: 10, fontSize: "0.82em", color: "var(--text-secondary)" }}>{feedback}</div>
        ) : null}
        {preview ? (
          <div style={{ marginTop: 12, background: "#101018", borderRadius: "var(--radius-sm)", overflow: "hidden", height: 240 }}>
            <iframe src={`${ALERTS_OVERLAY_URL}?control=1`} title="Preview alertas" style={{ width: "100%", height: "100%", border: "none" }} />
          </div>
        ) : null}
      </div>

      <div className="sticker-sounds-layout">
        {/* ── Izquierda: lista de eventos ── */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Eventos</div>
              <div className="panel-subtitle">Elige un evento para configurar su alerta</div>
            </div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {ALERT_TYPES.map((t) => {
              const em = media[t.key] || {};
              const hasC = (e) => e && e.enabled !== false && (e.image || e.video || e.sound || e.title || e.message);
              const isOn = t.key === "gift"
                ? (hasC(media.gift) || configuredGiftKeys.some((k) => hasC(media[k])))
                : hasC(em);
              const isSel = selected === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setSelected(t.key)}
                  className="alert-config-card"
                  style={{
                    display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left",
                    border: `1px solid ${isSel ? "var(--accent-primary, #7c3aed)" : "var(--border-subtle)"}`,
                    background: isSel ? "rgba(124,58,237,.12)" : undefined,
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--bg-input)", overflow: "hidden", flexShrink: 0 }}>
                    {em.image ? <img src={em.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 22 }}>{t.icon}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9em" }}>{t.label}</div>
                    <div style={{ fontSize: "0.72em", color: "var(--text-muted)" }}>
                      {em.sound ? "🔊 " : ""}{em.image ? "🖼️ " : ""}{!em.image && !em.sound ? "Sin configurar" : ""}
                    </div>
                  </div>
                  <span style={{ fontSize: "0.66em", fontWeight: 800, padding: "2px 8px", borderRadius: 999, color: isOn ? "#16d680" : "var(--text-muted)", background: isOn ? "rgba(22,214,128,.16)" : "var(--bg-input)" }}>
                    {isOn ? "ON" : "OFF"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Derecha: editor del evento seleccionado ── */}
        <div className="side-panel">
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                {meta.icon} {meta.label}
                {isGift && editKey !== "gift" ? ` · ${selectedGift.name}` : ""}
              </div>
              <label className="toggle" title="Activar / desactivar esta alerta">
                <input
                  type="checkbox"
                  checked={m.enabled !== false}
                  onChange={(e) => doPatch({ enabled: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {/* Gestión de alertas de regalos: lista + agregar (catálogo automático) */}
            {isGift ? (
              <div className="alert-config-card" style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: "0.85em", fontWeight: 700 }}>Alertas de regalos</span>
                  <button className="btn" style={{ padding: "4px 10px" }} onClick={() => setShowPicker((v) => !v)}>
                    {showPicker ? "Cerrar" : "➕ Agregar regalo"}
                  </button>
                </div>

                {/* Lista de alertas guardadas (genérica + por regalo) */}
                <div style={{ display: "grid", gap: 6 }}>
                  {["gift", ...configuredGiftKeys].filter((k, i, a) => a.indexOf(k) === i).map((k) => {
                    const isGeneric = k === "gift";
                    if (!isGeneric && !media[k]) return null;
                    const e = media[k] || {};
                    const name = isGeneric ? "Cualquier regalo" : (e.giftName || k.replace("gift:", ""));
                    const on = e.enabled !== false && (e.image || e.video || e.sound || e.title || e.message);
                    const sel = editKey === k;
                    return (
                      <div
                        key={k}
                        style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8,
                          background: sel ? "rgba(124,58,237,.12)" : "var(--bg-input)",
                          border: `1px solid ${sel ? "var(--accent-primary,#7c3aed)" : "var(--border-subtle)"}`,
                        }}
                      >
                        <div style={{ width: 30, height: 30, borderRadius: 6, display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
                          {e.giftImage ? <img src={e.giftImage} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span>{isGeneric ? "✨" : "🎁"}</span>}
                        </div>
                        <span style={{ flex: 1, fontSize: "0.82em", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                        <span style={{ fontSize: "0.58em", fontWeight: 800, padding: "1px 6px", borderRadius: 999, color: on ? "#16d680" : "var(--text-muted)", background: on ? "rgba(22,214,128,.16)" : "transparent" }}>{on ? "ON" : "OFF"}</span>
                        <button className="btn-icon" title="Editar" onClick={() => selectGiftKey(k, e.giftName || name, e.giftImage)}>✏️</button>
                        <button className="btn-icon" title="Probar" onClick={() => testAlert(k)}>▶</button>
                        {!isGeneric ? <button className="btn-icon btn-danger" title="Borrar" onClick={() => deleteGiftAlert(k)}>✕</button> : null}
                      </div>
                    );
                  })}
                </div>

                {/* Catálogo para agregar un regalo */}
                {showPicker ? (
                  <div style={{ marginTop: 10 }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="🔍 Buscar regalo del catálogo..."
                      value={giftSearch}
                      onChange={(e) => setGiftSearch(e.target.value)}
                      style={{ marginBottom: 10 }}
                    />
                    {availableGifts.length ? (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px,1fr))", gap: 8, maxHeight: 220, overflowY: "auto" }}>
                        {giftCatalog.map((g) => (
                          <button
                            key={g.id || g.name}
                            onClick={() => { assignGift(g); setShowPicker(false); }}
                            title={g.name}
                            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 4px", borderRadius: 10, cursor: "pointer", background: "var(--bg-input)", border: "1px solid var(--border-subtle)" }}
                          >
                            {g.image ? <img src={g.image} alt="" style={{ width: 34, height: 34, objectFit: "contain" }} /> : <span style={{ fontSize: 22 }}>🎁</span>}
                            <span style={{ fontSize: "0.66em", textAlign: "center", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{g.name}</span>
                            {g.diamondCount != null ? <span style={{ fontSize: "0.6em", color: "var(--text-muted)" }}>💎{g.diamondCount}</span> : null}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: "0.78em", color: "var(--text-muted)" }}>Conéctate a tu TikTok Live para cargar el catálogo de regalos.</div>
                    )}
                  </div>
                ) : null}

                <div style={{ fontSize: "0.72em", color: "var(--text-muted)", marginTop: 8 }}>
                  Editando: <b>{selectedGift.name}</b>. Si un regalo no tiene su propia alerta, se usa la de "Cualquier regalo".
                </div>
              </div>
            ) : null}

            {/* Imagen / GIF */}
            <UploadZone
              isImage
              label="Imagen o GIF"
              accept="image/*"
              hint="PNG · GIF · JPG · WEBP"
              preview={m.image}
              onFile={(file) => doUpload("image", file)}
              onClear={() => doRemove("image")}
            />

            {/* Video (corto o en bucle) */}
            <UploadZone
              isVideo
              label="Video (corto o en bucle)"
              accept="video/*"
              hint="MP4 · WEBM · MOV · pocos MB"
              preview={m.video}
              onFile={(file) => doUpload("video", file)}
              onClear={() => doRemove("video")}
            />
            {m.video ? (
              <>
                <div className="config-row">
                  <span className="config-label">🔁 Reproducir en bucle</span>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={!!m.loop}
                      onChange={(e) => doPatch({ loop: e.target.checked })}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                <div style={{ fontSize: "0.72em", color: "var(--text-muted)", marginTop: -4, marginBottom: 8 }}>
                  El video tiene prioridad sobre la imagen y trae su propio audio.
                  {m.loop ? " En bucle: dura lo que marque la duración." : " Sin bucle: dura lo que dure el video."}
                </div>
              </>
            ) : null}

            {/* Sonido */}
            <UploadZone
              label="Sonido"
              accept="audio/*"
              hint="MP3 · WAV · OGG"
              preview={m.sound}
              onFile={(file) => doUpload("sound", file)}
              onClear={() => doRemove("sound")}
            />

            {/* Texto */}
            <div className="form-group">
              <label className="form-label">Título</label>
              <input
                ref={titleRef}
                className="input-field"
                defaultValue={m.title ?? ""}
                key={`title-${editKey}`}
                placeholder={meta.defTitle}
                onFocus={() => { lastFocusedRef.current = "title"; }}
                onBlur={(e) => doPatch({ title: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mensaje</label>
              <input
                ref={msgRef}
                className="input-field"
                defaultValue={m.message ?? ""}
                key={`msg-${editKey}`}
                placeholder={meta.defMsg}
                onFocus={() => { lastFocusedRef.current = "message"; }}
                onBlur={(e) => doPatch({ message: e.target.value })}
              />
              <div style={{ fontSize: "0.72em", color: "var(--text-muted)", marginTop: 6, marginBottom: 4 }}>
                Toca una variable para insertarla en el campo activo (título/mensaje):
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {TEMPLATE_VARS.map((tv) => (
                  <button
                    key={tv.v}
                    type="button"
                    className="btn"
                    style={{ padding: "3px 9px", fontSize: "0.72em" }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertVar(tv.v)}
                    title={`Insertar ${tv.v}`}
                  >
                    {tv.label} <code style={{ opacity: 0.7 }}>{tv.v}</code>
                  </button>
                ))}
              </div>
            </div>

            {/* Ajustes */}
            <div className="form-group">
              <label className="form-label">Animación</label>
              <select
                className="select-field"
                value={m.animation || "pop"}
                onChange={(e) => doPatch({ animation: e.target.value })}
              >
                {ANIMATIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Volumen del sonido: {Math.round((m.soundVolume ?? 0.8) * 100)}%</label>
              <input
                type="range" min="0" max="1" step="0.05"
                className="volume-slider"
                value={m.soundVolume ?? 0.8}
                onChange={(e) => setMedia((prev) => ({ ...prev, [editKey]: { ...prev[editKey], soundVolume: parseFloat(e.target.value) } }))}
                onPointerUp={(e) => doPatch({ soundVolume: parseFloat(e.target.value) })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Duración: {((m.duration ?? 5000) / 1000).toFixed(1)}s</label>
              <input
                type="range" min="1500" max="15000" step="500"
                className="volume-slider"
                value={m.duration ?? 5000}
                onChange={(e) => setMedia((prev) => ({ ...prev, [editKey]: { ...prev[editKey], duration: parseInt(e.target.value, 10) } }))}
                onPointerUp={(e) => doPatch({ duration: parseInt(e.target.value, 10) })}
              />
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
                <label className="form-label">Cooldown (s)</label>
                <input
                  type="number" min="0" step="0.5"
                  className="input-field"
                  placeholder="0"
                  defaultValue={m.cooldownSec ?? ""}
                  key={`cd-${editKey}`}
                  onBlur={(e) => doPatch({ cooldownSec: e.target.value === "" ? null : Number(e.target.value) })}
                />
              </div>
              {isGift ? (
                <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
                  <label className="form-label">Diamantes mínimos</label>
                  <input
                    type="number" min="0"
                    className="input-field"
                    defaultValue={m.minDiamonds ?? 0}
                    key={`md-${editKey}`}
                    onBlur={(e) => doPatch({ minDiamonds: Number(e.target.value) || 0 })}
                  />
                </div>
              ) : null}
            </div>

            {/* TTS por evento (reutiliza config.alerts; a nivel de evento base) */}
            <div className="config-row" style={{ marginTop: 6 }}>
              <span className="config-label">🗣️ Leer con voz (TTS)</span>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={config.alerts?.[baseEvent]?.tts ?? false}
                  onChange={(e) =>
                    socket.emit("updateAlerts", {
                      ...config.alerts,
                      [baseEvent]: { ...(config.alerts?.[baseEvent] || {}), tts: e.target.checked },
                    })
                  }
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
              <button className="btn btn-primary" onClick={doTest}>▶ Probar alerta</button>
              <button
                className="btn btn-danger"
                onClick={() => (isGift && editKey !== "gift" ? deleteGiftAlert(editKey) : deleteEntry(editKey))}
              >
                🗑️ Borrar esta alerta
              </button>
            </div>
            <span style={{ display: "block", fontSize: "0.72em", color: "var(--text-muted)", marginTop: 6 }}>
              Estado: {enabled ? "activa ✅" : "inactiva (agrega media o actívala)"}. Tamaño OBS sugerido: 600×400.
            </span>
          </div>
        </div>
      </div>

      {/* ── TTS Global (conservado) ── */}
      <div className="panel" style={{ marginTop: 0 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">🗣️ Configuración TTS Global</div>
            <div className="panel-subtitle">Ajustes globales para lectura de comentarios y eventos.</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="config-row">
            <span className="config-label">TTS activado</span>
            <label className="toggle">
              <input type="checkbox" checked={config.tts?.enabled ?? true}
                onChange={(e) => socket.emit("updateTTS", { ...config.tts, enabled: e.target.checked })} />
              <span className="toggle-slider"></span>
            </label>
          </div>
          <div className="config-row">
            <span className="config-label">Leer nombre de usuario</span>
            <label className="toggle">
              <input type="checkbox" checked={config.tts?.readUsername ?? true}
                onChange={(e) => socket.emit("updateTTS", { ...config.tts, readUsername: e.target.checked })} />
              <span className="toggle-slider"></span>
            </label>
          </div>
          <div className="config-row">
            <span className="config-label">Filtro anti-spam</span>
            <label className="toggle">
              <input type="checkbox" checked={config.tts?.filterSpam ?? true}
                onChange={(e) => socket.emit("updateTTS", { ...config.tts, filterSpam: e.target.checked })} />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {/* ── Filtro de audiencia: a quién lee el bot ── */}
          <div style={{ borderTop: "1px solid var(--border-color, #2a2a3a)", paddingTop: 10 }}>
            <div className="config-row">
              <span className="config-label">👥 Leer a todos</span>
              <label className="toggle">
                <input type="checkbox" checked={config.tts?.audience?.everyone ?? true}
                  onChange={(e) => socket.emit("updateTTS", {
                    ...config.tts,
                    audience: { ...(config.tts?.audience || {}), everyone: e.target.checked },
                  })} />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {!(config.tts?.audience?.everyone ?? true) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 12, marginTop: 4 }}>
                {[
                  { key: "moderators", label: "🛡️ Moderadores" },
                  { key: "subscribers", label: "⭐ Suscriptores" },
                  { key: "followers", label: "➕ Seguidores" },
                  { key: "fansClub", label: "💖 Club de Fans (quiéreme)" },
                ].map((g) => (
                  <div className="config-row" key={g.key}>
                    <span className="config-label">{g.label}</span>
                    <label className="toggle">
                      <input type="checkbox" checked={config.tts?.audience?.[g.key] ?? false}
                        onChange={(e) => socket.emit("updateTTS", {
                          ...config.tts,
                          audience: { ...(config.tts?.audience || {}), [g.key]: e.target.checked },
                        })} />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                ))}
                <span style={{ fontSize: "0.72em", color: "var(--text-muted)" }}>
                  Solo se leerán los comentarios de los grupos activados.
                </span>
              </div>
            )}
          </div>

          <div>
            <span className="config-label">Velocidad ({config.tts?.rate?.toFixed(1) || "1.0"})</span>
            <input type="range" min="0.5" max="2" step="0.1" value={config.tts?.rate || 1}
              onChange={(e) => socket.emit("updateTTS", { ...config.tts, rate: parseFloat(e.target.value) })} />
          </div>
          <div>
            <span className="config-label">Tono ({config.tts?.pitch?.toFixed(1) || "1.0"})</span>
            <input type="range" min="0.5" max="2" step="0.1" value={config.tts?.pitch || 1}
              onChange={(e) => socket.emit("updateTTS", { ...config.tts, pitch: parseFloat(e.target.value) })} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Zona de carga para imagen, video o audio, con preview y botón de quitar.
function UploadZone({ isImage, isVideo, label, accept, hint, preview, onFile, onClear }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = Array.from(e.dataTransfer.files || [])[0];
    if (file) onFile(file);
  };

  const playAudio = (e) => {
    e?.stopPropagation();
    if (!preview) return;
    const a = new Audio(preview);
    a.play().catch(() => {});
  };

  const whatLabel = isImage ? "una imagen/GIF" : isVideo ? "un video" : "un audio";

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input ref={inputRef} type="file" accept={accept} hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      <div
        className={`audio-dropzone ${dragOver ? "dragover" : ""} ${preview ? "has-file" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{ cursor: "pointer" }}
      >
        {preview ? (
          isImage ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
              <img src={preview} alt="" style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 8 }} />
              <span style={{ flex: 1, fontSize: "0.8em", color: "var(--text-secondary)" }}>Imagen cargada — click para cambiar</span>
              <button className="audio-mini-btn" onClick={(e) => { e.stopPropagation(); onClear(); }} title="Quitar">✕</button>
            </div>
          ) : isVideo ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
              <video src={preview} style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 8 }} muted />
              <span style={{ flex: 1, fontSize: "0.8em", color: "var(--text-secondary)" }}>Video cargado — click para cambiar</span>
              <button className="audio-mini-btn" onClick={(e) => { e.stopPropagation(); onClear(); }} title="Quitar">✕</button>
            </div>
          ) : (
            <div className="audio-file-row" style={{ width: "100%" }}>
              <span className="audio-file-icon">🎵</span>
              <span className="audio-file-name" style={{ flex: 1 }}>Sonido cargado</span>
              <button className="audio-mini-btn" onClick={playAudio} title="Escuchar">▶</button>
              <button className="audio-mini-btn" onClick={(e) => { e.stopPropagation(); onClear(); }} title="Quitar">✕</button>
            </div>
          )
        ) : (
          <div className="audio-empty">
            <span className="audio-empty-icon">⬆️</span>
            <span className="audio-empty-text">Arrastra {whatLabel} o haz click</span>
            <span className="audio-empty-hint">{hint}</span>
          </div>
        )}
      </div>
    </div>
  );
}
