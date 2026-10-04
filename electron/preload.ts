import { contextBridge, ipcRenderer } from 'electron';

// Expose safe desktop APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  saveBackup: (content: string) => ipcRenderer.invoke('save-backup-dialog', content),
  loadStorageData: () => ipcRenderer.invoke('load-storage-data'),
  saveStorageData: (data: any) => ipcRenderer.invoke('save-storage-data', data),
  isDesktop: true
});
