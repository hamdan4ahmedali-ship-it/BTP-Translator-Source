import { EXAMPLES, STARTER_CODE, type ExampleProgram } from '../../examples/programs';
import { convert, workspaceText } from '../../engine/convert';
import { capabilityList } from '../../engine/registry';
import type { ConversionResult, Diagnostic } from '../../engine/types';
import { APP_AUTHOR, APP_NAME, APP_OWNER, APP_VERSION } from '../../shared/version';
import { createBlockHost, type BlockHost } from './block-host';
import { createPythonEditor, type PythonEditor } from './editor';

const WELCOME_KEY = 'btp.welcome.v1';
const HISTORY_KEY = 'btp.history.v1';
const FONT_KEY = 'btp.fontSize';

interface HistoryItem {
  name: string;
  at: string;
  summary: string;
  code: string;
}

interface ModalButton {
  label: string;
  value: string;
  primary?: boolean;
}

export function mountApp(): void {
  const editorHost = need<HTMLElement>('editor');
  const blockHostElement = need<HTMLElement>('blocks');
  const fontSize = readFont();
  const editor = createPythonEditor(editorHost, fontSize);
  const blocks = createBlockHost(blockHostElement);
  const session = {
    path: null as string | null,
    name: 'welcome.py',
    snapshot: STARTER_CODE,
    dirty: false,
    result: null as ConversionResult | null,
  };

  editor.setValue(STARTER_CODE);
  editor.onChange(() => {
    session.dirty = editor.getValue() !== session.snapshot;
    paintFile();
  });
  editor.onCursor((line, column) => {
    text('cursor', `Ln ${line}, Col ${column}`);
  });

  const paintFile = () => {
    text('file-name', session.name);
    text('tab-name', `${session.dirty ? '● ' : ''}${session.name}`);
    const path = need<HTMLElement>('file-path');
    path.textContent = session.path ?? 'Not saved yet';
    path.title = session.path ?? 'This program has not been saved to a file.';
  };

  const setCode = (code: string, name: string, path: string | null) => {
    session.path = path;
    session.name = name;
    session.snapshot = code;
    session.dirty = false;
    editor.setValue(code);
    paintFile();
  };

  const renderExamples = () => {
    const list = need<HTMLElement>('examples');
    list.replaceChildren();
    for (const example of EXAMPLES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'side-item';
      button.title = example.description;
      button.innerHTML = `<strong>${escapeHtml(example.title)}</strong><span>${escapeHtml(example.description)}</span>`;
      button.addEventListener('click', () => {
        void replaceCode(example.code, `${example.id}.py`, null, example);
      });
      list.appendChild(button);
    }
  };

  const renderHistory = () => {
    const list = need<HTMLElement>('history');
    const items = readHistory();
    list.replaceChildren();
    if (items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'side-empty';
      empty.textContent = 'Translations you run will be listed here on this computer.';
      list.appendChild(empty);
      return;
    }
    for (const item of items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'side-item';
      button.innerHTML = `<strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.summary)}</span>`;
      button.addEventListener('click', () => {
        void replaceCode(item.code, item.name, null);
      });
      list.appendChild(button);
    }
  };

  const remember = (result: ConversionResult) => {
    const items = readHistory().filter((item) => item.code !== editor.getValue());
    items.unshift({
      name: session.name,
      at: new Date().toISOString(),
      summary: result.summary,
      code: editor.getValue(),
    });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 12)));
    renderHistory();
  };

  const showResult = (result: ConversionResult) => {
    session.result = result;
    text('summary', result.summary);
    const status = need<HTMLElement>('status-translation');
    status.textContent = result.empty ? 'Nothing to translate' : result.fullyTranslated ? 'Fully translated' : 'Translation incomplete';
    status.className = result.fullyTranslated ? 'ok' : result.empty ? '' : 'warn';
    const list = need<HTMLElement>('problems');
    list.replaceChildren();
    if (result.diagnostics.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'side-empty';
      empty.textContent = result.empty ? 'Paste or open Python, then press Translate.' : 'No warnings or errors.';
      list.appendChild(empty);
    } else {
      for (const item of result.diagnostics) list.appendChild(problemRow(item, editor));
    }
    editor.highlight(result.diagnostics.map((item) => ({ line: item.line, severity: item.severity })));
    text('status-counts', `${result.stats.blocks} blocks · ${result.stats.warnings} warnings · ${result.stats.errors} errors`);
  };

  const translate = () => {
    const result = convert(editor.getValue());
    const drawError = blocks.load(result.workspace);
    if (drawError) {
      result.fullyTranslated = false;
      result.diagnostics = [
        ...result.diagnostics,
        {
          severity: 'error',
          code: 'render',
          message: `The blocks could not be drawn (${drawError}). Your Python code was not changed.`,
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 1,
        },
      ];
      result.summary = 'Translation finished, but the workspace could not draw every block. Your Python code was not changed.';
    }
    showResult(result);
    if (!result.empty) remember(result);
  };

  const save = async (saveAs: boolean): Promise<boolean> => {
    const content = editor.getValue();
    const bridge = window.btp;
    if (!bridge) {
      downloadText(saveAs || !session.path ? session.name : session.name, content, 'text/x-python');
      session.snapshot = content;
      session.dirty = false;
      paintFile();
      return true;
    }
    const result = await bridge.savePython({
      path: saveAs ? null : session.path,
      content,
      suggestedName: session.name,
    });
    if (result.canceled) {
      if (result.message) flash(result.message);
      return false;
    }
    session.path = result.path;
    session.name = fileName(result.path);
    session.snapshot = content;
    session.dirty = false;
    paintFile();
    flash(`Saved ${session.name}`);
    return true;
  };

  const open = async () => {
    const bridge = window.btp;
    if (!bridge) {
      const input = need<HTMLInputElement>('file-input');
      input.click();
      return;
    }
    const result = await bridge.openPython();
    if (result.canceled) {
      if (result.message) flash(result.message);
      return;
    }
    setCode(result.content, fileName(result.path), result.path);
    flash(`Opened ${session.name}`);
  };

  const replaceCode = async (code: string, name: string, path: string | null, example?: ExampleProgram) => {
    if (!(await confirmDiscard())) return;
    setCode(code, name, path);
    if (example) flash(example.description);
  };

  const confirmDiscard = async (): Promise<boolean> => {
    if (!session.dirty) return true;
    const choice = await modal({
      title: 'Save changes?',
      body: `${session.name} has changes that are not saved.`,
      buttons: [
        { label: 'Save', value: 'save', primary: true },
        { label: "Don't save", value: 'discard' },
        { label: 'Cancel', value: 'cancel' },
      ],
    });
    if (choice === 'cancel') return false;
    if (choice === 'save') return save(false);
    return true;
  };

  const exportWorkspace = async () => {
    const content = blocks.exportJson();
    const bridge = window.btp;
    if (!bridge) {
      downloadText(session.name.replace(/\.py$/i, '') + '.blockly.json', content, 'application/json');
      return;
    }
    const result = await bridge.exportJson({
      content,
      suggestedName: session.name.replace(/\.py$/i, '') + '.blockly.json',
    });
    if (result.canceled && result.message) flash(result.message);
    if (!result.canceled) flash(`Exported ${fileName(result.path)}`);
  };

  const copyOutput = async () => {
    const result = session.result;
    const textValue = result ? `${result.summary}\n\n${workspaceText(result)}` : blocks.exportJson();
    await navigator.clipboard.writeText(textValue);
    flash('Copied the workspace JSON.');
  };

  bind('new-file', () => {
    void replaceCode(STARTER_CODE, 'welcome.py', null);
  });
  bind('open-file', () => void open());
  bind('save-file', () => void save(false));
  bind('save-as', () => void save(true));
  bind('translate', translate);
  bind('fit', () => blocks.fit());
  bind('reset-view', () => blocks.center());
  bind('clear-blocks', () => {
    if (!blocks.hasBlocks()) return;
    void modal({
      title: 'Clear blocks?',
      body: 'This clears the Blockly workspace. The Python editor stays as it is.',
      buttons: [
        { label: 'Clear blocks', value: 'clear', primary: true },
        { label: 'Cancel', value: 'cancel' },
      ],
    }).then((choice) => {
      if (choice !== 'clear') return;
      blocks.clear();
      text('summary', 'The Blockly workspace was cleared. The Python code was not changed.');
      text('status-translation', 'Workspace cleared');
    });
  });
  bind('export', () => void exportWorkspace());
  bind('copy-output', () => void copyOutput());
  bind('help', () => showHelp());
  bind('about', () => showAbout());
  bind('settings', () => showSettings(editor));
  bind('clear-editor', () => {
    void replaceCode('', 'untitled.py', null);
  });

  need<HTMLInputElement>('file-input').addEventListener('change', () => {
    const input = need<HTMLInputElement>('file-input');
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.py')) {
      flash('Choose a file that ends in .py.');
      return;
    }
    void file.text().then((content) => {
      if (content.includes('\0') || content.length > 1_000_000) {
        flash('That file cannot be opened. Use a Python text file under 1 MB.');
        return;
      }
      void replaceCode(content, file.name, null);
    });
  });

  window.btp?.onCommand((command) => {
    if (command === 'new') void replaceCode(STARTER_CODE, 'welcome.py', null);
    if (command === 'open') void open();
    if (command === 'save') void save(false);
    if (command === 'save-as') void save(true);
    if (command === 'export') void exportWorkspace();
    if (command === 'translate') translate();
    if (command === 'fit') blocks.fit();
    if (command === 'reset') blocks.center();
    if (command === 'help') showHelp();
    if (command === 'about') showAbout();
    if (command === 'settings') showSettings(editor);
  });
  window.btp?.onCloseRequest(() => {
    void confirmDiscard().then((ok) => {
      if (ok) window.btp?.confirmQuit();
    });
  });
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key === 'f1') {
      event.preventDefault();
      showHelp();
    }
    if (!(event.ctrlKey || event.metaKey)) return;
    if (key === 'enter') {
      event.preventDefault();
      translate();
    } else if (key === 's' && event.shiftKey) {
      event.preventDefault();
      void save(true);
    } else if (key === 's') {
      event.preventDefault();
      void save(false);
    } else if (key === 'o') {
      event.preventDefault();
      void open();
    } else if (key === 'n') {
      event.preventDefault();
      void replaceCode(STARTER_CODE, 'welcome.py', null);
    }
  });
  window.addEventListener('beforeunload', (event) => {
    if (!session.dirty || window.btp) return;
    event.preventDefault();
  });
  window.addEventListener('resize', () => {
    editor.layout();
    blocks.resize();
  });
  installDivider(editor, blocks);
  installPanelResize(editor, blocks);

  renderExamples();
  renderHistory();
  paintFile();
  text('version', APP_VERSION);
  text('status-direction', 'Python → Blockly');
  text('summary', 'Press Translate to turn the Python program into blocks.');
  text('status-translation', 'Ready');
  text('status-counts', 'No translation yet');
  if (!localStorage.getItem(WELCOME_KEY)) {
    localStorage.setItem(WELCOME_KEY, '1');
    showWelcome();
  }
  window.setTimeout(() => editor.layout(), 0);
}

function problemRow(item: Diagnostic, editor: PythonEditor): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `problem ${item.severity}`;
  button.innerHTML = `<em>${item.severity}</em><span>Line ${item.line}: ${escapeHtml(item.message)}</span>`;
  button.addEventListener('click', () => editor.reveal(item.line));
  return button;
}

function showWelcome(): void {
  void modal({
    title: 'Welcome to BTP Translator',
    body: `<p>This program turns Python, including Pybricks robot code, into Blockly blocks on your computer.</p>
      <ol>
        <li>Paste code, open a .py file, or choose an example on the left.</li>
        <li>Press <strong>Translate</strong>.</li>
        <li>Look at the blocks and read any warnings along the bottom.</li>
      </ol>
      <p>Translation goes from Python to blocks. Moving a block does not change your Python file. Code that cannot be converted stays visible with a warning.</p>`,
    buttons: [{ label: 'Start translating', value: 'ok', primary: true }],
  });
}

function showHelp(): void {
  const groups = new Map<string, string[]>();
  for (const item of capabilityList()) {
    const list = groups.get(item.group) ?? [];
    list.push(`<li><strong>${escapeHtml(item.title)}</strong> — ${escapeHtml(item.detail)}</li>`);
    groups.set(item.group, list);
  }
  const body = [...groups.entries()].map(([group, items]) => `<h3>${escapeHtml(group)}</h3><ul>${items.join('')}</ul>`).join('');
  void modal({
    title: 'What can be translated',
    body: `${body}<p>Pybricks names follow the current documentation. DriveBase uses straight, turn, and arc. The older curve method is kept as source and explained in the problems list.</p>`,
    buttons: [{ label: 'Close', value: 'ok', primary: true }],
    wide: true,
  });
}

function showAbout(): void {
  void modal({
    title: APP_NAME,
    body: `<p>Version ${APP_VERSION}</p>
      <p>Owned by ${APP_OWNER}.</p>
      <p>Made by ${APP_AUTHOR}.</p>
      <p>contact us on snapchat "hamdan.ahmed1"</p>
      <p>contact us on discord "hamdanisbetter"</p>
      <p>contact us on instagram "hamdanisbetter"</p>
      <p>contact us on gmail "hamdan4ahmedali@gmail.com"</p>
      <p>Translation runs on this computer. The app does not send your program anywhere.</p>`,
    buttons: [{ label: 'Close', value: 'ok', primary: true }],
  });
}

function showSettings(editor: PythonEditor): void {
  const current = readFont();
  void modal({
    title: 'Settings',
    body: `<label class="setting">Editor font size
      <input id="font-size" type="number" min="12" max="24" value="${current}" />
    </label>`,
    buttons: [
      { label: 'Save', value: 'save', primary: true },
      { label: 'Cancel', value: 'cancel' },
    ],
  }).then((choice) => {
    if (choice !== 'save') return;
    const input = document.querySelector<HTMLInputElement>('#font-size');
    const size = Number(input?.value ?? current);
    const next = Number.isFinite(size) ? Math.min(24, Math.max(12, size)) : current;
    localStorage.setItem(FONT_KEY, String(next));
    editor.setFontSize(next);
  });
}

function installDivider(editor: PythonEditor, blocks: BlockHost): void {
  const handle = need<HTMLElement>('split-handle');
  const pane = need<HTMLElement>('editor-pane');
  const split = need<HTMLElement>('split');
  let dragging = false;
  handle.addEventListener('pointerdown', (event) => {
    dragging = true;
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const bounds = split.getBoundingClientRect();
    const width = Math.min(bounds.width - 280, Math.max(280, event.clientX - bounds.left));
    pane.style.flexBasis = `${width}px`;
    editor.layout();
    blocks.resize();
  });
  handle.addEventListener('pointerup', () => {
    dragging = false;
  });
}

function installPanelResize(editor: PythonEditor, blocks: BlockHost): void {
  const handle = need<HTMLElement>('panel-handle');
  const panel = need<HTMLElement>('panel');
  let dragging = false;
  handle.addEventListener('pointerdown', (event) => {
    dragging = true;
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const parent = panel.parentElement?.getBoundingClientRect();
    if (!parent) return;
    const height = Math.min(parent.height * 0.55, Math.max(96, parent.bottom - event.clientY));
    panel.style.height = `${height}px`;
    editor.layout();
    blocks.resize();
  });
  handle.addEventListener('pointerup', () => {
    dragging = false;
  });
}

function modal(options: { title: string; body: string; buttons: ModalButton[]; wide?: boolean }): Promise<string> {
  const root = need<HTMLElement>('modal');
  const card = need<HTMLElement>('modal-card');
  card.classList.toggle('wide', Boolean(options.wide));
  text('modal-title', options.title);
  need<HTMLElement>('modal-body').innerHTML = options.body;
  const actions = need<HTMLElement>('modal-actions');
  actions.replaceChildren();
  root.hidden = false;
  return new Promise((resolve) => {
    const finish = (value: string) => {
      root.hidden = true;
      resolve(value);
    };
    for (const item of options.buttons) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.label;
      button.className = item.primary ? 'primary' : 'ghost';
      button.addEventListener('click', () => finish(item.value));
      actions.appendChild(button);
    }
    actions.querySelector('button')?.focus();
  });
}

function flash(message: string): void {
  text('summary', message);
}

function readFont(): number {
  const size = Number(localStorage.getItem(FONT_KEY) ?? '14');
  return Number.isFinite(size) ? Math.min(24, Math.max(12, size)) : 14;
}

function readHistory(): HistoryItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as HistoryItem[];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item?.code === 'string') : [];
  } catch {
    return [];
  }
}

function fileName(path: string): string {
  return path.split(/[/\\]/).pop() || 'program.py';
}

function downloadText(name: string, content: string, type: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

function bind(id: string, handler: () => void): void {
  need<HTMLButtonElement>(id).addEventListener('click', handler);
}

function need<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

function text(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}
