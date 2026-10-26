import { describe, expect, it } from 'vitest';
import release from '../website/release-info.json';
import { APP_VERSION } from '../src/shared/version';
import { safeFileName, validatePythonContent } from '../src/shared/files';

describe('release identity', () => {
  it('keeps the website version aligned with the desktop app', () => {
    expect(release.version).toBe(APP_VERSION);
  });
});

describe('file checks', () => {
  it('accepts ordinary Python and rejects binary or oversized text', () => {
    expect(validatePythonContent('print(1)\n')).toBeNull();
    expect(validatePythonContent('a\0b')).toMatch(/binary/);
    expect(validatePythonContent('x'.repeat(1_000_001))).toMatch(/1 MB/);
  });

  it('keeps a safe python file name', () => {
    expect(safeFileName('demo.py', 'program.py', '.py')).toBe('demo.py');
    expect(safeFileName('folder/bad:name', 'program.py', '.py')).toBe('badname.py');
  });
});
