import { contextBridge, ipcRenderer } from 'electron';

// Expose safe desktop APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  saveBackup: (content: string) => ipcRenderer.invoke('save-backup-dialog', content),
  loadStorageData: () => ipcRenderer.invoke('load-storage-data'),
  saveStorageData: (data: any) => ipcRenderer.invoke('save-storage-data', data),
  syncGitHubProgress: (data: any) => ipcRenderer.invoke('sync-github-progress', data),
  getGeminiKey: () => ipcRenderer.invoke('get-gemini-key'),
  isDesktop: true
});
