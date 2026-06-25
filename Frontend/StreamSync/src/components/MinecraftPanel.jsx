import React, { useEffect, useMemo, useRef, useState } from "react";
import socket from "../services/socketService";

const QUICK_COMMANDS = [
  { key: "list", label: "Jugadores", command: "list" },
  { key: "save-all", label: "Guardar", command: "save-all" },
  { key: "time set day", label: "Día", command: "time set day" },
  { key: "weather clear", label: "Clima", command: "weather clear" },
];

const MINECRAFT_VERSION_OPTIONS = ["1.20", "1.21"];

function isLegacyAutoPath(jar, dir) {
  const j = jar || "";
  const d = dir || "";
  return j.includes("C:\\Minecraft") || d.includes("C:\\Minecraft");
}

function normalizeActions(a) {
  return {
    enabled: a?.enabled !== false,
    rules: Array.isArray(a?.rules) ? a.rules : [],
  };
}

const BEDROCK_BUTTONS = [
  { label: "🧱 Llenar", sub: "fill" },
  { label: "🚀 Teleport", sub: "tp" },
  { label: "🔷 Paredes cristal", sub: "glass" },
  { label: "🪵 Paredes madera", sub: "wood" },
  { label: "⬛ Bedrock", sub: "rock" },
  { label: "🎆 Fuegos", sub: "fireworks" },
  { label: "🧹 Limpiar", sub: "clear" },
  { label: "💣 TNT random", sub: "randomtnt" },
  { label: "🗑️ Borrar caja", sub: "delete", danger: true },
];

function sanitizeMinecraftConfig(config) {
  const safeVersion = MINECRAFT_VERSION_OPTIONS.includes(config.minecraftVersion)
    ? config.minecraftVersion
    : "1.21";

  return {
    ...config,
    minecraftVersion: safeVersion,
    minMemoryMb: Number(config.minMemoryMb) || 1024,
    maxMemoryMb: Number(config.maxMemoryMb) || 2048,
    port: Number(config.port) || 25565,
  };
}

function CheckRow({ ok, label, detail }) {
  return (
    <div className="minecraft-check-row">
      <div className={`minecraft-check-dot ${ok ? "ok" : "error"}`}></div>
      <div style={{ flex: 1 }}>
        <div className="minecraft-check-label">{label}</div>
        {detail ? <div className="minecraft-check-detail">{detail}</div> : null}
      </div>
    </div>
  );
}

export default function MinecraftPanel() {
  const [config, setConfig] = useState({
    minecraftVersion: "1.21",
    javaPath: "java",
    serverJar: "",
    serverDirectory: "",
    minMemoryMb: 2048,
    maxMemoryMb: 4096,
    port: 25565,
    autoAcceptEula: false,
    startupArgs: "",
  });
  const [minecraftStatus, setMinecraftStatus] = useState(null);
  const [minecraftCommand, setMinecraftCommand] = useState("");
  const [message, setMessage] = useState("");
  const [validation, setValidation] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const pathsManualRef = useRef(false);

  // Preparación de partida (OP, caja BedrockBox) y reglas regalo→comando.
  const [opName, setOpName] = useState(() => localStorage.getItem("mcOpName") || "");
  const [box, setBox] = useState({ size: "", height: "", timer: "" });
  const [actions, setActions] = useState({ enabled: true, rules: [] });
  const [actionsMsg, setActionsMsg] = useState("");

  useEffect(() => {
    if (pathsManualRef.current) return;
    const empty = !String(config.serverJar || "").trim() && !String(config.serverDirectory || "").trim();
    const legacy = isLegacyAutoPath(config.serverJar, config.serverDirectory);
    if (!empty && !legacy) return;

    socket.emit("getMinecraftSuggestedPaths", config.minecraftVersion, (paths) => {
      if (!paths) return;
      setConfig((prev) => ({
        ...prev,
        minecraftVersion: paths.minecraftVersion,
        serverJar: paths.serverJar,
        serverDirectory: paths.serverDirectory,
      }));
    });
  }, [config.minecraftVersion]);

  useEffect(() => {
    socket.emit("getAlertConfig", (cfg) => {
      if (cfg?.minecraft) {
        setConfig((prev) => ({ ...prev, ...cfg.minecraft }));
      }
      if (cfg?.minecraftActions) {
        setActions(normalizeActions(cfg.minecraftActions));
      }
    });

    socket.emit("getMinecraftStatus", (status) => {
      setMinecraftStatus(status);
      if (status?.config) {
        setConfig((prev) => ({ ...prev, ...status.config }));
      }
    });

    const handleConfig = (cfg) => {
      if (cfg?.minecraft) {
        setConfig((prev) => ({ ...prev, ...cfg.minecraft }));
      }
      if (cfg?.minecraftActions) {
        setActions(normalizeActions(cfg.minecraftActions));
      }
    };

    const handleStatus = (status) => {
      setMinecraftStatus(status);
      if (status?.config) {
        setConfig((prev) => ({ ...prev, ...status.config }));
      }
    };

    const handleValidation = (payload) => {
      if (payload?.ok) {
        setValidation(payload.result);
      } else {
        setValidation({
          ok: false,
          issues: [payload?.error || "No se pudo validar la configuración."],
          checks: {},
        });
      }
      setIsValidating(false);
    };

    socket.on("alertConfig", handleConfig);
    socket.on("minecraftStatus", handleStatus);
    socket.on("minecraftValidation", handleValidation);

    return () => {
      socket.off("alertConfig", handleConfig);
      socket.off("minecraftStatus", handleStatus);
      socket.off("minecraftValidation", handleValidation);
    };
  }, []);

  const logs = useMemo(
    () => (minecraftStatus?.logs || []).slice(-120).reverse(),
    [minecraftStatus]
  );

  const saveConfig = () => {
    const payload = sanitizeMinecraftConfig(config);
    socket.emit("updateMinecraftConfig", payload, (response) => {
      setMessage(
        response?.ok
          ? "Configuración de Minecraft guardada."
          : `No se pudo guardar: ${response?.error || "Error desconocido"}`
      );
    });
  };

  const validateConfig = () => {
    setIsValidating(true);
    socket.emit("validateMinecraftConfig", sanitizeMinecraftConfig(config), (response) => {
      if (response?.ok) {
        setValidation(response.result);
      } else {
        setValidation({
          ok: false,
          issues: [response?.error || "No se pudo validar la configuración."],
          checks: {},
        });
      }
      setIsValidating(false);
    });
  };

  const startServer = () => {
    const payload = sanitizeMinecraftConfig(config);
    socket.emit("startMinecraftServer", payload, (response) => {
      setMessage(
        response?.ok
          ? `Servidor iniciando en ${response.status?.address || "localhost:25565"}`
          : `No se pudo iniciar: ${response?.error || "Error desconocido"}`
      );
    });
  };

  const stopServer = () => {
    socket.emit("stopMinecraftServer", (response) => {
      setMessage(
        response?.ok
          ? "Solicitud de apagado enviada al servidor."
          : `No se pudo detener: ${response?.error || "Error desconocido"}`
      );
    });
  };

  const sendCommand = (commandOverride) => {
    const nextCommand = (commandOverride || minecraftCommand).trim();
    if (!nextCommand) return;

    socket.emit("sendMinecraftCommand", nextCommand, (response) => {
      setMessage(
        response?.ok
          ? `Comando enviado: ${nextCommand}`
          : `No se pudo enviar el comando: ${response?.error || "Error desconocido"}`
      );
      if (response?.ok && !commandOverride) {
        setMinecraftCommand("");
      }
    });
  };

  const isRunning = !!minecraftStatus?.isRunning;
  const OVERLAY_URL = "http://localhost:3000/overlay/minecraft-gifts-overlay.html";

  // ── OP / modo de juego ──
  const makeOp = () => {
    const name = opName.trim();
    if (!name) {
      setMessage("Escribe tu nombre de Minecraft para hacerte OP.");
      return;
    }
    localStorage.setItem("mcOpName", name);
    sendCommand(`op ${name}`);
  };
  const removeOp = () => {
    const name = opName.trim();
    if (name) sendCommand(`deop ${name}`);
  };
  const goCreative = () => {
    const name = opName.trim();
    if (name) sendCommand(`gamemode creative ${name}`);
  };

  // ── Caja BedrockBox ──
  const runBedrock = (sub) => sendCommand(`bedrock ${sub}`);
  const createBox = () => {
    const s = parseInt(box.size, 10);
    const h = parseInt(box.height, 10);
    if (s >= 3 && h >= 9 && h <= 21) runBedrock(`create ${s} ${h}`);
    else runBedrock("create");
  };
  const applyTimer = () => {
    const t = parseInt(box.timer, 10);
    if (t > 0) runBedrock(`timer ${t}`);
  };

  // ── Reglas regalo → comando ──
  const updateRule = (i, patch) =>
    setActions((prev) => ({
      ...prev,
      rules: prev.rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    }));
  const removeRule = (i) =>
    setActions((prev) => ({ ...prev, rules: prev.rules.filter((_, idx) => idx !== i) }));
  const addRule = () =>
    setActions((prev) => ({
      ...prev,
      rules: [
        ...prev.rules,
        { event: "gift", giftName: "", command: "", enabled: true, minDiamonds: 0, repeatPerGift: false, maxRepeat: 10 },
      ],
    }));
  const saveActions = () => {
    const clean = {
      enabled: actions.enabled,
      rules: actions.rules
        .map((r) => ({
          event: "gift",
          giftName: (r.giftName || "").trim(),
          command: (r.command || "").trim(),
          enabled: r.enabled !== false,
          minDiamonds: Number(r.minDiamonds) || 0,
          repeatPerGift: !!r.repeatPerGift,
          maxRepeat: Number(r.maxRepeat) || 10,
        }))
        .filter((r) => r.command),
    };
    socket.emit("updateAlertConfig", { section: "minecraftActions", config: clean });
    setActions(clean);
    setActionsMsg("Reglas guardadas. El overlay se actualizó automáticamente.");
    setTimeout(() => setActionsMsg(""), 3500);
  };

  const copyOverlay = () => {
    navigator.clipboard?.writeText(OVERLAY_URL).catch(() => {});
    setActionsMsg("URL del overlay copiada.");
    setTimeout(() => setActionsMsg(""), 2500);
  };

  return (
    <div className="page-enter" style={{ display: "grid", gap: 20 }}>
      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Servidor de Minecraft</div>
            <div className="panel-subtitle">
              Arranca, valida y controla tu servidor local desde StreamSync.
            </div>
          </div>

          <div className={`status-badge ${minecraftStatus?.status || "stopped"}`}>
            <span className="status-dot"></span>
            {(minecraftStatus?.status || "stopped").toUpperCase()}
          </div>
        </div>

        <div className="minecraft-hero-card">
          <div>
            <div className="minecraft-hero-title">Dirección local</div>
            <div className="minecraft-hero-value">
              {minecraftStatus?.address || "localhost:25565"}
            </div>
          </div>
          <div>
            <div className="minecraft-hero-title">PID</div>
            <div className="minecraft-hero-value">
              {minecraftStatus?.pid || "Sin proceso"}
            </div>
          </div>
          <div>
            <div className="minecraft-hero-title">Último error</div>
            <div className="minecraft-hero-value">
              {minecraftStatus?.lastError || "Sin errores"}
            </div>
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
              <div className="panel-title">Configuración</div>
              <div className="panel-subtitle">
                Define Java, el `.jar`, memoria y argumentos de arranque
              </div>
            </div>
          </div>

          <div className="minecraft-grid">
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Versión del servidor</label>
              <select
                className="input-field"
                value={config.minecraftVersion || "1.21"}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    minecraftVersion: e.target.value,
                  }))
                }
              >
                {MINECRAFT_VERSION_OPTIONS.map((version) => (
                  <option key={version} value={version}>
                    {version}
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Ruta del .jar</label>
              <input
                className="input-field"
                value={config.serverJar || ""}
                onChange={(e) => {
                  pathsManualRef.current = true;
                  setConfig((prev) => ({ ...prev, serverJar: e.target.value }));
                }}
                placeholder="C:\\Minecraft\\server.jar"
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Carpeta del servidor</label>
              <input
                className="input-field"
                value={config.serverDirectory || ""}
                onChange={(e) => {
                  pathsManualRef.current = true;
                  setConfig((prev) => ({
                    ...prev,
                    serverDirectory: e.target.value,
                  }));
                }}
                placeholder="C:\\Minecraft"
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Ruta de Java</label>
              <input
                className="input-field"
                value={config.javaPath || ""}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, javaPath: e.target.value }))
                }
                placeholder="java"
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Puerto</label>
              <input
                className="input-field"
                type="number"
                value={config.port || 25565}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, port: e.target.value }))
                }
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Memoria mínima (MB)</label>
              <input
                className="input-field"
                type="number"
                value={config.minMemoryMb || 1024}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, minMemoryMb: e.target.value }))
                }
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Memoria máxima (MB)</label>
              <input
                className="input-field"
                type="number"
                value={config.maxMemoryMb || 2048}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, maxMemoryMb: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="input-group" style={{ marginTop: 16, marginBottom: 16 }}>
            <label>Argumentos extra</label>
            <input
              className="input-field"
              value={config.startupArgs || ""}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, startupArgs: e.target.value }))
              }
              placeholder="-Dcom.mojang.eula.agree=true"
            />
          </div>

          <div className="config-row" style={{ marginBottom: 16 }}>
            <span className="config-label">Aceptar EULA automáticamente</span>
            <label className="toggle">
              <input
                type="checkbox"
                checked={config.autoAcceptEula ?? false}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    autoAcceptEula: e.target.checked,
                  }))
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={saveConfig}>
              Guardar
            </button>
            <button className="btn" onClick={validateConfig} disabled={isValidating}>
              {isValidating ? "Validando..." : "Validar"}
            </button>
            <button className="btn btn-primary" onClick={startServer}>
              Iniciar
            </button>
            <button className="btn btn-danger" onClick={stopServer}>
              Detener
            </button>
          </div>

          {message ? (
            <div className="minecraft-info-card" style={{ marginTop: 16 }}>
              {message}
            </div>
          ) : null}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Validación</div>
              <div className="panel-subtitle">
                Revisa Java, rutas y preparación antes de arrancar
              </div>
            </div>
          </div>

          {validation ? (
            <div style={{ display: "grid", gap: 12 }}>
              <CheckRow
                ok={validation.checks?.javaOk}
                label="Java disponible"
                detail={validation.checks?.javaVersion || validation.checks?.javaError}
              />
              <CheckRow
                ok={validation.checks?.serverJarExists}
                label="Archivo .jar accesible"
                detail={validation.config?.serverJar || "Sin ruta"}
              />
              <CheckRow
                ok={validation.checks?.serverDirectoryExists}
                label="Carpeta del servidor"
                detail={validation.config?.serverDirectory || "Sin carpeta"}
              />
              <CheckRow
                ok={validation.checks?.eulaExists || validation.checks?.autoAcceptEula}
                label="EULA listo"
                detail={
                  validation.checks?.eulaExists
                    ? "eula.txt detectado"
                    : validation.checks?.autoAcceptEula
                    ? "Se aceptará automáticamente al iniciar"
                    : "Necesitarás aceptar el EULA o activar la opción automática"
                }
              />

              {validation.issues?.length > 0 ? (
                <div className="minecraft-validation-errors">
                  {validation.issues.map((issue) => (
                    <div key={issue}>{issue}</div>
                  ))}
                </div>
              ) : (
                <div className="minecraft-validation-ok">
                  La configuración parece lista para arrancar el servidor.
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-state-text">
                Ejecuta la validación para comprobar Java y las rutas.
              </div>
            </div>
          )}
        </div>
      </div>

      {!isRunning ? (
        <div className="minecraft-info-card">
          ⚠️ Inicia el servidor para usar los controles de OP, la caja y probar
          los regalos.
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 20,
        }}
      >
        {/* ── 1 · Permisos (OP) ── */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">1 · Hazte OP</div>
              <div className="panel-subtitle">
                Necesario para usar /bedrock y crear la caja
              </div>
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: 12 }}>
            <label>Tu nombre de Minecraft</label>
            <input
              className="input-field"
              value={opName}
              onChange={(e) => setOpName(e.target.value)}
              placeholder="Ej: Axel123"
            />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={makeOp} disabled={!isRunning || !opName.trim()}>
              👑 Hazte OP
            </button>
            <button className="btn" onClick={goCreative} disabled={!isRunning || !opName.trim()}>
              🎨 Modo creativo
            </button>
            <button className="btn btn-danger" onClick={removeOp} disabled={!isRunning || !opName.trim()}>
              Quitar OP
            </button>
          </div>
        </div>

        {/* ── 2 · Caja BedrockBox ── */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">2 · Caja BedrockBox</div>
              <div className="panel-subtitle">
                Móntala donde estés parado en el juego
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
            <div className="input-group" style={{ marginBottom: 0, flex: "1 1 90px" }}>
              <label>Tamaño (mín 3)</label>
              <input
                className="input-field"
                type="number"
                value={box.size}
                onChange={(e) => setBox((p) => ({ ...p, size: e.target.value }))}
                placeholder="5"
              />
            </div>
            <div className="input-group" style={{ marginBottom: 0, flex: "1 1 90px" }}>
              <label>Altura (9–21)</label>
              <input
                className="input-field"
                type="number"
                value={box.height}
                onChange={(e) => setBox((p) => ({ ...p, height: e.target.value }))}
                placeholder="12"
              />
            </div>
            <button className="btn btn-primary" onClick={createBox} disabled={!isRunning}>
              📦 Crear caja
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {BEDROCK_BUTTONS.map((b) => (
              <button
                key={b.sub}
                className={`btn ${b.danger ? "btn-danger" : ""}`}
                onClick={() => runBedrock(b.sub)}
                disabled={!isRunning}
              >
                {b.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div className="input-group" style={{ marginBottom: 0, flex: 1 }}>
              <label>Timer para ganar (segundos)</label>
              <input
                className="input-field"
                type="number"
                value={box.timer}
                onChange={(e) => setBox((p) => ({ ...p, timer: e.target.value }))}
                placeholder="60"
              />
            </div>
            <button className="btn" onClick={applyTimer} disabled={!isRunning || !box.timer}>
              ⏱️ Aplicar
            </button>
          </div>
        </div>
      </div>

      {/* ── 3 · Regalos → Comandos ── */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">3 · Regalos → Comandos</div>
            <div className="panel-subtitle">
              Qué comando dispara cada regalo de TikTok en el servidor
            </div>
          </div>
          <label className="toggle" title="Activar/desactivar todas las acciones">
            <input
              type="checkbox"
              checked={actions.enabled}
              onChange={(e) => setActions((p) => ({ ...p, enabled: e.target.checked }))}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {actions.rules.length === 0 ? (
            <div className="empty-state" style={{ padding: 18 }}>
              <div className="empty-state-text">
                Aún no hay reglas. Añade una para empezar.
              </div>
            </div>
          ) : (
            actions.rules.map((rule, i) => (
              <div
                key={i}
                style={{
                  border: "1px solid rgba(255,255,255,.1)",
                  borderRadius: 12,
                  padding: 12,
                  opacity: rule.enabled === false ? 0.55 : 1,
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <label className="toggle" style={{ flex: "0 0 auto" }}>
                    <input
                      type="checkbox"
                      checked={rule.enabled !== false}
                      onChange={(e) => updateRule(i, { enabled: e.target.checked })}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <input
                    className="input-field"
                    style={{ flex: 1 }}
                    value={rule.giftName || ""}
                    onChange={(e) => updateRule(i, { giftName: e.target.value })}
                    placeholder="Regalo (ej: Rose). Vacío = cualquiera"
                  />
                  <button className="btn btn-danger" onClick={() => removeRule(i)} title="Eliminar regla">
                    ✕
                  </button>
                </div>

                <input
                  className="input-field"
                  style={{ marginBottom: 8, fontFamily: "Consolas, monospace" }}
                  value={rule.command || ""}
                  onChange={(e) => updateRule(i, { command: e.target.value })}
                  placeholder="Comando (ej: bedrock tnt {user})"
                />

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div className="input-group" style={{ marginBottom: 0, flex: "1 1 110px" }}>
                    <label>Mínimo 💎</label>
                    <input
                      className="input-field"
                      type="number"
                      value={rule.minDiamonds ?? 0}
                      onChange={(e) => updateRule(i, { minDiamonds: e.target.value })}
                    />
                  </div>
                  <label className="config-row" style={{ gap: 8, marginBottom: 0 }}>
                    <input
                      type="checkbox"
                      checked={!!rule.repeatPerGift}
                      onChange={(e) => updateRule(i, { repeatPerGift: e.target.checked })}
                    />
                    <span className="config-label">Repetir por cantidad</span>
                  </label>
                  {rule.repeatPerGift ? (
                    <div className="input-group" style={{ marginBottom: 0, flex: "1 1 90px" }}>
                      <label>Máx repeticiones</label>
                      <input
                        className="input-field"
                        type="number"
                        value={rule.maxRepeat ?? 10}
                        onChange={(e) => updateRule(i, { maxRepeat: e.target.value })}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <button className="btn" onClick={addRule}>
            ➕ Añadir regla
          </button>
          <button className="btn btn-primary" onClick={saveActions}>
            💾 Guardar reglas
          </button>
        </div>

        <div className="minecraft-info-card" style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>🎬 Overlay para OBS</div>
          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>
            Añádelo como <b>Browser Source</b> para mostrar en pantalla los regalos
            y cuándo se disparan:
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input-field" readOnly value={OVERLAY_URL} style={{ flex: 1 }} />
            <button className="btn" onClick={copyOverlay}>📋 Copiar</button>
          </div>
        </div>

        {actionsMsg ? (
          <div className="minecraft-validation-ok" style={{ marginTop: 12 }}>{actionsMsg}</div>
        ) : null}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Comandos del Servidor</div>
            <div className="panel-subtitle">
              Envía comandos rápidos o escribe uno manualmente
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {QUICK_COMMANDS.map((item) => (
            <button
              key={item.key}
              className="btn"
              onClick={() => sendCommand(item.command)}
              disabled={!minecraftStatus?.isRunning}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <input
            className="input-field"
            value={minecraftCommand}
            onChange={(e) => setMinecraftCommand(e.target.value)}
            placeholder="say Hola chat"
            disabled={!minecraftStatus?.isRunning}
          />
          <button
            className="btn"
            onClick={() => sendCommand()}
            disabled={!minecraftStatus?.isRunning}
          >
            Enviar
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Consola</div>
            <div className="panel-subtitle">
              Salida en tiempo real del proceso Java del servidor
            </div>
          </div>
        </div>

        <div className="minecraft-console">
          {logs.length > 0 ? (
            logs.map((entry) => (
              <div key={entry.id} className="minecraft-console-line">
                <span className="minecraft-console-time">
                  {new Date(entry.timestamp).toLocaleTimeString("es", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                <span className={`minecraft-console-source ${entry.source}`}>
                  {entry.source}
                </span>
                <span>{entry.line}</span>
              </div>
            ))
          ) : (
            <div className="minecraft-console-line">
              Sin logs todavía. Inicia o valida el servidor para ver actividad.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
