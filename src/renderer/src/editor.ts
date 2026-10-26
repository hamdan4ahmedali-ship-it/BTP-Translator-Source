import * as monaco from 'monaco-editor/editor/editor.api';
import editorWorker from 'monaco-editor/editor/editor.worker?worker';
import { conf, language } from 'monaco-editor/languages/definitions/python/python.js';

window.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};

monaco.languages.register({ id: 'python' });
monaco.languages.setLanguageConfiguration('python', conf as unknown as monaco.languages.LanguageConfiguration);
monaco.languages.setMonarchTokensProvider('python', language as unknown as monaco.languages.IMonarchLanguage);

monaco.editor.defineTheme('btp', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: 'c586c0' },
    { token: 'string', foreground: 'ce9178' },
    { token: 'number', foreground: 'b5cea8' },
    { token: 'comment', foreground: '6a9955' },
    { token: 'identifier', foreground: '9cdcfe' },
    { token: 'type', foreground: '4ec9b0' },
    { token: 'delimiter', foreground: 'd4d4d4' },
  ],
  colors: {
    'editor.background': '#1e1e1e',
    'editor.foreground': '#d4d4d4',
    'editorLineNumber.foreground': '#6e7681',
    'editorLineNumber.activeForeground': '#c6c6c6',
    'editorCursor.foreground': '#4fc1ff',
    'editor.selectionBackground': '#264f78',
    'editor.lineHighlightBackground': '#2a2d31',
    'editorGutter.background': '#1e1e1e',
  },
});

export interface PythonEditor {
  getValue(): string;
  setValue(value: string): void;
  focus(): void;
  layout(): void;
  setFontSize(size: number): void;
  onChange(handler: () => void): void;
  onCursor(handler: (line: number, column: number) => void): void;
  highlight(items: { line: number; severity: 'error' | 'warning' | 'info' }[]): void;
  reveal(line: number): void;
}

export function createPythonEditor(host: HTMLElement, fontSize: number): PythonEditor {
  const editor = monaco.editor.create(host, {
    value: '',
    language: 'python',
    theme: 'btp',
    fontSize,
    fontFamily: 'Cascadia Code, Consolas, monospace',
    fontLigatures: false,
    minimap: { enabled: true },
    automaticLayout: true,
    scrollBeyondLastLine: false,
    tabSize: 4,
    insertSpaces: true,
    wordWrap: 'off',
    renderWhitespace: 'selection',
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    padding: { top: 12, bottom: 12 },
    bracketPairColorization: { enabled: true },
    overviewRulerLanes: 2,
    fixedOverflowWidgets: true,
  });
  let decorations = editor.createDecorationsCollection();
  return {
    getValue: () => editor.getValue(),
    setValue(value: string) {
      editor.setValue(value);
    },
    focus: () => editor.focus(),
    layout: () => editor.layout(),
    setFontSize(size: number) {
      editor.updateOptions({ fontSize: size });
    },
    onChange(handler: () => void) {
      editor.onDidChangeModelContent(handler);
    },
    onCursor(handler: (line: number, column: number) => void) {
      editor.onDidChangeCursorPosition((event) => handler(event.position.lineNumber, event.position.column));
    },
    highlight(items) {
      decorations.set(
        items.map((item) => ({
          range: new monaco.Range(item.line, 1, item.line, 1),
          options: {
            isWholeLine: true,
            className: item.severity === 'error' ? 'mark-error' : item.severity === 'warning' ? 'mark-warning' : 'mark-info',
            overviewRuler: {
              color: item.severity === 'error' ? '#f14c4c' : item.severity === 'warning' ? '#f0a05a' : '#4fc1ff',
              position: monaco.editor.OverviewRulerLane.Right,
            },
          },
        })),
      );
    },
    reveal(line: number) {
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.focus();
    },
  };
}
