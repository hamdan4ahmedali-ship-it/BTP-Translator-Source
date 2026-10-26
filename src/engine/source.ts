import type { Diagnostic, DiagnosticSeverity, SourceRange } from './types';

export function positionAt(code: string, offset: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  const end = Math.min(Math.max(offset, 0), code.length);
  for (let index = 0; index < end; index += 1) {
    if (code[index] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

export function rangeOf(code: string, start: number, end: number): SourceRange {
  const from = positionAt(code, start);
  const to = positionAt(code, end);
  return {
    start,
    end,
    line: from.line,
    column: from.column,
    endLine: to.line,
    endColumn: to.column,
  };
}

export function makeDiagnostic(
  severity: DiagnosticSeverity,
  code: string,
  message: string,
  range: SourceRange,
): Diagnostic {
  return {
    severity,
    code,
    message,
    line: range.line,
    column: range.column,
    endLine: range.endLine,
    endColumn: range.endColumn,
  };
}

export function snippet(source: string, max = 96): string {
  const oneLine = source.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

export function decodePythonString(raw: string): { value: string; bytes: boolean; formatted: boolean } | null {
  let index = 0;
  let isRaw = false;
  let isBytes = false;
  let formatted = false;
  while (index < raw.length && index < 4 && /[rRfFbBuU]/.test(raw[index] ?? '')) {
    const marker = raw[index]?.toLowerCase();
    if (marker === 'r') isRaw = true;
    else if (marker === 'b') isBytes = true;
    else if (marker === 'f') formatted = true;
    else if (marker === 'u') {
      /* Python 2 prefix, ignored. */
    } else break;
    index += 1;
  }
  const quote = raw.startsWith("'''", index)
    ? "'''"
    : raw.startsWith('"""', index)
      ? '"""'
      : raw[index] === "'" || raw[index] === '"'
        ? raw[index]
        : '';
  if (!quote || !raw.endsWith(quote) || raw.length < index + quote.length * 2) return null;
  const body = raw.slice(index + quote.length, raw.length - quote.length);
  return { value: isRaw ? body : unescapePython(body), bytes: isBytes, formatted };
}

function unescapePython(body: string): string {
  let value = '';
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char !== '\\') {
      value += char ?? '';
      continue;
    }
    const next = body[index + 1] ?? '';
    const simple: Record<string, string> = {
      n: '\n',
      t: '\t',
      r: '\r',
      '\\': '\\',
      "'": "'",
      '"': '"',
      a: '\u0007',
      b: '\b',
      f: '\f',
      v: '\v',
    };
    if (simple[next] !== undefined) {
      value += simple[next];
      index += 1;
      continue;
    }
    if (next === '\n') {
      index += 1;
      continue;
    }
    if (next === 'x' && /^[0-9a-fA-F]{2}/.test(body.slice(index + 2, index + 4))) {
      value += String.fromCharCode(parseInt(body.slice(index + 2, index + 4), 16));
      index += 3;
      continue;
    }
    if (next === 'u' && /^[0-9a-fA-F]{4}/.test(body.slice(index + 2, index + 6))) {
      value += String.fromCharCode(parseInt(body.slice(index + 2, index + 6), 16));
      index += 5;
      continue;
    }
    if (/[0-7]/.test(next)) {
      const octal = /^[0-7]{1,3}/.exec(body.slice(index + 1));
      if (octal) {
        value += String.fromCharCode(parseInt(octal[0], 8));
        index += octal[0].length;
        continue;
      }
    }
    value += next;
    index += 1;
  }
  return value;
}

export function parsePythonNumber(raw: string): number | null {
  const cleaned = raw.replace(/_/g, '');
  if (/[jJ]$/.test(cleaned)) return null;
  if (/^0[bB][01]+$/.test(cleaned)) return Number.parseInt(cleaned.slice(2), 2);
  if (/^0[oO][0-7]+$/.test(cleaned)) return Number.parseInt(cleaned.slice(2), 8);
  if (/^0[xX][0-9a-fA-F]+$/.test(cleaned)) return Number.parseInt(cleaned.slice(2), 16);
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
