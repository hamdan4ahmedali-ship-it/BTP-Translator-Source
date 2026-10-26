const MAX_PYTHON_BYTES = 1_000_000;

export function validatePythonContent(content: unknown): string | null {
  if (typeof content !== 'string') return 'The file is not text, so it was not opened.';
  if (content.includes('\0')) return 'This file contains binary data. Choose a Python text file.';
  if (Buffer.byteLength(content, 'utf8') > MAX_PYTHON_BYTES) return 'This file is larger than 1 MB. BTP Translator opens Python programs up to 1 MB.';
  return null;
}

export function safeFileName(name: string, fallback: string, extension: string): string {
  const base = name.split(/[/\\]/).pop() ?? '';
  const cleaned = base.replace(/[<>:"|?*\u0000-\u001f]/g, '').trim();
  const stem = cleaned.length > 0 ? cleaned : fallback;
  return stem.toLowerCase().endsWith(extension) ? stem : `${stem}${extension}`;
}
