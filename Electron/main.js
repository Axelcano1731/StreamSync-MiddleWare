const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let backendController = null;
let updateInterval = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function getResourcePath(...segments) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...segments);
  }

  return path.join(__dirname, '..', ...segments);
}

async function startBackend() {
  const backendEntry = getResourcePath('Backend', 'Server.js');
  const backendModule = await import(pathToFileURL(backendEntry).href);

  backendController = backendModule;
  await backendModule.startBackendServer({ port: 3000 });
}

async function stopBackend() {
  if (backendController?.stopBackendServer) {
    try {
      await backendController.stopBackendServer();
    } catch (error) {
      console.error('❌ Error cerrando el backend:', error);
    }
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    title: 'StreamSync',
    backgroundColor: '#0f0f14',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await mainWindow.loadFile(getResourcePath('frontend-dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupAutoUpdater() {
  if (isDev) {
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('🔎 Buscando actualizaciones...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log(`⚡ Update disponible: ${info.version}`);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('✅ Ya estás en la versión más reciente');
  });

  autoUpdater.on('error', (error) => {
    console.error('❌ Error en autoUpdater:', error);
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`⬇️ Descargando update: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Reiniciar ahora', 'Después'],
      defaultId: 0,
      cancelId: 1,
      title: 'Actualización lista',
      message: `La versión ${info.version} ya se descargó.`,
      detail: 'StreamSync puede reiniciarse ahora para instalar la actualización.',
    });

    if (response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.checkForUpdatesAndNotify();

  clearInterval(updateInterval);
  updateInterval = setInterval(() => {
    autoUpdater.checkForUpdates().catch((error) => {
      console.error('❌ No se pudo verificar actualizaciones:', error);
    });
  }, 1000 * 60 * 30);
}

async function initializeApp() {
  try {
    await startBackend();
    await createWindow();
    setupAutoUpdater();
  } catch (error) {
    console.error('❌ No se pudo iniciar StreamSync Desktop:', error);
    dialog.showErrorBox(
      'Error al iniciar StreamSync',
      `${error.message}\n\nRevisa que el frontend esté compilado y que el puerto 3000 esté libre.`
    );
    app.quit();
  }
}

app.whenReady().then(initializeApp);

app.on('window-all-closed', async () => {
  clearInterval(updateInterval);

  if (process.platform !== 'darwin') {
    await stopBackend();
    app.quit();
  }
});

app.on('before-quit', async () => {
  clearInterval(updateInterval);
  await stopBackend();
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});
