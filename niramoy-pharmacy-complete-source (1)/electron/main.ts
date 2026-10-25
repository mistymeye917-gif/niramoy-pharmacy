import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { fork, ChildProcess } from 'node:child_process';

// In CommonJS/Electron main, __dirname is globally defined
const appDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const SERVER_URL = `http://127.0.0.1:${PORT}`;

function pingServer(url: string, retries = 30): Promise<boolean> {
  return new Promise((resolve) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const req = http.get(`${url}/api/settings`, (res) => {
        if (res.statusCode === 200 || res.statusCode === 304) {
          clearInterval(interval);
          resolve(true);
        }
      });
      req.on('error', () => {
        if (attempts >= retries) {
          clearInterval(interval);
          resolve(false);
        }
      });
      req.setTimeout(500, () => req.destroy());
    }, 250);
  });
}

function startEmbeddedServer() {
  const isDev = !app.isPackaged && !!process.env.VITE_DEV_SERVER_URL;
  if (isDev) return;

  const serverScript = path.join(app.getAppPath(), 'dist/server.cjs');
  if (fs.existsSync(serverScript)) {
    try {
      serverProcess = fork(serverScript, [], {
        env: {
          ...process.env,
          NODE_ENV: 'production',
          PORT: String(PORT)
        },
        stdio: 'inherit'
      });

      serverProcess.on('error', (err) => {
        console.error('[Electron] Backend server process error:', err);
      });
    } catch (e) {
      console.error('[Electron] Failed to fork backend server:', e);
    }
  }
}

async function createWindow() {
  startEmbeddedServer();

  // Wait for the local server to respond if in standalone mode
  const ready = await pingServer(SERVER_URL, 40);
  if (!ready) {
    console.warn('[Electron] Server took longer than expected to respond, attempting to load anyway.');
  }

  const iconPath = path.join(app.getAppPath(), 'public/favicon.ico');

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'Niramoy Pharmacy Management System',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#0F172A',
    webPreferences: {
      preload: path.join(appDir, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const targetUrl = process.env.VITE_DEV_SERVER_URL || SERVER_URL;
  mainWindow.loadURL(targetUrl);

  const menuTemplate: any[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Create Backup Now',
          click: () => {
            mainWindow?.webContents.send('trigger-backup');
          }
        },
        { type: 'separator' },
        { role: 'quit', label: 'Exit Application' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Niramoy Pharmacy System',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About Niramoy Pharmacy Management',
              message: 'Niramoy Pharmacy Management System v1.0.0',
              detail: 'Professional Offline Retail Pharmacy & POS System for Bangladesh.\nBuilt with Electron, React, TypeScript, and SQLite.\n100% Offline Local Data Persistence with FEFO Inventory & Bilingual Bengali/English Support.'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch (_) {}
    serverProcess = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC communication endpoints
ipcMain.handle('app:version', () => app.getVersion());

ipcMain.handle('dialog:openDirectory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });
  return result.filePaths[0] || null;
});

ipcMain.handle('dialog:selectBackupFile', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'SQLite Pharmacy Backup', extensions: ['sqlite', 'db'] }]
  });
  return result.filePaths[0] || null;
});

ipcMain.handle('print:thermalReceipt', async (event, htmlContent, printerName) => {
  if (!mainWindow) return false;
  const printWin = new BrowserWindow({ show: false });
  await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

  return new Promise((resolve) => {
    printWin.webContents.print({
      silent: true,
      deviceName: printerName || undefined,
      margins: { marginType: 'none' }
    }, (success, failureReason) => {
      printWin.close();
      if (!success) {
        console.error('Print failed:', failureReason);
      }
      resolve(success);
    });
  });
});
