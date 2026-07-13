import React, { useEffect, useRef, useState, useCallback } from "react";
import socket from "../services/socketService";

const params = new URLSearchParams(window.location.search);
const backendPort = params.get("backendPort") || "3000";
// 127.0.0.1 (no "localhost"): TikTok LIVE Studio conecta el socket de forma
// fiable por 127.0.0.1.
const BACKEND_URL = `http://127.0.0.1:${backendPort}`;
const ENTRANCE_OVERLAY_URL = `${BACKEND_URL}/overlay/entrance-overlay.html`;

const ANIMATIONS = ["pop", "slideIn", "fadeIn", "bounce", "zoom"];

// Entradas por defecto (aplican a cualquier suscriptor/superfan sin entrada propia).
const DEFAULT_ENTRIES = [
  { key: "*superfan", icon: "💖", label: "Cualquier superfan", hint: "Miembros del Club de Fans (quiéreme)" },
  { key: "*subscriber", icon: "⭐", label: "Cualquier suscriptor", hint: "Suscriptores sin entrada propia" },
];

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normUser(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^@+/, "")
    .trim();
}

export default function EntrancesPanel() {
  const [entries, setEntries] = useState({}); // toda la config de entradas
  const [selected, setSelected] = useState("*superfan");
  const [newUser, setNewUser] = useState("");
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/entrances`)
      .then((r) => r.json())
      .then((d) => d && typeof d === "object" && setEntries(d))
      .catch(() => {});

    const handleConfig = (all) => all && typeof all === "object" && setEntries(all);
    socket.on("entranceConfig", handleConfig);
    return () => socket.off("entranceConfig", handleConfig);
  }, []);

  const m = entries[selected] || {};
  const isDefault = selected.startsWith("*");
  const userKeys = Object.keys(entries).filter((k) => !k.startsWith("*"));

  // ---- Persistencia ----
  const patchEntry = useCallback(async (key, partial) => {
    setEntries((prev) => ({ ...prev, [key]: { ...prev[key], ...partial } })); // optimista
    try {
      const res = await fetch(`${BACKEND_URL}/api/entrances/${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      if (res.ok) setEntries(await res.json());
    } catch (err) {
      console.error("Error guardando entrada:", err);
    }
  }, []);

  const uploadEntry = useCallback(async (key, field, file) => {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await fetch(`${BACKEND_URL}/api/entrances/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: dataUrl }),
      });
      if (res.ok) {
        setEntries(await res.json());
        setFeedback(field === "video" ? "Video de entrada cargado." : "Música/sonido cargado.");
      } else if (res.status === 404) {
        setFeedback("El backend no reconoce esta función. Reinicia la app (StreamSync) para aplicar la actualización.");
      } else if (res.status === 413) {
        setFeedback("Archivo demasiado pesado. Usa un video/audio de menos de ~75 MB.");
      } else {
        setFeedback(`No se pudo subir (error ${res.status}).`);
      }
    } catch (err) {
      console.error("Error subiendo media:", err);
      setFeedback("No se pudo conectar con el backend. ¿Está corriendo la app?");
    }
  }, []);

  const removeField = useCallback(async (key, field) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/entrances/${encodeURIComponent(key)}/${field}`, { method: "DELETE" });
      if (res.ok) setEntries(await res.json());
    } catch (err) {
      console.error("Error eliminando media:", err);
    }
  }, []);

  const deleteEntry = useCallback(async (key) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/entrances/${encodeURIComponent(key)}`, { method: "DELETE" });
      if (res.ok) {
        const next = await res.json();
        setEntries(next);
        setFeedback("Entrada eliminada.");
        if (selected === key) setSelected("*superfan");
      }
    } catch (err) {
      console.error("Error eliminando entrada:", err);
    }
  }, [selected]);

  const testEntry = useCallback((key) => {
    socket.emit("previewEntrance", key, (res) => {
      setFeedback(res?.ok ? "Vista previa enviada al overlay." : `Error: ${res?.error || "?"}`);
    });
  }, []);

  const addUser = () => {
    const key = normUser(newUser);
    if (!key) return;
    const display = newUser.replace(/^@+/, "").trim();
    patchEntry(key, {
      user: display,
      enabled: true,
      triggers: { join: true, subscribe: true, activity: true },
    });
    setSelected(key);
    setNewUser("");
    setFeedback(`Entrada creada para @${display}. Sube su video y música.`);
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(ENTRANCE_OVERLAY_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const doPatch = (partial) => patchEntry(selected, partial);
  const doUpload = (field, file) => uploadEntry(selected, field, file);
  const hasContent = (e) => !!(e && (e.video || e.sound || e.title || e.message));
  const isOn = (e) => e && e.enabled !== false && hasContent(e);

  const triggers = m.triggers || { join: true, subscribe: true, activity: true };
  const title = isDefault
    ? DEFAULT_ENTRIES.find((d) => d.key === selected)?.label || selected
    : `@${m.user || selected}`;

  return (
    <div className="page-enter" style={{ display: "grid", gap: 20 }}>
      {/* Intro + URL del overlay */}
      <div className="panel" style={{ marginBottom: 0 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">👑 Entradas de Superfans</div>
            <div className="panel-subtitle">
              Reproduce un video con música personalizado cuando un suscriptor/superfan entra al directo o se suscribe.
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
            {ENTRANCE_OVERLAY_URL}
          </code>
          <button className="btn" style={{ padding: "4px 10px" }} onClick={copyUrl}>{copied ? "✓" : "📋 Copiar"}</button>
          <button className="btn" style={{ padding: "4px 10px" }} onClick={() => setPreview((v) => !v)}>{preview ? "Cerrar" : "Preview"}</button>
        </div>
        <div style={{ fontSize: "0.72em", color: "var(--text-muted)", marginTop: 8 }}>
          Añádelo como Browser Source aparte en OBS/TikTok LIVE Studio. Tamaño sugerido: 1920×1080.
        </div>
        {feedback ? (
          <div style={{ marginTop: 10, fontSize: "0.82em", color: "var(--text-secondary)" }}>{feedback}</div>
        ) : null}
        {preview ? (
          <div style={{ marginTop: 12, background: "#101018", borderRadius: "var(--radius-sm)", overflow: "hidden", height: 260 }}>
            <iframe src={`${ENTRANCE_OVERLAY_URL}?control=1`} title="Preview entradas" style={{ width: "100%", height: "100%", border: "none" }} />
          </div>
        ) : null}
      </div>

      <div className="sticker-sounds-layout">
        {/* ── Izquierda: lista de entradas ── */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Entradas</div>
              <div className="panel-subtitle">Elige a quién configurar</div>
            </div>
          </div>

          {/* Añadir usuario concreto */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              className="input-field"
              placeholder="@usuario de TikTok"
              value={newUser}
              onChange={(e) => setNewUser(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addUser(); }}
            />
            <button className="btn btn-primary" style={{ padding: "6px 12px", whiteSpace: "nowrap" }} onClick={addUser}>➕ Añadir</button>
          </div>

          {/* Defaults */}
          <div style={{ fontSize: "0.72em", color: "var(--text-muted)", fontWeight: 700, margin: "4px 0 6px" }}>POR DEFECTO</div>
          <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            {DEFAULT_ENTRIES.map((d) => (
              <EntryButton key={d.key} entry={entries[d.key]} icon={d.icon} label={d.label} sub={d.hint}
                selected={selected === d.key} on={isOn(entries[d.key])} onClick={() => setSelected(d.key)} />
            ))}
          </div>

          {/* Usuarios concretos */}
          <div style={{ fontSize: "0.72em", color: "var(--text-muted)", fontWeight: 700, margin: "4px 0 6px" }}>
            USUARIOS ({userKeys.length})
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {userKeys.length === 0 ? (
              <div style={{ fontSize: "0.78em", color: "var(--text-muted)" }}>
                Añade a tus suscriptores/superfans por su @usuario para darles una entrada única.
              </div>
            ) : userKeys.map((k) => (
              <EntryButton key={k} entry={entries[k]} icon="👤" label={`@${entries[k]?.user || k}`}
                selected={selected === k} on={isOn(entries[k])} onClick={() => setSelected(k)}
                onDelete={() => deleteEntry(k)} />
            ))}
          </div>
        </div>

        {/* ── Derecha: editor ── */}
        <div className="side-panel">
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">{isDefault ? DEFAULT_ENTRIES.find((d) => d.key === selected)?.icon : "👤"} {title}</div>
              <label className="toggle" title="Activar / desactivar esta entrada">
                <input type="checkbox" checked={m.enabled !== false} onChange={(e) => doPatch({ enabled: e.target.checked })} />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {/* Video de entrada */}
            <UploadZone
              isVideo
              label="🎬 Video de entrada"
              accept="video/*"
              hint="MP4 · WEBM · MOV · pocos MB (máx 50 MB)"
              preview={m.video}
              onFile={(file) => doUpload("video", file)}
              onClear={() => removeField(selected, "video")}
            />
            {m.video ? (
              <div className="config-row">
                <span className="config-label">🔇 Silenciar audio del video (usar solo mi música)</span>
                <label className="toggle">
                  <input type="checkbox" checked={!!m.muteVideo} onChange={(e) => doPatch({ muteVideo: e.target.checked })} />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            ) : null}

            {/* Música / sonido */}
            <UploadZone
              label="🎵 Música / sonido"
              accept="audio/*"
              hint="MP3 · WAV · OGG (opcional)"
              preview={m.sound}
              onFile={(file) => doUpload("sound", file)}
              onClear={() => removeField(selected, "sound")}
            />

            {/* Banner de texto */}
            <div className="form-group">
              <label className="form-label">Título del banner</label>
              <input
                className="input-field"
                defaultValue={m.title ?? ""}
                key={`title-${selected}`}
                placeholder="👑 ¡Llegó {user}!"
                onBlur={(e) => doPatch({ title: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mensaje del banner</label>
              <input
                className="input-field"
                defaultValue={m.message ?? ""}
                key={`msg-${selected}`}
                placeholder="El rey del directo"
                onBlur={(e) => doPatch({ message: e.target.value })}
              />
              <div style={{ fontSize: "0.72em", color: "var(--text-muted)", marginTop: 6 }}>
                Usa <code>{"{user}"}</code> para insertar el nombre de quien entra.
              </div>
            </div>

            {/* Cuándo se dispara */}
            <div className="form-group">
              <label className="form-label">¿Cuándo se reproduce?</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="config-row">
                  <span className="config-label">💬 Cuando escribe/interactúa (recomendado)</span>
                  <label className="toggle">
                    <input type="checkbox" checked={triggers.activity !== false}
                      onChange={(e) => doPatch({ triggers: { ...triggers, activity: e.target.checked } })} />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                {triggers.activity !== false ? (
                  <div style={{ paddingLeft: 8 }}>
                    <label className="form-label" style={{ fontSize: "0.72em" }}>
                      Reaparecer tras ausencia (min): {((m.presenceGapSec ?? 300) / 60).toFixed(0)}
                    </label>
                    <input
                      type="range" min="0" max="30" step="1" className="volume-slider"
                      value={Math.round((m.presenceGapSec ?? 300) / 60)}
                      onChange={(e) => setEntries((prev) => ({ ...prev, [selected]: { ...prev[selected], presenceGapSec: parseInt(e.target.value, 10) * 60 } }))}
                      onPointerUp={(e) => doPatch({ presenceGapSec: parseInt(e.target.value, 10) * 60 })}
                    />
                    <div style={{ fontSize: "0.7em", color: "var(--text-muted)" }}>
                      Solo suena si lleva ese rato sin aparecer (así no se repite mientras chatea). 0 = cada vez tras el cooldown.
                    </div>
                  </div>
                ) : null}
                <div className="config-row">
                  <span className="config-label">👋 Cuando entra al directo (si TikTok lo avisa)</span>
                  <label className="toggle">
                    <input type="checkbox" checked={triggers.join !== false}
                      onChange={(e) => doPatch({ triggers: { ...triggers, join: e.target.checked } })} />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                <div className="config-row">
                  <span className="config-label">⭐ Cuando se suscribe</span>
                  <label className="toggle">
                    <input type="checkbox" checked={triggers.subscribe !== false}
                      onChange={(e) => doPatch({ triggers: { ...triggers, subscribe: e.target.checked } })} />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
              <div style={{ fontSize: "0.72em", color: "var(--text-muted)", marginTop: 6 }}>
                Nota: TikTok casi nunca avisa cuando alguien "entra", por eso lo fiable es dispararla con su primera interacción.
              </div>
            </div>

            {/* Animación */}
            <div className="form-group">
              <label className="form-label">Animación de entrada</label>
              <select className="select-field" value={m.animation || "pop"} onChange={(e) => doPatch({ animation: e.target.value })}>
                {ANIMATIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* Volumen */}
            <div className="form-group">
              <label className="form-label">Volumen: {Math.round((m.soundVolume ?? 0.8) * 100)}%</label>
              <input
                type="range" min="0" max="1" step="0.05" className="volume-slider"
                value={m.soundVolume ?? 0.8}
                onChange={(e) => setEntries((prev) => ({ ...prev, [selected]: { ...prev[selected], soundVolume: parseFloat(e.target.value) } }))}
                onPointerUp={(e) => doPatch({ soundVolume: parseFloat(e.target.value) })}
              />
            </div>

            {/* Duración (para video en bucle o solo banner/música) */}
            <div className="form-group">
              <label className="form-label">Duración: {((m.duration ?? 8000) / 1000).toFixed(1)}s</label>
              <input
                type="range" min="2000" max="30000" step="500" className="volume-slider"
                value={m.duration ?? 8000}
                onChange={(e) => setEntries((prev) => ({ ...prev, [selected]: { ...prev[selected], duration: parseInt(e.target.value, 10) } }))}
                onPointerUp={(e) => doPatch({ duration: parseInt(e.target.value, 10) })}
              />
              <div style={{ fontSize: "0.72em", color: "var(--text-muted)", marginTop: 4 }}>
                Si el video no está en bucle, dura lo que dure el video. Si no hay video, dura este tiempo.
              </div>
            </div>

            {/* Cooldown */}
            <div className="form-group">
              <label className="form-label">Cooldown por usuario (s)</label>
              <input
                type="number" min="0" step="5" className="input-field"
                placeholder="60"
                defaultValue={m.cooldownSec ?? ""}
                key={`cd-${selected}`}
                onBlur={(e) => doPatch({ cooldownSec: e.target.value === "" ? null : Number(e.target.value) })}
              />
              <div style={{ fontSize: "0.72em", color: "var(--text-muted)", marginTop: 4 }}>
                Evita repetir la entrada si el mismo usuario re-entra. Por defecto 60s.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
              <button className="btn btn-primary" onClick={() => testEntry(selected)}>▶ Probar entrada</button>
              {!isDefault ? (
                <button className="btn btn-danger" onClick={() => deleteEntry(selected)}>🗑️ Borrar entrada</button>
              ) : null}
            </div>
            <span style={{ display: "block", fontSize: "0.72em", color: "var(--text-muted)", marginTop: 6 }}>
              Estado: {isOn(m) ? "activa ✅" : "inactiva (sube un video o música y actívala)"}.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Botón de la lista de entradas.
function EntryButton({ entry, icon, label, sub, selected, on, onClick, onDelete }) {
  const e = entry || {};
  return (
    <div
      onClick={onClick}
      className="alert-config-card"
      style={{
        display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left",
        border: `1px solid ${selected ? "var(--accent-primary, #7c3aed)" : "var(--border-subtle)"}`,
        background: selected ? "rgba(124,58,237,.12)" : undefined,
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--bg-input)", overflow: "hidden", flexShrink: 0 }}>
        {e.avatar ? <img src={e.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 20 }}>{icon}</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: "0.88em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
        <div style={{ fontSize: "0.7em", color: "var(--text-muted)" }}>
          {e.video ? "🎬 " : ""}{e.sound ? "🎵 " : ""}{sub || (!e.video && !e.sound ? "Sin configurar" : "")}
        </div>
      </div>
      <span style={{ fontSize: "0.62em", fontWeight: 800, padding: "2px 8px", borderRadius: 999, color: on ? "#16d680" : "var(--text-muted)", background: on ? "rgba(22,214,128,.16)" : "var(--bg-input)" }}>
        {on ? "ON" : "OFF"}
      </span>
      {onDelete ? (
        <button className="btn-icon btn-danger" title="Borrar" onClick={(ev) => { ev.stopPropagation(); onDelete(); }}>✕</button>
      ) : null}
    </div>
  );
}

// Zona de carga para video o audio, con preview y botón de quitar.
function UploadZone({ isVideo, label, accept, hint, preview, onFile, onClear }) {
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
          isVideo ? (
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
            <span className="audio-empty-text">Arrastra {isVideo ? "un video" : "un audio"} o haz click</span>
            <span className="audio-empty-hint">{hint}</span>
          </div>
        )}
      </div>
    </div>
  );
}
