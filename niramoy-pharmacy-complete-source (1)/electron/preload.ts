import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('app:version'),
  selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  selectBackupFile: () => ipcRenderer.invoke('dialog:selectBackupFile'),
  printThermalReceipt: (html: string, printerName?: string) => ipcRenderer.invoke('print:thermalReceipt', html, printerName),
  onTriggerBackup: (callback: () => void) => {
    ipcRenderer.on('trigger-backup', () => callback());
  }
});
