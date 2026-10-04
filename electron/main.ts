import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#060911',
    title: 'GeoMastery — Geography Trainer',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Remove default menu for a clean application feel
  mainWindow.setMenuBarVisibility(false);

  // In dev mode, load Vite dev server; in production load built index.html
  const isDev = process.env.NODE_ENV === 'development';
  const indexPath = path.join(__dirname, '../dist/index.html');

  if (!isDev && fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath);
  } else {
    const devUrl = process.env.ELECTRON_START_URL || 'http://localhost:5173';
    mainWindow.loadURL(devUrl);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC: Native File Save Dialog for Backups
ipcMain.handle('save-backup-dialog', async (_event, content: string) => {
  if (!mainWindow) return { success: false };
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save GeoMastery Backup',
    defaultPath: `geomastery-backup-${new Date().toISOString().split('T')[0]}.json`,
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });

  if (filePath) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true, filePath };
  }
  return { success: false, canceled: true };
});

// IPC: Robust Atomic Disk Storage for User Progress
ipcMain.handle('load-storage-data', async () => {
  try {
    const dataFilePath = path.join(app.getPath('userData'), 'geomastery_data.json');
    if (fs.existsSync(dataFilePath)) {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      return { success: true, data: JSON.parse(content) };
    }
  } catch (err) {
    console.error('Failed to load storage data from disk:', err);
  }
  return { success: false };
});

ipcMain.handle('save-storage-data', async (_event, dataObj: any) => {
  try {
    const userData = app.getPath('userData');
    if (!fs.existsSync(userData)) {
      fs.mkdirSync(userData, { recursive: true });
    }
    const dataFilePath = path.join(userData, 'geomastery_data.json');
    const tmpPath = `${dataFilePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(dataObj, null, 2), 'utf-8');
    fs.renameSync(tmpPath, dataFilePath);
    return { success: true };
  } catch (err) {
    console.error('Failed to save storage data to disk:', err);
    return { success: false, error: String(err) };
  }
});

// Single-instance lock: Prevents LevelDB corruption or locked storage from multiple instances
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

