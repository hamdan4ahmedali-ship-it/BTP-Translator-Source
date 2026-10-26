import { contextBridge, ipcRenderer } from 'electron';
import type { AppCommand, ExportRequest, OpenResult, SaveRequest, SaveResult } from '../shared/bridge';

const api = {
  openPython(): Promise<OpenResult> {
    return ipcRenderer.invoke('file:open');
  },
  savePython(request: SaveRequest): Promise<SaveResult> {
    return ipcRenderer.invoke('file:save', request);
  },
  exportJson(request: ExportRequest): Promise<SaveResult> {
    return ipcRenderer.invoke('file:export', request);
  },
  focusWindow(): void {
    ipcRenderer.send('window:focus');
  },
  startupDone(): void {
    ipcRenderer.send('startup:done');
  },
  confirmQuit(): void {
    ipcRenderer.send('app:quit');
  },
  onCommand(handler: (command: AppCommand) => void): () => void {
    const listener = (_event: unknown, command: AppCommand) => handler(command);
    ipcRenderer.on('command', listener);
    return () => ipcRenderer.removeListener('command', listener);
  },
  onSpace(handler: () => void): () => void {
    const listener = () => handler();
    ipcRenderer.on('startup-space', listener);
    return () => ipcRenderer.removeListener('startup-space', listener);
  },
  onCloseRequest(handler: () => void): () => void {
    const listener = () => handler();
    ipcRenderer.on('app-close', listener);
    return () => ipcRenderer.removeListener('app-close', listener);
  },
};

contextBridge.exposeInMainWorld('btp', api);

export type BtpApi = typeof api;
