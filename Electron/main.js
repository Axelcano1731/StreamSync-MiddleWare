const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let backendProcess;

// Detectar si estamos en desarrollo
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
  });

  if (isDev) {
    // 👉 Cargar Vite server en desarrollo
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // 👉 Cargar build en producción
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (backendProcess) backendProcess.kill();
  });
}

function startBackend() {
  backendProcess = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, '../backend'),
    stdio: 'inherit',
    shell: true
  });
}

// Manejo de autoUpdater (solo producción)
function setupAutoUpdater() {
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', () => {
    console.log('⚡ Update disponible. Descargando...');
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('✅ Update descargada. Se aplicará al reiniciar.');
  });

  autoUpdater.on('error', (err) => {
    console.error('❌ Error en autoUpdater:', err);
  });
}

app.on('ready', () => {
  startBackend();
  createWindow();

  if (isDev) {
    mainWindow.webContents.openDevTools(); // Opcional: abre las devtools
  } else {
    setupAutoUpdater(); // 👉 Solo en producción
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    if (backendProcess) backendProcess.kill();
  }
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
