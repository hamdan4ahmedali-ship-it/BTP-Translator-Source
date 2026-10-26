export interface CommentMark {
  start: number;
  end: number;
  line: number;
  text: string;
}

function isIdentChar(char: string | undefined): boolean {
  return Boolean(char && /[A-Za-z0-9_]/.test(char));
}

function skipStringAt(code: string, index: number): number | null {
  if (index > 0 && isIdentChar(code[index - 1])) return null;
  const slice = code.slice(index);
  const match = /^(?:[rR][fF]|[fF][rR]|[rR][bB]|[bB][rR]|[fF]|[rR]|[bB]|[uU])?(?:'''|"""|'|")/.exec(slice);
  if (!match) return null;
  const token = match[0];
  const quote = token.endsWith("'''") ? "'''" : token.endsWith('"""') ? '"""' : token.slice(-1);
  const prefix = token.slice(0, token.length - quote.length);
  const formatted = /[fF]/.test(prefix);
  let cursor = index + token.length;
  while (cursor < code.length) {
    if (code.startsWith(quote, cursor)) return cursor + quote.length;
    if (code[cursor] === '\\') {
      cursor += 2;
      continue;
    }
    if (formatted && code[cursor] === '{') {
      cursor = skipFormatExpression(code, cursor + 1);
      continue;
    }
    cursor += 1;
  }
  return code.length;
}

function skipFormatExpression(code: string, index: number): number {
  let depth = 1;
  let cursor = index;
  while (cursor < code.length && depth > 0) {
    const nested = skipStringAt(code, cursor);
    if (nested !== null) {
      cursor = nested;
      continue;
    }
    if (code[cursor] === '{') depth += 1;
    else if (code[cursor] === '}') depth -= 1;
    if (depth === 0) return cursor + 1;
    cursor += 1;
  }
  return cursor;
}

/** Comments are not syntax nodes in the Lezer Python grammar, so they are scanned separately. */
export function scanComments(code: string): CommentMark[] {
  const comments: CommentMark[] = [];
  let index = 0;
  let line = 1;
  while (index < code.length) {
    if (code[index] === '\n') {
      line += 1;
      index += 1;
      continue;
    }
    const stringEnd = skipStringAt(code, index);
    if (stringEnd !== null) {
      while (index < stringEnd) {
        if (code[index] === '\n') line += 1;
        index += 1;
      }
      continue;
    }
    if (code[index] === '#') {
      const start = index;
      const startLine = line;
      index += 1;
      while (index < code.length && code[index] !== '\n') index += 1;
      comments.push({
        start,
        end: index,
        line: startLine,
        text: code.slice(start + 1, index).trim(),
      });
      continue;
    }
    index += 1;
  }
  return comments;
}
