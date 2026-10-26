import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createCounter } from '../lib/store.js';
import { createApp } from '../server.js';

test('counts a download once inside the cooldown and keeps zero until then', () => {
  const dir = mkdtempSync(join(tmpdir(), 'btp-counter-'));
  const file = join(dir, 'downloads.json');
  const counter = createCounter(file, 60_000);
  assert.deepEqual(counter.status(), { available: true, count: 0 });
  const first = counter.hit({ ip: '127.0.0.1', ua: 'test', now: 1_000, prefetch: false });
  assert.equal(first.counted, true);
  assert.equal(first.count, 1);
  const repeat = counter.hit({ ip: '127.0.0.1', ua: 'test', now: 2_000, prefetch: false });
  assert.equal(repeat.counted, false);
  assert.equal(repeat.count, 1);
  const other = counter.hit({ ip: '127.0.0.1', ua: 'other', now: 3_000, prefetch: false });
  assert.equal(other.count, 2);
  const later = counter.hit({ ip: '127.0.0.1', ua: 'test', now: 70_000, prefetch: false });
  assert.equal(later.count, 3);
  const stored = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(JSON.stringify(stored).includes('127.0.0.1'), false);
  rmSync(dir, { recursive: true, force: true });
});

test('ignores a prefetch and does not repair a corrupt counter', () => {
  const dir = mkdtempSync(join(tmpdir(), 'btp-counter-'));
  const fresh = createCounter(join(dir, 'fresh.json'), 60_000);
  const prefetch = fresh.hit({ ip: '10.0.0.2', ua: 'prefetch', now: 10, prefetch: true });
  assert.equal(prefetch.counted, false);
  assert.equal(prefetch.count, 0);
  const file = join(dir, 'downloads.json');
  writeFileSync(file, '{ this is not json');
  const counter = createCounter(file, 60_000);
  assert.deepEqual(counter.status(), { available: false });
  const hit = counter.hit({ ip: '10.0.0.8', ua: 'bot', now: 5, prefetch: false });
  assert.equal(hit.available, false);
  assert.equal(readFileSync(file, 'utf8'), '{ this is not json');
  rmSync(dir, { recursive: true, force: true });
});

test('serves the installer through the tracked download route', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'btp-site-'));
  const installer = join(dir, 'BTP-Translator-Setup.exe');
  writeFileSync(installer, 'installer-bytes');
  const { server } = createApp({
    dataFile: join(dir, 'downloads.json'),
    installerPath: installer,
    cooldownMs: 60_000,
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}`;
  const status = await fetch(`${base}/api/status`).then((response) => response.json());
  assert.equal(status.downloads, 0);
  assert.equal(status.installerAvailable, true);
  const statusAgain = await fetch(`${base}/api/downloads`).then((response) => response.json());
  assert.equal(statusAgain.count, 0);
  const downloaded = await fetch(`${base}/download?dl=1`, { headers: { 'user-agent': 'site-test' } });
  assert.equal(await downloaded.text(), 'installer-bytes');
  const after = await fetch(`${base}/api/downloads`).then((response) => response.json());
  assert.equal(after.count, 1);
  await fetch(`${base}/download?dl=1`, { headers: { 'user-agent': 'site-test' } });
  const cooled = await fetch(`${base}/api/downloads`).then((response) => response.json());
  assert.equal(cooled.count, 1);
  const health = await fetch(`${base}/health`).then((response) => response.json());
  assert.equal(health.ok, true);
  assert.equal(health.installerAvailable, true);
  const afterHealth = await fetch(`${base}/api/downloads`).then((response) => response.json());
  assert.equal(afterHealth.count, 1);
  const head = await fetch(`${base}/download?dl=1`, { method: 'HEAD', headers: { 'user-agent': 'site-test-head' } });
  assert.equal(head.status, 200);
  const afterHead = await fetch(`${base}/api/downloads`).then((response) => response.json());
  assert.equal(afterHead.count, 1);
  await new Promise((resolve) => server.close(resolve));
  rmSync(dir, { recursive: true, force: true });
});
