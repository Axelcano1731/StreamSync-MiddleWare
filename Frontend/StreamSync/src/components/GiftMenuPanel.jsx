import React, { useEffect, useMemo, useRef, useState } from "react";
import socket from "../services/socketService";

const params = new URLSearchParams(window.location.search);
const backendPort = params.get("backendPort") || "3000";
const BACKEND_URL = `http://127.0.0.1:${backendPort}`;
const OVERLAY_URL = `${BACKEND_URL}/overlay/gift-menu-overlay.html`;

// Pack de League of Monsters copiado a Backend/overlay/assets/lom.
const BOXES = ["red", "pink", "purple", "blue", "cyan", "green", "yellow", "orange", "black"];
const MONSTERS = [
  { id: "0", name: "Esqueleto" },
  { id: "1", name: "Diablillo" },
  { id: "2", name: "Bestia" },
  { id: "3", name: "Lagarto" },
  { id: "4", name: "Mantarraya" },
  { id: "5", name: "Caballero oscuro" },
  { id: "6", name: "Insecto alado" },
  { id: "7", name: "Titán" },
];

const TRIGGERS = [
  { value: "gift", label: "🎁 Regalo" },
  { value: "like", label: "❤️ Likes" },
  { value: "follow", label: "➕ Seguidor" },
  { value: "share", label: "↪️ Compartir" },
  { value: "subscribe", label: "⭐ Suscripción" },
];

const ANIMATIONS = ["pulse", "shake", "flash", "bounce", "none"];

const DEFAULTS = {
  enabled: true,
  title: "",
  titleSize: 30,
  columns: 4,
  cardSize: 200,
  gap: 26,
  hAlign: "center",
  vAlign: "top",
  scale: 1,
  showLabels: true,
  showCounters: true,
  showPops: true,
  animation: "pulse",
  items: [],
};

const boxPath = (name) => `assets/lom/boxes/${name}.png`;
const iconPath = (id) => `assets/lom/icons/${id}.png`;

// Los valores se guardan como ruta relativa del overlay, data URL o URL externa.
function srcOf(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  if (/^(data:|https?:)/i.test(v)) return v;
  return `${BACKEND_URL}/overlay/${v.replace(/^\/+/, "")}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function newItem(index = 0) {
  return {
    id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    enabled: true,
    trigger: "gift",
    box: boxPath(BOXES[index % BOXES.length]),
    boxColor: "",
    icon: iconPath(String(index % 8)),
    giftName: "",
    giftId: "",
    giftImage: "",
    giftEmoji: "",
    badge: "",
    label: MONSTERS[index % 8].name,
  };
}

// Plantilla con los 8 monstruos del juego, lista para retocar.
function leagueTemplate() {
  return MONSTERS.map((m, i) => ({
    ...newItem(i),
    id: `lom_${Date.now()}_${i}`,
    icon: iconPath(m.id),
    box: boxPath(BOXES[i % BOXES.length]),
    label: m.name,
  }));
}

// Tarjeta con el mismo aspecto que el overlay (vista previa WYSIWYG).
function PreviewCard({ item, cfg, size, selected, onClick, flash }) {
  const box = srcOf(item.box);
  const icon = srcOf(item.icon);
  const gift = srcOf(item.giftImage);

  return (
    <div
      onClick={onClick}
      title={item.label || "tarjeta"}
      style={{
        position: "relative",
        width: size,
        height: size,
        cursor: "pointer",
        opacity: item.enabled === false ? 0.35 : 1,
        outline: selected ? "3px solid #7c3aed" : "none",
        outlineOffset: 6,
        borderRadius: 12,
        transform: flash ? "scale(1.14)" : "scale(1)",
        filter: flash ? "brightness(1.5)" : "none",
        transition: "transform .25s ease, filter .25s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {box ? (
        <img src={box} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "18%",
            background: item.boxColor || "#333",
            boxShadow: "inset 0 0 0 3px rgba(255,255,255,.22)",
          }}
        />
      )}

      {icon ? (
        <img
          src={icon}
          alt=""
          style={{ position: "relative", zIndex: 2, width: "82%", height: "82%", objectFit: "contain" }}
        />
      ) : null}

      {gift ? (
        <img
          src={gift}
          alt=""
          style={{ position: "absolute", zIndex: 3, top: "-8%", right: "-8%", width: "34%", height: "34%", objectFit: "contain" }}
        />
      ) : item.giftEmoji ? (
        <div style={{ position: "absolute", zIndex: 3, top: "-6%", right: "-6%", fontSize: size * 0.26 }}>
          {item.giftEmoji}
        </div>
      ) : null}

      {item.badge ? (
        <div
          style={{
            position: "absolute",
            zIndex: 4,
            top: "-7%",
            left: "-5%",
            padding: "2px 9px",
            background: "linear-gradient(180deg,#ff3b6b,#d81b47)",
            border: "2px solid rgba(255,255,255,.9)",
            borderRadius: 999,
            fontWeight: 900,
            fontSize: 13,
            whiteSpace: "nowrap",
          }}
        >
          {item.badge}
        </div>
      ) : null}

      {cfg.showLabels && item.label ? (
        <div
          style={{
            position: "absolute",
            zIndex: 4,
            bottom: "-15%",
            left: "50%",
            transform: "translateX(-50%)",
            width: size * 1.15,
            textAlign: "center",
            fontWeight: 800,
            fontSize: 13,
            textShadow: "0 3px 8px rgba(0,0,0,.85)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.label}
        </div>
      ) : null}
    </div>
  );
}

export default function GiftMenuPanel() {
  const [cfg, setCfg] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [gifts, setGifts] = useState([]);
  const [giftSearch, setGiftSearch] = useState("");
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [flashId, setFlashId] = useState(null);
  const [feedback, setFeedback] = useState("");
  const uploadTarget = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    socket.emit("getAlertConfig", (config) => {
      setCfg({ ...DEFAULTS, ...(config?.giftMenu || {}) });
    });

    const onConfig = (config) => {
      // Solo adoptamos cambios externos si aún no hemos cargado nada.
      setCfg((prev) => prev || { ...DEFAULTS, ...(config?.giftMenu || {}) });
    };
    socket.on("alertConfig", onConfig);

    fetch(`${BACKEND_URL}/api/sticker-sounds/available-gifts`)
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setGifts(d))
      .catch(() => {});

    return () => socket.off("alertConfig", onConfig);
  }, []);

  const items = cfg?.items || [];
  const selected = items.find((i) => i.id === selectedId) || null;

  const filteredGifts = useMemo(() => {
    const q = giftSearch.trim().toLowerCase();
    const list = q ? gifts.filter((g) => String(g.name || "").toLowerCase().includes(q)) : gifts;
    return list.slice(0, 60);
  }, [gifts, giftSearch]);

  const flash = (text) => {
    setFeedback(text);
    setTimeout(() => setFeedback(""), 3500);
  };

  const patch = (p) => setCfg((prev) => ({ ...prev, ...p }));

  const patchItem = (id, p) =>
    setCfg((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === id ? { ...it, ...p } : it)),
    }));

  const save = (next) => {
    const body = next || cfg;
    socket.emit("updateAlertConfig", { section: "giftMenu", config: body });
    flash("Guardado. El overlay se actualizó solo.");
  };

  const addCard = () => {
    const item = newItem(items.length);
    setCfg((prev) => ({ ...prev, items: [...prev.items, item] }));
    setSelectedId(item.id);
  };

  const duplicateCard = (id) => {
    const source = items.find((i) => i.id === id);
    if (!source) return;
    const copy = { ...source, id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` };
    setCfg((prev) => ({ ...prev, items: [...prev.items, copy] }));
    setSelectedId(copy.id);
  };

  const removeCard = (id) => {
    setCfg((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  };

  const moveCard = (id, dir) => {
    setCfg((prev) => {
      const list = [...prev.items];
      const i = list.findIndex((it) => it.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return prev;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...prev, items: list };
    });
  };

  const loadTemplate = () => {
    if (items.length && !window.confirm("Esto reemplaza las tarjetas actuales por las 8 del juego. ¿Seguir?")) {
      return;
    }
    const next = { ...cfg, items: leagueTemplate() };
    setCfg(next);
    setSelectedId(null);
    save(next);
  };

  const pickFile = (field) => {
    uploadTarget.current = field;
    fileRef.current?.click();
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selected) return;
    const dataUrl = await readFileAsDataUrl(file);
    patchItem(selected.id, { [uploadTarget.current]: dataUrl });
    flash("Imagen cargada. Recuerda guardar.");
  };

  const previewCard = (id) => {
    setFlashId(id);
    setTimeout(() => setFlashId(null), 400);
  };

  if (!cfg) {
    return (
      <div className="page-enter">
        <div className="panel">
          <div className="empty-state">
            <div className="empty-state-icon">🃏</div>
            <div className="empty-state-text">Cargando menú de regalos...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ display: "grid", gap: 20 }}>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFile} />

      {/* ── Ajustes generales ── */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Menú de Regalos</div>
            <div className="panel-subtitle">
              Rejilla para OBS que enseña qué hace cada regalo. Se anima sola cuando llega el evento.
            </div>
          </div>
          <label className="toggle" title="Mostrar u ocultar el overlay">
            <input type="checkbox" checked={cfg.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="minecraft-info-card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>🎬 URL para OBS (Browser Source)</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input-field" readOnly value={OVERLAY_URL} style={{ flex: 1 }} />
            <button
              className="btn"
              onClick={() => {
                navigator.clipboard?.writeText(OVERLAY_URL).catch(() => {});
                flash("URL copiada.");
              }}
            >
              📋 Copiar
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label>Título (opcional)</label>
            <input className="input-field" value={cfg.title} onChange={(e) => patch({ title: e.target.value })} placeholder="ENVÍA REGALOS" />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label>Columnas</label>
            <input className="input-field" type="number" min="1" value={cfg.columns} onChange={(e) => patch({ columns: Number(e.target.value) || 1 })} />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label>Tamaño de tarjeta (px)</label>
            <input className="input-field" type="number" value={cfg.cardSize} onChange={(e) => patch({ cardSize: Number(e.target.value) || 200 })} />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label>Separación (px)</label>
            <input className="input-field" type="number" value={cfg.gap} onChange={(e) => patch({ gap: Number(e.target.value) || 0 })} />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label>Posición horizontal</label>
            <select className="select-field" value={cfg.hAlign} onChange={(e) => patch({ hAlign: e.target.value })}>
              <option value="left">Izquierda</option>
              <option value="center">Centro</option>
              <option value="right">Derecha</option>
            </select>
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label>Posición vertical</label>
            <select className="select-field" value={cfg.vAlign} onChange={(e) => patch({ vAlign: e.target.value })}>
              <option value="top">Arriba</option>
              <option value="middle">Centro</option>
              <option value="bottom">Abajo</option>
            </select>
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label>Escala general</label>
            <input className="input-field" type="number" step="0.05" value={cfg.scale} onChange={(e) => patch({ scale: Number(e.target.value) || 1 })} />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label>Animación al recibir</label>
            <select className="select-field" value={cfg.animation} onChange={(e) => patch({ animation: e.target.value })}>
              {ANIMATIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 14 }}>
          {[
            ["showLabels", "Mostrar nombres"],
            ["showCounters", "Mostrar contador"],
            ["showPops", "Mostrar quién lo envía"],
          ].map(([key, label]) => (
            <label key={key} className="config-row" style={{ gap: 8, marginBottom: 0 }}>
              <input type="checkbox" checked={!!cfg[key]} onChange={(e) => patch({ [key]: e.target.checked })} />
              <span className="config-label">{label}</span>
            </label>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <button className="btn btn-primary" onClick={() => save()}>💾 Guardar</button>
          <button className="btn" onClick={addCard}>➕ Añadir tarjeta</button>
          <button className="btn" onClick={loadTemplate}>👹 Plantilla League of Monsters</button>
        </div>

        {feedback ? <div className="minecraft-validation-ok" style={{ marginTop: 14 }}>{feedback}</div> : null}
      </div>

      {/* ── Vista previa ── */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Vista previa</div>
            <div className="panel-subtitle">Igual que se verá en OBS. Haz clic en una tarjeta para editarla.</div>
          </div>
        </div>

        <div
          style={{
            background: "repeating-conic-gradient(#1a1a24 0% 25%, #12121a 0% 50%) 50%/28px 28px",
            borderRadius: 14,
            padding: 30,
            display: "flex",
            justifyContent: cfg.hAlign === "left" ? "flex-start" : cfg.hAlign === "right" ? "flex-end" : "center",
            overflowX: "auto",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {cfg.title ? (
              <div style={{ fontWeight: 900, textAlign: "center", fontSize: Math.min(cfg.titleSize, 34) }}>{cfg.title}</div>
            ) : null}
            {items.length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}>
                <div className="empty-state-text">Sin tarjetas. Usa la plantilla o añade una.</div>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${Math.max(1, cfg.columns)}, ${Math.min(cfg.cardSize, 130)}px)`,
                  gap: Math.min(cfg.gap, 30),
                  rowGap: Math.min(cfg.gap, 30) + (cfg.showLabels ? 16 : 0),
                }}
              >
                {items.map((item) => (
                  <PreviewCard
                    key={item.id}
                    item={item}
                    cfg={cfg}
                    size={Math.min(cfg.cardSize, 130)}
                    selected={item.id === selectedId}
                    flash={flashId === item.id}
                    onClick={() => setSelectedId(item.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Editor de la tarjeta ── */}
      {selected ? (
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Editar: {selected.label || "tarjeta"}</div>
              <div className="panel-subtitle">Imagen, regalo que la activa y textos</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn" onClick={() => moveCard(selected.id, -1)}>◀</button>
              <button className="btn" onClick={() => moveCard(selected.id, 1)}>▶</button>
              <button className="btn" onClick={() => previewCard(selected.id)}>✨ Probar</button>
              <button className="btn" onClick={() => duplicateCard(selected.id)}>⧉ Duplicar</button>
              <button className="btn btn-danger" onClick={() => removeCard(selected.id)}>🗑 Eliminar</button>
            </div>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              <label className="config-row" style={{ gap: 8, marginBottom: 0 }}>
                <input
                  type="checkbox"
                  checked={selected.enabled !== false}
                  onChange={(e) => patchItem(selected.id, { enabled: e.target.checked })}
                />
                <span className="config-label">Tarjeta visible</span>
              </label>

              <div className="input-group" style={{ marginBottom: 0, flex: "0 1 180px" }}>
                <label>Se activa con</label>
                <select
                  className="select-field"
                  value={selected.trigger || "gift"}
                  onChange={(e) => patchItem(selected.id, { trigger: e.target.value })}
                >
                  {TRIGGERS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Monstruo */}
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Monstruo / imagen central</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {MONSTERS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    title={m.name}
                    onClick={() => patchItem(selected.id, { icon: iconPath(m.id), label: selected.label || m.name })}
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: 10,
                      border: selected.icon === iconPath(m.id) ? "2px solid #7c3aed" : "1px solid rgba(255,255,255,.15)",
                      background: "rgba(255,255,255,.05)",
                      cursor: "pointer",
                      padding: 4,
                    }}
                  >
                    <img src={srcOf(iconPath(m.id))} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </button>
                ))}
                <button className="btn" onClick={() => pickFile("icon")}>📁 Subir otra</button>
              </div>
            </div>

            {/* Caja */}
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Fondo de la tarjeta</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {BOXES.map((b) => (
                  <button
                    key={b}
                    type="button"
                    title={b}
                    onClick={() => patchItem(selected.id, { box: boxPath(b) })}
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 10,
                      border: selected.box === boxPath(b) ? "2px solid #7c3aed" : "1px solid rgba(255,255,255,.15)",
                      background: "rgba(255,255,255,.05)",
                      cursor: "pointer",
                      padding: 3,
                    }}
                  >
                    <img src={srcOf(boxPath(b))} alt={b} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </button>
                ))}
                <button className="btn" onClick={() => pickFile("box")}>📁 Subir otro</button>
                <input
                  type="color"
                  title="Color plano"
                  value={selected.boxColor || "#7c3aed"}
                  onChange={(e) => patchItem(selected.id, { box: "", boxColor: e.target.value })}
                  style={{ width: 46, height: 46, borderRadius: 10, border: "1px solid rgba(255,255,255,.15)", background: "transparent", cursor: "pointer" }}
                />
              </div>
            </div>

            {/* Regalo */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Regalo que la activa (vacío = cualquiera)</label>
                <input
                  className="input-field"
                  value={selected.giftName || ""}
                  onChange={(e) => patchItem(selected.id, { giftName: e.target.value })}
                  placeholder="Rose"
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Insignia superior izquierda</label>
                <input
                  className="input-field"
                  value={selected.badge || ""}
                  onChange={(e) => patchItem(selected.id, { badge: e.target.value })}
                  placeholder="X15"
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Nombre debajo</label>
                <input
                  className="input-field"
                  value={selected.label || ""}
                  onChange={(e) => patchItem(selected.id, { label: e.target.value })}
                  placeholder="Esqueleto"
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Emoji del regalo (si no usas imagen)</label>
                <input
                  className="input-field"
                  value={selected.giftEmoji || ""}
                  onChange={(e) => patchItem(selected.id, { giftEmoji: e.target.value })}
                  placeholder="🌹"
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn" onClick={() => setShowGiftPicker((v) => !v)}>
                {showGiftPicker ? "Cerrar catálogo" : "🎁 Elegir regalo del catálogo"}
              </button>
              <button className="btn" onClick={() => pickFile("giftImage")}>📁 Subir icono de regalo</button>
              {selected.giftImage ? (
                <button className="btn btn-danger" onClick={() => patchItem(selected.id, { giftImage: "" })}>
                  Quitar icono
                </button>
              ) : null}
              {selected.giftId ? (
                <span className="event-badge share">ID {selected.giftId}</span>
              ) : null}
            </div>

            {showGiftPicker ? (
              <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: 12 }}>
                <input
                  className="input-field"
                  value={giftSearch}
                  onChange={(e) => setGiftSearch(e.target.value)}
                  placeholder="Buscar regalo por nombre..."
                  style={{ marginBottom: 10 }}
                />
                {gifts.length === 0 ? (
                  <div className="empty-state" style={{ padding: 16 }}>
                    <div className="empty-state-text">
                      El catálogo se llena al conectar con TikTok. Mientras, escribe el nombre a mano.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 8, maxHeight: 280, overflowY: "auto" }}>
                    {filteredGifts.map((g) => (
                      <button
                        key={g.id || g.name}
                        type="button"
                        onClick={() =>
                          patchItem(selected.id, {
                            giftName: g.name || "",
                            giftId: g.id != null ? String(g.id) : "",
                            giftImage: g.image || "",
                          })
                        }
                        style={{
                          background: "rgba(255,255,255,.05)",
                          border: "1px solid rgba(255,255,255,.12)",
                          borderRadius: 10,
                          padding: 6,
                          cursor: "pointer",
                          color: "inherit",
                        }}
                      >
                        {g.image ? (
                          <img src={g.image} alt="" style={{ width: 40, height: 40, objectFit: "contain" }} />
                        ) : null}
                        <div style={{ fontSize: 11, fontWeight: 700 }}>{g.name}</div>
                        <div style={{ fontSize: 10, opacity: 0.7 }}>{g.diamondCount ?? g.cost ?? ""}💎</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <button className="btn btn-primary" style={{ justifySelf: "start" }} onClick={() => save()}>
              💾 Guardar cambios
            </button>
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="empty-state" style={{ padding: 24 }}>
            <div className="empty-state-icon">👆</div>
            <div className="empty-state-text">Haz clic en una tarjeta de la vista previa para editarla.</div>
          </div>
        </div>
      )}
    </div>
  );
}
