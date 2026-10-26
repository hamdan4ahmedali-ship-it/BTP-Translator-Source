import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function createCounter(file, cooldownMs) {
  const read = () => {
    if (!existsSync(file)) return { ok: true, count: 0, recent: [] };
    const raw = readFileSync(file, 'utf8');
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.count !== 'number' || parsed.count < 0 || !Array.isArray(parsed.recent)) {
        return { ok: false, raw };
      }
      return { ok: true, count: parsed.count, recent: parsed.recent, raw };
    } catch {
      return { ok: false, raw };
    }
  };

  const write = (state) => {
    mkdirSync(dirname(file), { recursive: true });
    const temporary = `${file}.tmp`;
    writeFileSync(temporary, JSON.stringify({ count: state.count, recent: state.recent }));
    try {
      if (existsSync(file)) rmSync(file);
      renameSync(temporary, file);
    } catch (error) {
      if (existsSync(temporary)) rmSync(temporary, { force: true });
      throw error;
    }
  };

  return {
    status() {
      const state = read();
      if (!state.ok) return { available: false };
      return { available: true, count: state.count };
    },
    hit({ ip, ua, now, prefetch }) {
      const state = read();
      if (!state.ok) return { available: false, counted: false };
      if (prefetch) return { available: true, counted: false, count: state.count };
      const hash = createHash('sha256').update(`${ip}\n${ua}`).digest('hex');
      const recent = state.recent.filter((item) => item && typeof item.at === 'number' && now - item.at < cooldownMs);
      if (recent.some((item) => item.hash === hash)) {
        return { available: true, counted: false, count: state.count };
      }
      const next = { count: state.count + 1, recent: [...recent, { hash, at: now }] };
      write(next);
      return { available: true, counted: true, count: next.count };
    },
  };
}
