import React, { useEffect, useMemo, useState } from "react";
import socket from "../services/socketService";

const QUICK_COMMANDS = [
  { key: "list", label: "Jugadores", command: "list" },
  { key: "save-all", label: "Guardar", command: "save-all" },
  { key: "time set day", label: "Día", command: "time set day" },
  { key: "weather clear", label: "Clima", command: "weather clear" },
];

function sanitizeMinecraftConfig(config) {
  return {
    ...config,
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

  useEffect(() => {
    socket.emit("getAlertConfig", (cfg) => {
      if (cfg?.minecraft) {
        setConfig((prev) => ({ ...prev, ...cfg.minecraft }));
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
              <label>Ruta del .jar</label>
              <input
                className="input-field"
                value={config.serverJar || ""}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, serverJar: e.target.value }))
                }
                placeholder="C:\\Minecraft\\server.jar"
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Carpeta del servidor</label>
              <input
                className="input-field"
                value={config.serverDirectory || ""}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    serverDirectory: e.target.value,
                  }))
                }
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
