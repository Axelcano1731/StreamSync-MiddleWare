// components/VoiceSettings.jsx
import React, { useMemo, useState } from "react";

const params = new URLSearchParams(window.location.search);
const backendPort = params.get("backendPort") || "3000";
const BACKEND_URL = `http://localhost:${backendPort}`;

// Nombres amigables para los códigos de idioma más comunes.
const LANG_NAMES = {
  es: "🇪🇸 Español",
  en: "🇬🇧 Inglés",
  pt: "🇵🇹 Portugués",
  fr: "🇫🇷 Francés",
  it: "🇮🇹 Italiano",
  de: "🇩🇪 Alemán",
  ja: "🇯🇵 Japonés",
  ko: "🇰🇷 Coreano",
  zh: "🇨🇳 Chino",
};

// Etiqueta corta del acento a partir del locale: "es-MX" -> "MX".
function regionLabel(locale = "") {
  const parts = locale.split("-");
  return parts[1] || locale;
}

export function VoiceSettings({
  voices = [],
  selectedVoice,
  onVoiceSelect,
  isMuted,
  onToggleMute,
}) {
  const [language, setLanguage] = useState("es");
  const [gender, setGender] = useState("all");
  const [testText, setTestText] = useState("Hola, esta es una prueba de voz");
  const [testing, setTesting] = useState(null);

  // Idiomas disponibles (prefijo de 2 letras), español primero.
  const languages = useMemo(() => {
    const set = new Set(voices.map((v) => (v.locale || "").split("-")[0]));
    return Array.from(set)
      .filter(Boolean)
      .sort((a, b) => (a === "es" ? -1 : b === "es" ? 1 : a.localeCompare(b)));
  }, [voices]);

  const filtered = useMemo(() => {
    return voices.filter((v) => {
      const langOk = language === "all" || (v.locale || "").startsWith(language);
      const genderOk = gender === "all" || v.gender === gender;
      return langOk && genderOk;
    });
  }, [voices, language, gender]);

  const genders = useMemo(() => {
    const base = voices.filter(
      (v) => language === "all" || (v.locale || "").startsWith(language)
    );
    return [
      { key: "all", label: "🎤 Todas", count: base.length },
      { key: "female", label: "👩 Mujer", count: base.filter((v) => v.gender === "female").length },
      { key: "male", label: "👨 Hombre", count: base.filter((v) => v.gender === "male").length },
    ];
  }, [voices, language]);

  const testVoice = async (voice) => {
    if (!testText.trim()) return;
    setTesting(voice.shortName);
    try {
      const res = await fetch(`${BACKEND_URL}/api/tts/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: testText, voice: voice.shortName }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (err) {
      console.error("[tts] No se pudo probar la voz:", err);
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="voice-settings">
      <div className="voice-settings-header">
        <h3>🔊 Lector de Chat (TTS) · Voces neuronales</h3>
        <button
          className={`mute-button ${isMuted ? "muted" : ""}`}
          onClick={onToggleMute}
          title={isMuted ? "Activar lector" : "Silenciar lector"}
        >
          {isMuted ? "🔇" : "🔊"}
        </button>
      </div>

      {/* Filtro de idioma */}
      <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <label style={{ fontSize: "0.85em", color: "var(--text-muted)" }}>Idioma:</label>
        <select
          className="input-field"
          style={{ padding: "6px 10px", fontSize: "0.85em" }}
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="all">🌐 Todos</option>
          {languages.map((code) => (
            <option key={code} value={code}>
              {LANG_NAMES[code] || code.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {/* Filtro por género */}
      <div className="filter-tabs" style={{ marginBottom: 12 }}>
        {genders.map((g) => (
          <button
            key={g.key}
            className={`filter-tab ${gender === g.key ? "active" : ""}`}
            onClick={() => setGender(g.key)}
          >
            {g.label} ({g.count})
          </button>
        ))}
      </div>

      {/* Texto de prueba */}
      <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
        <input
          className="input-field"
          style={{ flex: 1, padding: "8px 12px", fontSize: "0.85em" }}
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          placeholder="Texto de prueba..."
        />
      </div>

      {/* Tarjetas de voz */}
      <div className="voice-list" style={{ flexWrap: "wrap", gap: 8 }}>
        {voices.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85em" }}>
            Cargando voces neuronales... (requiere conexión a internet)
          </p>
        ) : filtered.length > 0 ? (
          filtered.map((voice) => (
            <div
              key={voice.shortName}
              className={`voice-card ${
                selectedVoice?.shortName === voice.shortName ? "selected" : ""
              }`}
              onClick={() => onVoiceSelect(voice)}
              style={{ flex: "0 0 160px" }}
            >
              <p style={{ fontSize: "1.2em", marginBottom: 2 }}>
                {voice.gender === "female" ? "👩" : voice.gender === "male" ? "👨" : "🤖"}
              </p>
              <p className="voice-name">{voice.name}</p>
              <p className="voice-lang">
                {voice.locale} · {regionLabel(voice.locale)}
              </p>
              <button
                className="btn"
                style={{
                  marginTop: 6,
                  padding: "4px 10px",
                  fontSize: "0.75em",
                  width: "100%",
                  justifyContent: "center",
                }}
                disabled={testing === voice.shortName}
                onClick={(e) => {
                  e.stopPropagation();
                  testVoice(voice);
                }}
              >
                {testing === voice.shortName ? "⏳ ..." : "▶ Probar"}
              </button>
            </div>
          ))
        ) : (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85em" }}>
            No hay voces para este filtro.
          </p>
        )}
      </div>
    </div>
  );
}
