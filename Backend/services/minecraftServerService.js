import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { getConfig } from '../config/alertConfig.js';

const minecraftEmitter = new EventEmitter();
const MAX_LOG_LINES = 250;

let minecraftProcess = null;
let promoteToRunningTimeout = null;
let forceKillTimeout = null;

let runtimeState = {
  status: 'stopped',
  startedAt: null,
  pid: null,
  lastExitCode: null,
  lastError: null,
  logs: [],
};

function getEffectiveConfig(overrides = {}) {
  const stored = getConfig().minecraft || {};
  const merged = { ...stored, ...overrides };

  if (merged.serverJar) {
    merged.serverJar = path.resolve(merged.serverJar);
  }

  if (merged.serverDirectory) {
    merged.serverDirectory = path.resolve(merged.serverDirectory);
  } else if (merged.serverJar) {
    merged.serverDirectory = path.dirname(merged.serverJar);
  }

  return merged;
}

function emitStatus() {
  minecraftEmitter.emit('status', getMinecraftStatus());
}

function appendLog(source, chunk) {
  const lines = String(chunk || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);

  if (lines.length === 0) {
    return;
  }

  const timestamp = Date.now();

  for (const line of lines) {
    runtimeState.logs.push({
      id: `${timestamp}_${runtimeState.logs.length}_${source}`,
      timestamp,
      source,
      line,
    });
  }

  if (runtimeState.logs.length > MAX_LOG_LINES) {
    runtimeState.logs = runtimeState.logs.slice(-MAX_LOG_LINES);
  }

  minecraftEmitter.emit('log', runtimeState.logs[runtimeState.logs.length - 1]);
}

function markRunningSoon() {
  clearTimeout(promoteToRunningTimeout);
  promoteToRunningTimeout = setTimeout(() => {
    if (minecraftProcess && runtimeState.status === 'starting') {
      runtimeState.status = 'running';
      emitStatus();
    }
  }, 1200);
}

function clearTimers() {
  clearTimeout(promoteToRunningTimeout);
  clearTimeout(forceKillTimeout);
  promoteToRunningTimeout = null;
  forceKillTimeout = null;
}

function parseStartupArgs(extraArgs = '') {
  return String(extraArgs || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function runProcess(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      ...options,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timeoutMs = options.timeoutMs || 8000;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error('Timeout'));
    }, timeoutMs);

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });

    child.once('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
}

function setStoppedState(code, signal) {
  appendLog(
    'system',
    signal
      ? `Servidor detenido por señal ${signal}`
      : `Servidor detenido con codigo ${code ?? 0}`
  );

  runtimeState = {
    ...runtimeState,
    status: 'stopped',
    startedAt: null,
    pid: null,
    lastExitCode: code,
    lastError: signal ? `Signal: ${signal}` : runtimeState.lastError,
  };

  minecraftProcess = null;
  clearTimers();
  emitStatus();
}

export function getMinecraftStatus() {
  const config = getEffectiveConfig();
  const port = config.port || 25565;

  return {
    ...runtimeState,
    address: `localhost:${port}`,
    isRunning: ['starting', 'running', 'stopping'].includes(runtimeState.status),
    config,
  };
}

export async function validateMinecraftConfig(overrides = {}) {
  const config = getEffectiveConfig(overrides);
  const issues = [];

  const hasServerJar = Boolean(config.serverJar);
  const serverJarExists = hasServerJar && fs.existsSync(config.serverJar);
  const hasServerDirectory = Boolean(config.serverDirectory);
  const serverDirectoryExists = hasServerDirectory && fs.existsSync(config.serverDirectory);
  const eulaPath = hasServerDirectory ? path.join(config.serverDirectory, 'eula.txt') : null;
  const eulaExists = Boolean(eulaPath && fs.existsSync(eulaPath));

  if (!hasServerJar) {
    issues.push('Falta la ruta del archivo .jar del servidor.');
  } else if (!serverJarExists) {
    issues.push(`No se encontró el .jar en ${config.serverJar}.`);
  }

  if (!hasServerDirectory) {
    issues.push('Falta la carpeta del servidor.');
  } else if (!serverDirectoryExists) {
    issues.push(`No se encontró la carpeta ${config.serverDirectory}.`);
  }

  if ((config.minMemoryMb || 0) > (config.maxMemoryMb || 0)) {
    issues.push('La memoria mínima no puede ser mayor que la máxima.');
  }

  let javaOk = false;
  let javaVersion = null;
  let javaError = null;

  try {
    const javaResult = await runProcess(config.javaPath || 'java', ['-version']);
    javaOk = javaResult.code === 0 || Boolean(javaResult.stderr || javaResult.stdout);
    javaVersion = javaResult.stderr.split('\n')[0] || javaResult.stdout.split('\n')[0] || null;
  } catch (error) {
    javaError = error.message;
    issues.push(`No se pudo ejecutar Java con "${config.javaPath || 'java'}".`);
  }

  return {
    ok: issues.length === 0 && javaOk,
    issues,
    checks: {
      javaOk,
      javaVersion,
      javaError,
      hasServerJar,
      serverJarExists,
      hasServerDirectory,
      serverDirectoryExists,
      eulaExists,
      autoAcceptEula: Boolean(config.autoAcceptEula),
      address: `localhost:${config.port || 25565}`,
    },
    config,
  };
}

export async function startMinecraftServer(overrides = {}) {
  if (minecraftProcess) {
    return getMinecraftStatus();
  }

  const config = getEffectiveConfig(overrides);

  if (!config.serverJar) {
    throw new Error('Configura la ruta del archivo .jar del servidor de Minecraft');
  }

  if (!fs.existsSync(config.serverJar)) {
    throw new Error(`No se encontro el archivo del servidor: ${config.serverJar}`);
  }

  if (!config.serverDirectory || !fs.existsSync(config.serverDirectory)) {
    throw new Error('La carpeta del servidor de Minecraft no existe');
  }

  if (config.autoAcceptEula) {
    fs.writeFileSync(path.join(config.serverDirectory, 'eula.txt'), 'eula=true\n', 'utf-8');
  }

  const javaPath = config.javaPath || 'java';
  const jarArg =
    path.dirname(config.serverJar) === config.serverDirectory
      ? path.basename(config.serverJar)
      : config.serverJar;

  const args = [
    `-Xms${config.minMemoryMb || 1024}M`,
    `-Xmx${config.maxMemoryMb || 2048}M`,
    ...parseStartupArgs(config.startupArgs),
    '-jar',
    jarArg,
    'nogui',
  ];

  runtimeState = {
    ...runtimeState,
    status: 'starting',
    startedAt: Date.now(),
    pid: null,
    lastExitCode: null,
    lastError: null,
  };

  appendLog('system', `Iniciando servidor de Minecraft con ${path.basename(config.serverJar)}`);

  minecraftProcess = spawn(javaPath, args, {
    cwd: config.serverDirectory,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  runtimeState.pid = minecraftProcess.pid || null;
  emitStatus();

  return new Promise((resolve, reject) => {
    let settled = false;

    minecraftProcess.stdout.on('data', (data) => {
      appendLog('stdout', data.toString());
    });

    minecraftProcess.stderr.on('data', (data) => {
      appendLog('stderr', data.toString());
    });

    minecraftProcess.once('spawn', () => {
      markRunningSoon();
      if (!settled) {
        settled = true;
        resolve(getMinecraftStatus());
      }
    });

    minecraftProcess.on('error', (error) => {
      runtimeState = {
        ...runtimeState,
        status: 'error',
        lastError: error.message,
        pid: null,
      };

      appendLog('stderr', error.message);
      minecraftProcess = null;
      clearTimers();
      emitStatus();

      if (!settled) {
        settled = true;
        reject(error);
      }
    });

    minecraftProcess.on('exit', (code, signal) => {
      setStoppedState(code, signal);

      if (!settled && code && code !== 0) {
        settled = true;
        reject(new Error(`El servidor se cerro al iniciar con codigo ${code}`));
      }
    });
  });
}

export async function stopMinecraftServer() {
  if (!minecraftProcess) {
    return getMinecraftStatus();
  }

  runtimeState.status = 'stopping';
  appendLog('system', 'Enviando comando stop al servidor...');
  emitStatus();

  if (minecraftProcess.stdin?.writable) {
    minecraftProcess.stdin.write('stop\n');
  } else {
    minecraftProcess.kill();
  }

  clearTimeout(forceKillTimeout);
  forceKillTimeout = setTimeout(() => {
    if (minecraftProcess) {
      appendLog('system', 'Forzando cierre del servidor de Minecraft');
      minecraftProcess.kill();
    }
  }, 15000);

  return getMinecraftStatus();
}

export async function sendMinecraftCommand(command) {
  const safeCommand = String(command || '').trim();

  if (!safeCommand) {
    throw new Error('Escribe un comando antes de enviarlo');
  }

  if (!minecraftProcess || !minecraftProcess.stdin?.writable) {
    throw new Error('El servidor de Minecraft no esta en ejecucion');
  }

  minecraftProcess.stdin.write(`${safeCommand}\n`);
  appendLog('command', `> ${safeCommand}`);
  return getMinecraftStatus();
}

export function getMinecraftEmitter() {
  return minecraftEmitter;
}
