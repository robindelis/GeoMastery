import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);

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
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Remove default menu for a clean application feel
  mainWindow.setMenuBarVisibility(false);

  // In dev mode, load Vite dev server; in production load built index.html
  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
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

// IPC: Read Gemini API key from local environment / .env file
ipcMain.handle('get-gemini-key', async () => {
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8').trim();
      const match = content.match(/^(?:(?:VITE_)?GEMINI_API_KEY=)?\s*(.+)$/m);
      if (match && match[1]) {
        return match[1].trim();
      }
      return content;
    }
  } catch (err) {
    console.error('Failed to read .env for Gemini key:', err);
  }
  return process.env.GEMINI_API_KEY || '';
});

// IPC: Robust Atomic Disk Storage for User Progress with Automated Safeguard Backup
ipcMain.handle('load-storage-data', async () => {
  const userData = app.getPath('userData');
  const dataFilePath = path.join(userData, 'geomastery_data.json');
  const backupFilePath = path.join(userData, 'user_progress_backup.json');

  try {
    if (fs.existsSync(dataFilePath)) {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      return { success: true, data: JSON.parse(content) };
    }
  } catch (err) {
    console.error('Failed to load primary storage data from disk, checking backup:', err);
  }

  // Fallback to verified backup copy if primary was corrupt or missing
  try {
    if (fs.existsSync(backupFilePath)) {
      const content = fs.readFileSync(backupFilePath, 'utf-8');
      return { success: true, data: JSON.parse(content), recoveredFromBackup: true };
    }
  } catch (backupErr) {
    console.error('Failed to load backup storage data from disk:', backupErr);
  }

  return { success: false };
});

function sanitizeCloudPayload(dataObj: any) {
  const sanitized = {
    ...dataObj,
    settings: dataObj?.settings
      ? {
          ...dataObj.settings,
          geminiApiKey: '',
          githubSyncToken: ''
        }
      : undefined
  };
  return sanitized;
}

ipcMain.handle('save-storage-data', async (_event, dataObj: any) => {
  try {
    const userData = app.getPath('userData');
    if (!fs.existsSync(userData)) {
      fs.mkdirSync(userData, { recursive: true });
    }
    const dataFilePath = path.join(userData, 'geomastery_data.json');
    const backupFilePath = path.join(userData, 'user_progress_backup.json');
    const tmpPath = `${dataFilePath}.tmp`;

    const serialized = JSON.stringify(dataObj, null, 2);
    fs.writeFileSync(tmpPath, serialized, 'utf-8');
    fs.renameSync(tmpPath, dataFilePath);

    // Automated safeguard backup (Rule 5): keep secondary verified copy when data has progress
    const hasProgress =
      (Array.isArray(dataObj?.srsItems) && dataObj.srsItems.length > 0) ||
      (dataObj?.stats && dataObj.stats.totalReviews > 0);

    if (hasProgress) {
      const backupTmpPath = `${backupFilePath}.tmp`;
      fs.writeFileSync(backupTmpPath, serialized, 'utf-8');
      fs.renameSync(backupTmpPath, backupFilePath);
    }

    return { success: true };
  } catch (err) {
    console.error('Failed to save storage data to disk:', err);
    return { success: false, error: String(err) };
  }
});

// IPC: Two-Way GitHub Cloud Progress Push from Desktop
ipcMain.handle('sync-github-progress', async (_event, dataObj: any) => {
  try {
    const repoDir = process.cwd();
    const repoCloudPath = path.join(repoDir, 'public', 'cloud-progress.json');
    if (!fs.existsSync(path.dirname(repoCloudPath))) {
      return { success: false, message: 'public/ directory not found in workspace' };
    }

    // Fetch & rebase any remote commits pushed from Phone first so git push never conflicts
    try {
      await execFileAsync('git', ['pull', '--rebase', '--autostash', '-X', 'theirs', 'origin', 'main'], {
        cwd: repoDir
      });
    } catch {
      // Ignore if offline or nothing to rebase
    }

    const sanitized = sanitizeCloudPayload(dataObj);
    const cloudTmp = `${repoCloudPath}.tmp`;
    fs.writeFileSync(cloudTmp, JSON.stringify(sanitized, null, 2), 'utf-8');
    fs.renameSync(cloudTmp, repoCloudPath);

    await execFileAsync('git', ['add', 'public/cloud-progress.json'], { cwd: repoDir });
    const { stdout: statusOut } = await execFileAsync('git', ['status', '--porcelain', 'public/cloud-progress.json'], {
      cwd: repoDir
    });

    if (statusOut.trim().length > 0) {
      await execFileAsync('git', ['commit', '-m', 'Sync user progression data'], { cwd: repoDir });
      await execFileAsync('git', ['push', 'origin', 'main'], { cwd: repoDir });
      return { success: true, pushed: true, message: 'Pushed latest progress to GitHub!' };
    }

    return { success: true, pushed: false, message: 'GitHub is already up to date.' };
  } catch (err) {
    console.error('Failed to push cloud progress to GitHub:', err);
    return { success: false, pushed: false, message: String(err) };
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

