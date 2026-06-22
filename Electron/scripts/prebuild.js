/**
 * prebuild.js — Prepare a clean, lightweight Backend for Electron packaging.
 *
 * Instead of letting electron-builder copy the entire Backend directory
 * (which follows the `streamsync: file:..` symlink and recursively copies
 * the whole project), this script:
 *
 * 1. Creates a clean staging directory (.build-staging/Backend)
 * 2. Copies ONLY the necessary Backend source files
 * 3. Runs `npm install --omit=dev` for minimal production dependencies
 *
 * Result: ~30 MB instead of ~500 MB+
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_SRC = path.join(ROOT, 'Backend');
const STAGING = path.join(__dirname, '..', '.build-staging', 'Backend');

// Directories / files to copy from Backend (relative to Backend/)
const COPY_LIST = [
  'Server.js',
  'package.json',
  'package-lock.json',
  'config',
  'controllers',
  'data',
  'overlay',
  'routes',
  'services',
  'socket',
  'sounds',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function rimraf(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('🔧 Prebuild: preparando Backend ligero para empaquetado...');
const startTime = Date.now();

// 1. Clean previous staging
rimraf(STAGING);
fs.mkdirSync(STAGING, { recursive: true });

// 2. Copy only necessary source files
let copiedFiles = 0;
for (const item of COPY_LIST) {
  const src = path.join(BACKEND_SRC, item);
  const dest = path.join(STAGING, item);

  if (!fs.existsSync(src)) {
    console.log(`   ⚠️  Saltando ${item} (no existe)`);
    continue;
  }

  copyRecursive(src, dest);
  copiedFiles++;
}

console.log(`   ✅ ${copiedFiles} archivos/directorios copiados`);

// 3. Install production-only dependencies
console.log('   📦 Instalando dependencias de producción...');
execSync('npm install --omit=dev --ignore-scripts', {
  cwd: STAGING,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
});

// 4. Clean unnecessary files from node_modules to reduce size further
const CLEANUP_PATTERNS = [
  '**/README.md',
  '**/README',
  '**/CHANGELOG.md',
  '**/CHANGES.md',
  '**/HISTORY.md',
  '**/LICENSE',
  '**/LICENSE.md',
  '**/LICENSE.txt',
  '**/.npmignore',
  '**/.eslintrc*',
  '**/.prettierrc*',
  '**/tsconfig.json',
  '**/*.d.ts',
  '**/*.map',
  '**/*.ts',
  '!**/*.d.cts',
];

function cleanNodeModules(dir) {
  let cleaned = 0;

  function walk(current) {
    if (!fs.existsSync(current)) return;
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        // Remove test/docs directories
        if (['test', 'tests', '__tests__', 'docs', 'doc', 'example', 'examples', '.github'].includes(entry.name)) {
          rimraf(fullPath);
          cleaned++;
          continue;
        }
        walk(fullPath);
      } else {
        // Remove unnecessary files
        const lower = entry.name.toLowerCase();
        if (
          lower === 'readme.md' ||
          lower === 'readme' ||
          lower === 'changelog.md' ||
          lower === 'changes.md' ||
          lower === 'history.md' ||
          lower === 'license' ||
          lower === 'license.md' ||
          lower === 'license.txt' ||
          lower === '.npmignore' ||
          lower === '.eslintrc.js' ||
          lower === '.eslintrc.json' ||
          lower === 'tsconfig.json' ||
          lower === 'makefile' ||
          lower.endsWith('.map') ||
          lower.endsWith('.d.ts')
        ) {
          fs.unlinkSync(fullPath);
          cleaned++;
        }
      }
    }
  }

  walk(dir);
  return cleaned;
}

const nmPath = path.join(STAGING, 'node_modules');
if (fs.existsSync(nmPath)) {
  const cleaned = cleanNodeModules(nmPath);
  console.log(`   🧹 ${cleaned} archivos/carpetas innecesarios eliminados`);
}

// 5. Report final size
function getDirSize(dir) {
  let size = 0;
  if (!fs.existsSync(dir)) return 0;

  function walk(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        size += fs.statSync(full).size;
      }
    }
  }

  walk(dir);
  return size;
}

const sizeMB = (getDirSize(STAGING) / 1024 / 1024).toFixed(1);
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

console.log(`\n✅ Prebuild completado en ${elapsed}s — Backend staging: ${sizeMB} MB`);
