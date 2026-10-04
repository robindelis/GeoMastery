import { contextBridge, ipcRenderer } from 'electron';

// Expose safe desktop APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  saveBackup: (content: string) => ipcRenderer.invoke('save-backup-dialog', content),
  isDesktop: true
});
