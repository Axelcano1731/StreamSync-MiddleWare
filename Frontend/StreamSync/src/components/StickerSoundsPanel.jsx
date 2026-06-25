// components/StickerSoundsPanel.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import socket from "../services/socketService";

const BACKEND_URL = "http://localhost:3000";

export default function StickerSoundsPanel() {
  const [mappings, setMappings] = useState({});
  const [giftName, setGiftName] = useState("");
  const [audioFile, setAudioFile] = useState(null);
  const [volume, setVolume] = useState(0.8);
  const [saving, setSaving] = useState(false);
  const [lastTriggered, setLastTriggered] = useState(null);
  const [recentGifts, setRecentGifts] = useState([]);
  const audioRefs = useRef({});
  const fileInputRef = useRef(null);

  // Fetch mappings on mount
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/sticker-sounds`)
      .then((r) => r.json())
      .then((data) => setMappings(data || {}))
      .catch(() => {});
  }, []);

  // Listen for gift events and track recent gifts names
  useEffect(() => {
    const handleGift = (data) => {
      const name = data.giftName || "Unknown";
      setRecentGifts((prev) => {
        if (prev.includes(name)) return prev;
        return [name, ...prev].slice(0, 20);
      });
    };

    socket.on("gift", handleGift);
    return () => socket.off("gift", handleGift);
  }, []);

  // Listen for stickerSound events and play audio
  useEffect(() => {
    const handleStickerSound = ({ giftName: name, soundData, volume: vol }) => {
      setLastTriggered(name);
      setTimeout(() => setLastTriggered(null), 2000);

      if (!soundData) return;

      const audio = new Audio(soundData);
      audio.volume = typeof vol === "number" ? Math.min(1, Math.max(0, vol)) : 0.8;
      audio.play().catch(() => {});
    };

    socket.on("stickerSound", handleStickerSound);
    return () => socket.off("stickerSound", handleStickerSound);
  }, []);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
  }, []);

  const handleAdd = useCallback(async () => {
    if (!giftName.trim()) return;
    if (!audioFile) return;

    setSaving(true);
    try {
      const soundData = await readFileAsDataUrl(audioFile);
      const body = {
        giftName: giftName.trim(),
        fileName: audioFile.name,
        soundData,
        volume,
      };

      const res = await fetch(`${BACKEND_URL}/api/sticker-sounds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const updated = await res.json();
        setMappings(updated);
        setGiftName("");
        setAudioFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Error guardando sticker sound:", err);
    } finally {
      setSaving(false);
    }
  }, [giftName, audioFile, volume]);

  const handleDelete = useCallback(async (name) => {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/sticker-sounds/${encodeURIComponent(name)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        const updated = await res.json();
        setMappings(updated);
      }
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

  const handleQuickAdd = useCallback((name) => {
    setGiftName(name);
  }, []);

  const entries = Object.entries(mappings);

  return (
    <div className="sticker-sounds-layout page-enter">
      {/* ── Left: Configured Mappings ── */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">🔊 Sonidos de Stickers</div>
            <div className="panel-subtitle">
              {entries.length} sticker{entries.length !== 1 ? "s" : ""} configurado{entries.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {entries.length > 0 ? (
          <div className="sticker-list">
            {entries.map(([name, cfg]) => (
              <div
                key={name}
                className={`sticker-item ${lastTriggered === name ? "sticker-triggered" : ""}`}
              >
                <div className="sticker-info">
                  <span className="sticker-name">🎁 {name}</span>
                  <span className="sticker-file">{cfg.fileName || "audio"}</span>
                  <span className="sticker-vol">🔊 {Math.round((cfg.volume ?? 0.8) * 100)}%</span>
                </div>
                <div className="sticker-actions">
                  <button
                    className="btn-icon"
                    onClick={() => handlePreview(cfg)}
                    title="Previsualizar sonido"
                  >
                    ▶
                  </button>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => handleDelete(name)}
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">🔇</div>
            <div className="empty-state-text">
              Agrega sonidos para que tus stickers cobren vida
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Add new + Recent gifts ── */}
      <div className="side-panel">
        {/* Add form */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">➕ Agregar Sonido</div>
          </div>

          <div className="form-group">
            <label className="form-label">Nombre del sticker / regalo</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej: Rose, TikTok Universe..."
              value={giftName}
              onChange={(e) => setGiftName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Archivo de audio</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="form-input file-input"
              onChange={handleFileChange}
            />
            {audioFile && (
              <span className="file-selected">✅ {audioFile.name}</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">
              Volumen: {Math.round(volume * 100)}%
            </label>
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
            disabled={saving || !giftName.trim() || !audioFile}
          >
            {saving ? "Guardando..." : "💾 Guardar Sonido"}
          </button>
        </div>

        {/* Recent gifts seen */}
        {recentGifts.length > 0 && (
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">🎁 Stickers Recibidos</div>
              <div className="panel-subtitle">Click para usar nombre</div>
            </div>
            <div className="recent-gifts-list">
              {recentGifts.map((name) => (
                <button
                  key={name}
                  className={`gift-chip ${mappings[name] ? "has-sound" : ""}`}
                  onClick={() => handleQuickAdd(name)}
                  title={mappings[name] ? "Ya tiene sonido" : "Click para agregar"}
                >
                  {mappings[name] ? "🔊" : "🎁"} {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* How to use */}
        <div className="panel info-panel">
          <div className="panel-title">ℹ️ Cómo usar</div>
          <ol className="info-list">
            <li>Conecta tu TikTok Live</li>
            <li>Cuando alguien envíe un regalo, aparecerá en "Stickers Recibidos"</li>
            <li>Escribe o selecciona el nombre del sticker</li>
            <li>Elige un archivo de audio (MP3, WAV, OGG...)</li>
            <li>El sonido se reproducirá automáticamente en el directo</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
