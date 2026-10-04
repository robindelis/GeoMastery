/// <reference types="vite/client" />

declare module '*.json' {
  const value: any;
  export default value;
}

interface Window {
  electronAPI?: {
    saveBackup: (content: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean }>;
    loadStorageData: () => Promise<{ success: boolean; data?: any }>;
    saveStorageData: (data: any) => Promise<{ success: boolean; error?: string }>;
    isDesktop?: boolean;
  };
}

