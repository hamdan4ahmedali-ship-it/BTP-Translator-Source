import { app, BrowserWindow, Menu, dialog, ipcMain, nativeTheme } from 'electron';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { AppCommand, ExportRequest, OpenResult, SaveRequest, SaveResult } from '../shared/bridge';
import { safeFileName, validatePythonContent } from '../shared/files';
import { APP_NAME } from '../shared/version';

nativeTheme.themeSource = 'dark';

let windowRef: BrowserWindow | null = null;
let allowClose = false;
let menuReady = false;
const allowedPython = new Set<string>();

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

function createWindow(): void {
  const iconPath = join(app.getAppPath(), 'build', 'icon.png');
  const window = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#000000',
    title: APP_NAME,
    autoHideMenuBar: false,
    icon: existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  windowRef = window;
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env.ELECTRON_RENDERER_URL;
    if (url.startsWith('file:') || (devUrl && url.startsWith(devUrl))) return;
    event.preventDefault();
  });
  window.webContents.on('before-input-event', (_event, input) => {
    if (input.type !== 'keyDown' || input.isAutoRepeat) return;
    if (input.key !== ' ' && input.code !== 'Space') return;
    window.webContents.send('startup-space');
  });
  window.on('close', (event) => {
    if (allowClose) return;
    event.preventDefault();
    window.webContents.send('app-close');
  });
  window.on('closed', () => {
    windowRef = null;
  });
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void window.loadFile(join(__dirname, '../renderer/index.html'));
}

function send(command: AppCommand): void {
  windowRef?.webContents.send('command', command);
}

function installMenu(): void {
  if (menuReady) return;
  menuReady = true;
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => send('new') },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => send('open') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('save-as') },
        { type: 'separator' },
        { label: 'Export workspace…', click: () => send('export') },
        { type: 'separator' },
        { label: 'Exit', accelerator: 'Alt+F4', click: () => windowRef?.close() },
      ],
    },
    {
      label: 'Translate',
      submenu: [
        { label: 'Translate Python to Blockly', accelerator: 'CmdOrCtrl+Enter', click: () => send('translate') },
        { label: 'Fit blocks', click: () => send('fit') },
        { label: 'Reset workspace', click: () => send('reset') },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Supported syntax', accelerator: 'F1', click: () => send('help') },
        { label: 'Settings', click: () => send('settings') },
        { label: 'About BTP Translator', click: () => send('about') },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asSaveRequest(value: unknown): SaveRequest | null {
  if (!isRecord(value)) return null;
  const path = value.path;
  if (!(path === null || typeof path === 'string')) return null;
  if (typeof value.content !== 'string' || typeof value.suggestedName !== 'string') return null;
  return { path, content: value.content, suggestedName: value.suggestedName };
}

function asExportRequest(value: unknown): ExportRequest | null {
  if (!isRecord(value)) return null;
  if (typeof value.content !== 'string' || typeof value.suggestedName !== 'string') return null;
  return { content: value.content, suggestedName: value.suggestedName };
}

async function openPython(): Promise<OpenResult> {
  const options = {
    title: 'Open Python file',
    properties: ['openFile'] as ('openFile')[],
    filters: [{ name: 'Python', extensions: ['py'] }],
  };
  const picked = windowRef ? await dialog.showOpenDialog(windowRef, options) : await dialog.showOpenDialog(options);
  if (picked.canceled || !picked.filePaths[0]) return { canceled: true };
  const path = picked.filePaths[0];
  if (!path.toLowerCase().endsWith('.py')) return { canceled: true, message: 'Choose a file that ends in .py.' };
  const info = await stat(path);
  if (info.size > 1_000_000) return { canceled: true, message: 'This file is larger than 1 MB.' };
  const content = await readFile(path, 'utf8');
  const problem = validatePythonContent(content);
  if (problem) return { canceled: true, message: problem };
  allowedPython.add(path);
  return { canceled: false, path, content };
}

async function savePython(request: SaveRequest, forceDialog: boolean): Promise<SaveResult> {
  const problem = validatePythonContent(request.content);
  if (problem) return { canceled: true, message: problem };
  let target = !forceDialog && request.path && allowedPython.has(request.path) ? request.path : null;
  if (!target) {
    const options = {
      title: 'Save Python file',
      defaultPath: safeFileName(request.suggestedName, 'program.py', '.py'),
      filters: [{ name: 'Python', extensions: ['py'] }],
    };
    const picked = windowRef ? await dialog.showSaveDialog(windowRef, options) : await dialog.showSaveDialog(options);
    if (picked.canceled || !picked.filePath) return { canceled: true };
    target = picked.filePath.toLowerCase().endsWith('.py') ? picked.filePath : `${picked.filePath}.py`;
  }
  await writeFile(target, request.content, 'utf8');
  allowedPython.add(target);
  return { canceled: false, path: target };
}

async function exportJson(request: ExportRequest): Promise<SaveResult> {
  if (request.content.length > 5_000_000) return { canceled: true, message: 'The workspace export is too large to save.' };
  const options = {
    title: 'Export Blockly workspace',
    defaultPath: safeFileName(request.suggestedName, 'workspace.json', '.json'),
    filters: [{ name: 'JSON', extensions: ['json'] }],
  };
  const picked = windowRef ? await dialog.showSaveDialog(windowRef, options) : await dialog.showSaveDialog(options);
  if (picked.canceled || !picked.filePath) return { canceled: true };
  const target = picked.filePath.toLowerCase().endsWith('.json') ? picked.filePath : `${picked.filePath}.json`;
  await writeFile(target, request.content, 'utf8');
  return { canceled: false, path: target };
}

app.on('second-instance', () => {
  if (!windowRef) return;
  if (windowRef.isMinimized()) windowRef.restore();
  windowRef.focus();
});

app.whenReady().then(() => {
  if (!gotLock) return;
  ipcMain.handle('file:open', () => openPython().catch((error: unknown) => ({
    canceled: true as const,
    message: error instanceof Error ? error.message : 'The file could not be opened.',
  })));
  ipcMain.handle('file:save', (_event, payload: unknown) => {
    const request = asSaveRequest(payload);
    if (!request) return { canceled: true, message: 'The save request was not valid.' } satisfies SaveResult;
    const forceDialog = false;
    return savePython(request, forceDialog).catch((error: unknown) => ({
      canceled: true as const,
      message: error instanceof Error ? error.message : 'The file could not be saved.',
    }));
  });
  ipcMain.handle('file:export', (_event, payload: unknown) => {
    const request = asExportRequest(payload);
    if (!request) return { canceled: true, message: 'The export request was not valid.' } satisfies SaveResult;
    return exportJson(request).catch((error: unknown) => ({
      canceled: true as const,
      message: error instanceof Error ? error.message : 'The workspace could not be exported.',
    }));
  });
  ipcMain.on('window:focus', () => {
    windowRef?.focus();
    windowRef?.webContents.focus();
  });
  ipcMain.on('startup:done', () => installMenu());
  ipcMain.on('app:quit', () => {
    allowClose = true;
    windowRef?.close();
  });
  createWindow();
}).catch((error: unknown) => {
  dialog.showErrorBox(APP_NAME, error instanceof Error ? error.message : 'BTP Translator could not start.');
  app.quit();
});

app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
