// components/VoiceSettings.jsx
import React, { useMemo, useState } from "react";

/**
 * Classify a voice by gender based on name heuristics
 */
function classifyVoice(voice) {
  const name = voice.name.toLowerCase();
  const femaleNames = [
    "female", "mujer", "woman", "zira", "helena", "sabina", "laura", "lucia",
    "maria", "elsa", "dora", "irene", "monica", "paulina", "rosa", "sara",
    "alice", "samantha", "victoria", "fiona", "moira", "karen", "tessa",
    "milena", "kendra", "joanna", "salli", "ivy", "kimberly", "nicky"
  ];
  const maleNames = [
    "male", "hombre", "man", "david", "pablo", "jorge", "carlos", "diego",
    "daniel", "microsoft mark", "alex", "fred", "thomas", "rishi", "lee",
    "oliver", "james", "george", "ryan", "enrique", "andres", "felipe",
    "matthew", "joey", "justin", "kevin", "brian"
  ];

  if (femaleNames.some(n => name.includes(n))) return "female";
  if (maleNames.some(n => name.includes(n))) return "male";
  return "other";
}

export function VoiceSettings({
  voices = [],
  selectedVoice,
  onVoiceSelect,
  isMuted,
  onToggleMute,
}) {
  const [category, setCategory] = useState("all");
  const [testText, setTestText] = useState("Hola, esta es una prueba de voz");

  // Classify and group voices
  const classified = useMemo(() => {
    return voices.map((v) => ({ ...v, _gender: classifyVoice(v) }));
  }, [voices]);

  const filtered = useMemo(() => {
    let list = classified;
    if (category !== "all") {
      list = list.filter((v) => v._gender === category);
    }
    // Prioritize Spanish voices
    list.sort((a, b) => {
      const aEs = a.lang.startsWith("es") ? 0 : 1;
      const bEs = b.lang.startsWith("es") ? 0 : 1;
      return aEs - bEs;
    });
    return list.slice(0, 30);
  }, [classified, category]);

  const testVoice = (voice) => {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(testText);
    utterance.voice = voice;
    utterance.rate = 1;
    utterance.pitch = 1;
    speechSynthesis.speak(utterance);
  };

  const categories = [
    { key: "all", label: "🎤 Todas", count: classified.length },
    { key: "female", label: "👩 Mujer", count: classified.filter((v) => v._gender === "female").length },
    { key: "male", label: "👨 Hombre", count: classified.filter((v) => v._gender === "male").length },
    { key: "other", label: "🤖 Otro", count: classified.filter((v) => v._gender === "other").length },
  ];

  return (
    <div className="voice-settings">
      <div className="voice-settings-header">
        <h3>🔊 Lector de Chat (TTS)</h3>
        <button
          className={`mute-button ${isMuted ? "muted" : ""}`}
          onClick={onToggleMute}
          title={isMuted ? "Activar sonido" : "Silenciar"}
        >
          {isMuted ? "🔇" : "🔊"}
        </button>
      </div>

      {/* Category Filter */}
      <div className="filter-tabs" style={{ marginBottom: 12 }}>
        {categories.map((c) => (
          <button
            key={c.key}
            className={`filter-tab ${category === c.key ? "active" : ""}`}
            onClick={() => setCategory(c.key)}
          >
            {c.label} ({c.count})
          </button>
        ))}
      </div>

      {/* Test Text */}
      <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
        <input
          className="input-field"
          style={{ flex: 1, padding: "8px 12px", fontSize: "0.85em" }}
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          placeholder="Texto de prueba..."
        />
      </div>

      {/* Voice Cards */}
      <div className="voice-list" style={{ flexWrap: "wrap", gap: 8 }}>
        {filtered.length > 0 ? (
          filtered.map((voice, index) => (
            <div
              key={index}
              className={`voice-card ${
                selectedVoice?.name === voice.name ? "selected" : ""
              }`}
              onClick={() => onVoiceSelect(voice)}
              style={{ flex: "0 0 160px" }}
            >
              <p style={{ fontSize: "1.2em", marginBottom: 2 }}>
                {voice._gender === "female"
                  ? "👩"
                  : voice._gender === "male"
                  ? "👨"
                  : "🤖"}
              </p>
              <p className="voice-name">{voice.name}</p>
              <p className="voice-lang">{voice.lang}</p>
              <button
                className="btn"
                style={{
                  marginTop: 6,
                  padding: "4px 10px",
                  fontSize: "0.75em",
                  width: "100%",
                  justifyContent: "center",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  testVoice(voice);
                }}
              >
                ▶ Probar
              </button>
            </div>
          ))
        ) : (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85em" }}>
            No hay voces en esta categoría.
          </p>
        )}
      </div>
    </div>
  );
}
