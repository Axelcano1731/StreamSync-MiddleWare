// components/StickerSoundsPanel.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useStickerSounds } from "../context/stickerSoundsStore";

const BACKEND_URL = "http://localhost:3000";

export default function StickerSoundsPanel() {
  // Estado compartido (vive en el provider, persiste entre pestañas y reproduce
  // los sonidos aunque este panel esté cerrado).
  const {
    chatStickers,
    recentGifts,
    lastTriggered,
    antiSpam,
    setAntiSpam,
    cooldownSec,
    setCooldownSec,
  } = useStickerSounds();

  // Estado local solo de configuración / UI de este panel.
  const [mappings, setMappings] = useState({});
  const [mode, setMode] = useState("emotes"); // "emotes" | "gifts"
  const [availableGifts, setAvailableGifts] = useState([]);
  const [selected, setSelected] = useState(null); // { key, label, image, type }
  const [search, setSearch] = useState("");
  const [audioFile, setAudioFile] = useState(null);
  const [volume, setVolume] = useState(0.8);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Fetch configured mappings + gift catalog on mount
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/sticker-sounds`)
      .then((r) => r.json())
      .then((data) => setMappings(data || {}))
      .catch(() => {});

    fetch(`${BACKEND_URL}/api/sticker-sounds/available-gifts`)
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setAvailableGifts(data))
      .catch(() => {});
  }, []);

  // Gift gallery (catalog + live flag), filtered by search
  const galleryGifts = useMemo(() => {
    const byName = new Map();
    for (const g of availableGifts) byName.set(g.name, { ...g, recent: false });
    recentGifts.forEach(({ name, image }, idx) => {
      const ex = byName.get(name);
      if (ex) byName.set(name, { ...ex, recent: true, recentOrder: idx, image: ex.image || image });
      else byName.set(name, { id: name, name, image, diamondCount: null, recent: true, recentOrder: idx });
    });
    let list = Array.from(byName.values());
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((g) => g.name.toLowerCase().includes(q));
    list.sort((a, b) => {
      if (a.recent && b.recent) return (a.recentOrder ?? 0) - (b.recentOrder ?? 0);
      if (a.recent) return -1;
      if (b.recent) return 1;
      return (a.diamondCount ?? 0) - (b.diamondCount ?? 0);
    });
    return list;
  }, [availableGifts, recentGifts, search]);

  const selectGift = useCallback((gift) => {
    setSelected({ key: gift.name, label: gift.name, image: gift.image || null, type: "gift" });
  }, []);

  const selectEmote = useCallback((sticker, index) => {
    setSelected({
      key: sticker.emoteId,
      label: `Sticker de chat #${index + 1}`,
      image: sticker.image || null,
      type: "emote",
    });
  }, []);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) setAudioFile(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = Array.from(e.dataTransfer.files || []).find((f) =>
      f.type.startsWith("audio/")
    );
    if (file) setAudioFile(file);
  }, []);

  const clearAudio = useCallback((e) => {
    e?.stopPropagation();
    setAudioFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const previewAudio = useCallback((e) => {
    e?.stopPropagation();
    if (!audioFile) return;
    const url = URL.createObjectURL(audioFile);
    const audio = new Audio(url);
    audio.volume = volume;
    audio.play().catch(() => {});
    audio.onended = () => URL.revokeObjectURL(url);
  }, [audioFile, volume]);

  const handleAdd = useCallback(async () => {
    const key = selected?.key?.toString().trim();
    if (!key || !audioFile) return;
    setSaving(true);
    try {
      const soundData = await readFileAsDataUrl(audioFile);
      const res = await fetch(`${BACKEND_URL}/api/sticker-sounds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          giftName: key,
          fileName: audioFile.name,
          soundData,
          volume,
          giftImage: selected?.image || null,
          label: selected?.label || null,
          type: selected?.type || "gift",
        }),
      });
      if (res.ok) {
        setMappings(await res.json());
        setSelected(null);
        setAudioFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Error guardando sticker sound:", err);
    } finally {
      setSaving(false);
    }
  }, [selected, audioFile, volume]);

  const handleDelete = useCallback(async (key) => {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/sticker-sounds/${encodeURIComponent(key)}`,
        { method: "DELETE" }
      );
      if (res.ok) setMappings(await res.json());
    } catch (err) {
      console.error("Error eliminando sticker sound:", err);
    }
  }, []);

  const handlePreview = useCallback((config) => {
    if (!config?.soundData) return;
    const audio = new Audio(config.soundData);
    audio.volume = typeof config.volume === "number" ? config.volume : 0.8;
    audio.play().catch(() => {});
  }, []);

  const entries = Object.entries(mappings);

  return (
    <div className="sticker-sounds-layout page-enter">
      {/* ── Left: Visual sticker gallery ── */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">
              {mode === "emotes" ? "🎟️ Tus Stickers de Chat" : "🎁 Regalos"}
            </div>
            <div className="panel-subtitle">
              {mode === "emotes"
                ? "Los stickers aparecen aquí cuando alguien los envía en el chat"
                : "Catálogo de regalos del Live · click para asignar sonido"}
            </div>
          </div>
        </div>

        <div className="sticker-tabs">
          <button
            className={`sticker-tab ${mode === "emotes" ? "active" : ""}`}
            onClick={() => setMode("emotes")}
          >
            🎟️ Stickers de Chat
          </button>
          <button
            className={`sticker-tab ${mode === "gifts" ? "active" : ""}`}
            onClick={() => setMode("gifts")}
          >
            🎁 Regalos
          </button>
        </div>

        {mode === "gifts" && (
          <input
            type="text"
            className="form-input sticker-search"
            placeholder="🔍 Buscar regalo por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}

        {mode === "emotes" ? (
          chatStickers.length > 0 ? (
            <div className="sticker-gallery">
              {chatStickers.map((s, i) => {
                const hasSound = !!mappings[s.emoteId];
                const isSel = selected?.key === s.emoteId;
                return (
                  <button
                    key={s.emoteId}
                    className={`sticker-card ${isSel ? "selected" : ""} ${hasSound ? "has-sound" : ""}`}
                    onClick={() => selectEmote(s, i)}
                    title="Click para asignar un sonido"
                  >
                    {hasSound && <span className="sticker-card-badge">🔊</span>}
                    <StickerThumb image={s.image} name="sticker" large />
                    {s.count > 1 && <span className="sticker-card-cost">×{s.count}</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🎟️</div>
              <div className="empty-state-text">
                Aún no se han enviado stickers en el chat.
                <br />
                Conéctate a tu Live y, cuando alguien envíe un sticker (o lo
                envíes tú), aparecerá aquí para asignarle un sonido.
              </div>
            </div>
          )
        ) : galleryGifts.length > 0 ? (
          <div className="sticker-gallery">
            {galleryGifts.map((gift) => {
              const hasSound = !!mappings[gift.name];
              const isSel = selected?.key === gift.name;
              return (
                <button
                  key={gift.id || gift.name}
                  className={`sticker-card ${isSel ? "selected" : ""} ${hasSound ? "has-sound" : ""}`}
                  onClick={() => selectGift(gift)}
                  title={gift.name}
                >
                  {gift.recent && <span className="sticker-card-live">EN VIVO</span>}
                  {hasSound && <span className="sticker-card-badge">🔊</span>}
                  <StickerThumb image={gift.image} name={gift.name} />
                  <span className="sticker-card-name">{gift.name}</span>
                  {gift.diamondCount != null && (
                    <span className="sticker-card-cost">💎 {gift.diamondCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">🎁</div>
            <div className="empty-state-text">
              Conéctate a tu TikTok Live para cargar los regalos disponibles.
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Selected + add form + configured list ── */}
      <div className="side-panel">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">➕ Asignar Sonido</div>
          </div>

          {selected ? (
            <div className="selected-sticker">
              <StickerThumb image={selected.image} name={selected.label} large />
              <div className="selected-sticker-info">
                <span className="selected-sticker-label">
                  {selected.type === "emote" ? "Sticker de chat" : "Regalo seleccionado"}
                </span>
                <span className="selected-sticker-name">{selected.label}</span>
              </div>
              <button className="btn-icon" onClick={() => setSelected(null)} title="Quitar selección">
                ✕
              </button>
            </div>
          ) : (
            <div className="selected-placeholder">
              👈 Selecciona un sticker de la galería para asignarle un sonido
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Archivo de audio</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              hidden
              onChange={handleFileChange}
            />
            <div
              className={`audio-dropzone ${dragOver ? "dragover" : ""} ${audioFile ? "has-file" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {audioFile ? (
                <div className="audio-file-row">
                  <span className="audio-file-icon">🎵</span>
                  <span className="audio-file-name">{audioFile.name}</span>
                  <button className="audio-mini-btn" onClick={previewAudio} title="Escuchar">
                    ▶
                  </button>
                  <button className="audio-mini-btn" onClick={clearAudio} title="Quitar">
                    ✕
                  </button>
                </div>
              ) : (
                <div className="audio-empty">
                  <span className="audio-empty-icon">⬆️</span>
                  <span className="audio-empty-text">
                    Arrastra un audio o haz click para elegir
                  </span>
                  <span className="audio-empty-hint">MP3 · WAV · OGG</span>
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Volumen: {Math.round(volume * 100)}%</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="volume-slider"
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={handleAdd}
            disabled={saving || !selected?.key || !audioFile}
          >
            {saving ? "Guardando..." : "💾 Guardar Sonido"}
          </button>
        </div>

        {/* Anti-spam control */}
        <div className="panel antispam-panel">
          <div className="antispam-head">
            <div className="antispam-title">
              <span>🛡️ Anti-spam</span>
              <span className="antispam-sub">
                Evita que un mismo sticker suene en ráfaga
              </span>
            </div>
            <button
              className={`toggle-switch ${antiSpam ? "on" : ""}`}
              onClick={() => setAntiSpam((v) => !v)}
              role="switch"
              aria-checked={antiSpam}
              title={antiSpam ? "Anti-spam activo" : "Anti-spam desactivado"}
            >
              <span className="toggle-knob" />
            </button>
          </div>
          {antiSpam && (
            <div className="antispam-body">
              <label className="form-label">
                Espera entre sonidos del mismo sticker: {cooldownSec}s
              </label>
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={cooldownSec}
                onChange={(e) => setCooldownSec(parseInt(e.target.value, 10))}
                className="volume-slider"
              />
            </div>
          )}
        </div>

        {/* Configured mappings */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">🔊 Configurados</div>
            <div className="panel-subtitle">
              {entries.length} sticker{entries.length !== 1 ? "s" : ""} con sonido
            </div>
          </div>

          {entries.length > 0 ? (
            <div className="sticker-list">
              {entries.map(([key, cfg]) => (
                <div
                  key={key}
                  className={`sticker-item ${lastTriggered === key ? "sticker-triggered" : ""}`}
                >
                  <StickerThumb image={cfg.giftImage} name={cfg.label || key} />
                  <div className="sticker-info">
                    <span className="sticker-name">
                      {cfg.type === "emote" ? "🎟️ " : "🎁 "}
                      {cfg.label || key}
                    </span>
                    <span className="sticker-file">{cfg.fileName || "audio"}</span>
                    <span className="sticker-vol">🔊 {Math.round((cfg.volume ?? 0.8) * 100)}%</span>
                  </div>
                  <div className="sticker-actions">
                    <button className="btn-icon" onClick={() => handlePreview(cfg)} title="Previsualizar">
                      ▶
                    </button>
                    <button className="btn-icon btn-danger" onClick={() => handleDelete(key)} title="Eliminar">
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🔇</div>
              <div className="empty-state-text">Aún no has configurado sonidos</div>
            </div>
          )}
        </div>

        {/* How to use */}
        <div className="panel info-panel">
          <div className="panel-title">ℹ️ Cómo usar</div>
          <ol className="info-list">
            <li>Conecta tu TikTok Live</li>
            <li>Cuando alguien envíe un sticker en el chat, aparecerá en "Tus Stickers de Chat"</li>
            <li>Haz click en el sticker y elige un audio (MP3, WAV, OGG...)</li>
            <li>El sonido sonará solo cada vez que envíen ese sticker</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

// Sticker thumbnail with graceful fallback to an emoji when the image fails.
function StickerThumb({ image, name, large }) {
  const [failed, setFailed] = useState(false);
  const cls = large ? "sticker-thumb sticker-thumb-lg" : "sticker-thumb";
  if (!image || failed) {
    return <span className={`${cls} sticker-thumb-fallback`} aria-label={name}>🎟️</span>;
  }
  return <img className={cls} src={image} alt={name} loading="lazy" onError={() => setFailed(true)} />;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
