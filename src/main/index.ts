import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { registerInstallHandlers } from './ipc/install-router';
import { registerPlatformHandlers } from './ipc/platform-router';
import * as diagnosticsRouter from './ipc/diagnostics-router';
import {
  registerRuntimeHandlers,
  setMainWindow as setRuntimeMainWindow,
  initializeRuntimeHistoryTracking,
} from './ipc/runtime-router';
import * as securityRouter from './ipc/security-router';
import { installOrchestrator } from './install/install-orchestrator';

const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const shouldOpenDevTools = process.env.ELECTRON_OPEN_DEVTOOLS === '1';
const devLoadRetryMs = 700;
const devLoadMaxAttempts = 35;
let handlersRegistered = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadDevServerWithRetry(
  mainWindow: BrowserWindow,
  url: string
): Promise<void> {
  for (let attempt = 1; attempt <= devLoadMaxAttempts; attempt++) {
    try {
      await mainWindow.loadURL(url);
      console.info(`[secureclaw] Connected to dev server on attempt ${attempt}`);
      return;
    } catch (error) {
      console.warn(
        `[secureclaw] Dev server not ready (attempt ${attempt}/${devLoadMaxAttempts})`,
        error
      );
      await sleep(devLoadRetryMs);
    }
  }

  const fallbackHtml = `
    <html>
      <body style="font-family: -apple-system, sans-serif; padding: 24px;">
        <h2>SecureClaw Dev Server Unavailable</h2>
        <p>Could not connect to <code>${url}</code>.</p>
        <p>Start renderer with <code>npm run dev:renderer</code>, then relaunch <code>npm run dev:desktop</code>.</p>
      </body>
    </html>
  `;
  await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fallbackHtml)}`);
}

function registerIpcHandlers(mainWindow: BrowserWindow): void {
  if (handlersRegistered) {
    setRuntimeMainWindow(mainWindow);
    installOrchestrator.setWindow(mainWindow);
    return;
  }

  registerPlatformHandlers(ipcMain);
  registerRuntimeHandlers(ipcMain);
  diagnosticsRouter.registerDiagnosticsHandlers(ipcMain);
  securityRouter.registerSecurityHandlers(ipcMain);
  registerInstallHandlers(ipcMain, mainWindow);
  initializeRuntimeHistoryTracking();
  setRuntimeMainWindow(mainWindow);
  handlersRegistered = true;
}

async function createMainWindow(): Promise<BrowserWindow> {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('[secureclaw] Preload error:', preloadPath, error);
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, url) => {
    console.error('[secureclaw] Renderer failed to load:', {
      errorCode,
      errorDescription,
      url,
    });
  });

  registerIpcHandlers(mainWindow);

  if (devServerUrl) {
    await loadDevServerWithRetry(mainWindow, devServerUrl);
    if (shouldOpenDevTools) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Show immediately after load completes. In dev, `ready-to-show` can be delayed by
  // tooling/hot-reload state, which makes the app appear blank or hidden.
  mainWindow.show();

  return mainWindow;
}

app.whenReady().then(async () => {
  await createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
