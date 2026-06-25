import fs from 'fs';
import os from 'os';
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

const SUPPORTED_VERSIONS = new Set(['1.20', '1.21']);
const DEFAULT_VERSION = '1.21';

function normalizeVersion(version) {
  const safeVersion = String(version || DEFAULT_VERSION).trim();
  return SUPPORTED_VERSIONS.has(safeVersion) ? safeVersion : DEFAULT_VERSION;
}

/**
 * Misma carpeta base que muestra TLauncher: %APPDATA%\.minecraft
 * (no confundir con el servidor dedicado: ahí va un server.jar aparte).
 */
export function getRoamingMinecraftRoot() {
  if (process.platform === 'win32' && process.env.APPDATA) {
    return path.join(process.env.APPDATA, '.minecraft');
  }
  return path.join(os.homedir(), '.minecraft');
}

function inferPathsFromVersion(version) {
  const normalizedVersion = normalizeVersion(version);
  const base = path.join(getRoamingMinecraftRoot(), 'minecraft-server', normalizedVersion);

  return {
    version: normalizedVersion,
    serverDirectory: base,
    serverJar: path.join(base, 'server.jar'),
  };
}

const SKIP_MINECRAFT_WALK_DIRS = new Set([
  'assets',
  'libraries',
  'runtime',
  'webcache',
  'downloads',
  'logs',
  'screenshots',
  'saves',
  'resourcepacks',
  'shaderpacks',
  'mods',
  'config',
  'defaultconfigs',
  'versions',
  'launcher_profiles',
  'cache',
  'accounts',
  'quickplay',
  'icons',
  'plugins',
  'backup',
  'crash-reports',
  'server-resource-packs',
  'native',
  'bin',
]);

function shouldSkipWalkDir(name) {
  const lower = name.toLowerCase();
  if (SKIP_MINECRAFT_WALK_DIRS.has(lower)) return true;
  if (lower.startsWith('.')) return true; // .paper-remapped, .fabric, etc.
  if (lower.startsWith('world')) return true; // world, world_nether, world_oneblock...
  if (lower.startsWith('jdk') || lower.startsWith('jre')) return true;
  return false;
}

// Nombres típicos del .jar de arranque de un servidor (vanilla y forks).
// Los .jar de plugins/mods NO matchean y además viven en carpetas que saltamos.
const SERVER_JAR_PATTERNS = [
  { re: /^server\.jar$/i, score: 100 },
  { re: /^(paper|purpur|folia|pufferfish)[-_].*\.jar$/i, score: 90 },
  { re: /^(spigot|craftbukkit)[-_].*\.jar$/i, score: 85 },
  { re: /^fabric-server[-_].*\.jar$/i, score: 85 },
  { re: /^(forge|neoforge)[-_].*\.jar$/i, score: 80 },
  { re: /^minecraft_server.*\.jar$/i, score: 80 },
  { re: /.*-server\.jar$/i, score: 60 },
];

function matchServerJarScore(fileName) {
  for (const { re, score } of SERVER_JAR_PATTERNS) {
    if (re.test(fileName)) return score;
  }
  return 0;
}

function scoreServerJarCandidate(roamingRoot, jarPath, version) {
  const nameScore = matchServerJarScore(path.basename(jarPath));
  if (nameScore === 0) return 0;
  const dir = path.dirname(jarPath);
  const rel = path.relative(roamingRoot, dir).toLowerCase();
  let s = nameScore;
  if (rel === 'minecraftserver') s += 30; // raíz del servidor de TLauncher
  else if (rel.includes('minecraftserver')) s += 10;
  if (rel.includes('minecraft-server')) s += 8;
  if (rel === '') s += 2;
  if (rel.includes(version.toLowerCase())) s += 5;
  // El jar de arranque está en la raíz del servidor, no dentro de versions/ ni cache/.
  if (rel.includes('versions') || rel.includes('cache')) s -= 20;
  return s;
}

function pickBestServerJarInDir(roamingRoot, dir, version) {
  if (!fs.existsSync(dir)) return null;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  const acc = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.toLowerCase().endsWith('.jar')) continue;
    const jarPath = path.join(dir, e.name);
    const score = scoreServerJarCandidate(roamingRoot, jarPath, version);
    if (score > 0) acc.push({ jarPath, score });
  }
  if (acc.length === 0) return null;
  acc.sort((a, b) => b.score - a.score);
  return acc[0].jarPath;
}

function collectServerJars(roamingRoot, dir, version, depth, maxDepth, acc) {
  if (depth > maxDepth || !fs.existsSync(dir)) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (!e.isFile() || !e.name.toLowerCase().endsWith('.jar')) continue;
    const jarPath = path.join(dir, e.name);
    const score = scoreServerJarCandidate(roamingRoot, jarPath, version);
    if (score > 0) acc.push({ jarPath, score });
  }
  if (depth >= maxDepth) return;
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (shouldSkipWalkDir(e.name)) continue;
    collectServerJars(roamingRoot, path.join(dir, e.name), version, depth + 1, maxDepth, acc);
  }
}

/**
 * Busca el .jar de arranque del servidor bajo la carpeta del cliente (.minecraft).
 * Soporta el servidor que crea TLauncher en `.minecraft\minecraftServer` y forks
 * con nombres como `paper-1.21-118.jar`, no solo `server.jar`.
 */
export function findServerJarUnderMinecraftRoot(roamingRoot, version) {
  const normalizedVersion = normalizeVersion(version);
  // 1) Carpetas de servidor más habituales: elige el mejor jar de cada una.
  const serverDirs = [
    path.join(roamingRoot, 'minecraftServer'), // TLauncher
    path.join(roamingRoot, 'minecraft-server', normalizedVersion),
    path.join(roamingRoot, 'servers', normalizedVersion),
    path.join(roamingRoot, normalizedVersion),
    path.join(roamingRoot, 'server'),
  ];
  for (const dir of serverDirs) {
    const jar = pickBestServerJarInDir(roamingRoot, dir, normalizedVersion);
    if (jar) return jar;
  }
  // 2) Búsqueda recursiva con puntuación como último recurso.
  const acc = [];
  collectServerJars(roamingRoot, roamingRoot, normalizedVersion, 0, 6, acc);
  if (acc.length === 0) return null;
  acc.sort((a, b) => b.score - a.score);
  return acc[0].jarPath;
}

/**
 * JDK incluido junto al servidor (p. ej. `minecraftServer\jdk-21...\bin\java.exe`).
 * TLauncher trae su propio Java; usarlo evita fallos por la versión de Java del sistema.
 */
function findBundledJava(serverDir) {
  if (!serverDir || !fs.existsSync(serverDir)) return null;
  const exe = process.platform === 'win32' ? 'java.exe' : 'java';
  let entries;
  try {
    entries = fs.readdirSync(serverDir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (!/^(jdk|jre|java|runtime)/i.test(e.name)) continue;
    const candidate = path.join(serverDir, e.name, 'bin', exe);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function resolveAutoPaths(config) {
  const normalizedVersion = normalizeVersion(config.minecraftVersion);
  const defaults = inferPathsFromVersion(normalizedVersion);
  const roaming = getRoamingMinecraftRoot();
  const resolved = {
    ...config,
    minecraftVersion: normalizedVersion,
  };

  const hasServerDir = Boolean(resolved.serverDirectory && String(resolved.serverDirectory).trim());
  const hasServerJar = Boolean(resolved.serverJar && String(resolved.serverJar).trim());

  if (!hasServerDir && !hasServerJar) {
    resolved.serverDirectory = defaults.serverDirectory;
    resolved.serverJar = defaults.serverJar;
  } else if (!hasServerDir && hasServerJar) {
    resolved.serverDirectory = path.dirname(resolved.serverJar);
  } else if (hasServerDir && !hasServerJar) {
    const dir = path.resolve(resolved.serverDirectory);
    resolved.serverDirectory = dir;
    const candidateJar = path.join(dir, 'server.jar');
    if (fs.existsSync(candidateJar)) {
      resolved.serverJar = candidateJar;
    } else {
      const found = findServerJarUnderMinecraftRoot(roaming, normalizedVersion);
      if (found) {
        resolved.serverJar = found;
        resolved.serverDirectory = path.dirname(found);
      } else {
        resolved.serverJar = path.join(dir, 'server.jar');
      }
    }
  }

  if (resolved.serverJar) {
    resolved.serverJar = path.resolve(resolved.serverJar);
  }
  if (resolved.serverDirectory) {
    resolved.serverDirectory = path.resolve(resolved.serverDirectory);
  }

  if (resolved.serverJar && !fs.existsSync(resolved.serverJar)) {
    const found = findServerJarUnderMinecraftRoot(roaming, normalizedVersion);
    if (found) {
      resolved.serverJar = path.resolve(found);
      resolved.serverDirectory = path.dirname(resolved.serverJar);
    }
  }

  if (resolved.serverDirectory && !resolved.serverJar) {
    const candidateJar = path.join(resolved.serverDirectory, 'server.jar');
    resolved.serverJar = fs.existsSync(candidateJar) ? candidateJar : path.resolve(defaults.serverJar);
  }

  // Java: si no se indicó uno propio, usa el JDK que TLauncher trae junto al
  // servidor (la versión correcta) antes de caer al `java` del sistema.
  if (!resolved.javaPath || String(resolved.javaPath).trim() === 'java') {
    resolved.javaPath = findBundledJava(resolved.serverDirectory) || 'java';
  }

  return resolved;
}

function getEffectiveConfig(overrides = {}) {
  const stored = getConfig().minecraft || {};
  const merged = resolveAutoPaths({ ...stored, ...overrides });

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

  const roamingRoot = getRoamingMinecraftRoot();
  const suggestedDir = path.join(roamingRoot, 'minecraft-server', config.minecraftVersion || DEFAULT_VERSION);

  if (!hasServerJar) {
    issues.push('Falta la ruta del archivo .jar del servidor.');
  } else if (!serverJarExists) {
    issues.push(`No se encontró el .jar en ${config.serverJar}.`);
    if (fs.existsSync(roamingRoot)) {
      issues.push(
        'TLauncher apunta a la carpeta del cliente (.minecraft). El servidor dedicado usa otro archivo: descarga `server.jar` oficial para tu versión y colócalo, por ejemplo, en: ' +
          suggestedDir
      );
    }
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
    throw new Error('No se pudo resolver la ruta del .jar del servidor de Minecraft');
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

export function getSuggestedMinecraftPaths(version) {
  const v = normalizeVersion(version);
  const d = inferPathsFromVersion(v);
  return {
    minecraftVersion: v,
    serverDirectory: d.serverDirectory,
    serverJar: d.serverJar,
    roamingMinecraftRoot: getRoamingMinecraftRoot(),
  };
}
