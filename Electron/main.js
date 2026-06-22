const { app, BrowserWindow, dialog, session } = require('electron');
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

  backendController = await backendModule.startBackendServer({ port: 3000 });
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

  // Register 'ready-to-show' BEFORE loading content so the event is never missed.
  // Fallback timeout ensures the window shows even if the event somehow doesn't fire.
  const showTimeout = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.warn('⚠️ ready-to-show timeout — forcing window visible');
      mainWindow.show();
    }
  }, 8000);

  mainWindow.once('ready-to-show', () => {
    clearTimeout(showTimeout);
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    clearTimeout(showTimeout);
    mainWindow = null;
  });

  const actualPort = backendController?.port || 3000;

  if (isDev) {
    await mainWindow.loadURL(`http://localhost:5173?backendPort=${actualPort}`);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await mainWindow.loadFile(getResourcePath('frontend-dist', 'index.html'), {
      query: { backendPort: actualPort.toString() }
    });
  }
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

    const actualPort = backendController?.port;
    if (actualPort && actualPort !== 3000) {
      console.log(`🔌 Redirigiendo tráfico interno del puerto 3000 al ${actualPort}...`);
      session.defaultSession.webRequest.onBeforeRequest(
        { urls: ['http://localhost:3000/*', 'ws://localhost:3000/*'] },
        (details, callback) => {
          const newUrl = details.url.replace('localhost:3000', `localhost:${actualPort}`);
          callback({ redirectURL: newUrl });
        }
      );
    }

    await createWindow();
    setupAutoUpdater();
  } catch (error) {
    console.error('❌ No se pudo iniciar StreamSync Desktop:', error);
    dialog.showErrorBox(
      'Error al iniciar StreamSync',
      `${error.message}\n\nOcurrió un error al arrancar la aplicación.`
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
