declare module 'monaco-editor/editor/editor.api' {
  export * from 'monaco-editor';
}

declare module 'monaco-editor/languages/definitions/python/python.js' {
  export const conf: Record<string, unknown>;
  export const language: Record<string, unknown>;
}
