/// <reference types="vite/client" />

declare module 'monaco-editor/languages/definitions/python/python.js' {
  export const conf: Record<string, unknown>;
  export const language: Record<string, unknown>;
}

interface MonacoWorkerEnvironment {
  getWorker(workerId: string, label: string): Worker;
}

declare global {
  interface Window {
    btp?: {
      openPython(): Promise<import('../../shared/bridge').OpenResult>;
      savePython(request: import('../../shared/bridge').SaveRequest): Promise<import('../../shared/bridge').SaveResult>;
      exportJson(request: import('../../shared/bridge').ExportRequest): Promise<import('../../shared/bridge').SaveResult>;
      focusWindow(): void;
      startupDone(): void;
      confirmQuit(): void;
      onCommand(handler: (command: import('../../shared/bridge').AppCommand) => void): () => void;
      onSpace(handler: () => void): () => void;
      onCloseRequest(handler: () => void): () => void;
    };
    MonacoEnvironment?: MonacoWorkerEnvironment;
  }
}

export {};
