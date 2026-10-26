import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCounter } from './lib/store.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

export function createApp(options = {}) {
  const publicDir = resolve(options.publicDir ?? join(root, 'public'));
  const dataFile = options.dataFile ?? join(options.dataDir ?? process.env.DATA_DIR ?? join(root, 'data'), 'downloads.json');
  const installerPath = options.installerPath ?? process.env.INSTALLER_PATH ?? join(root, 'releases', 'BTP-Translator-Setup.exe');
  const cooldownMs = options.cooldownMs ?? Number(process.env.DOWNLOAD_COOLDOWN_MS ?? 60_000);
  const counter = createCounter(dataFile, cooldownMs);
  const release = JSON.parse(readFileSync(join(root, 'release-info.json'), 'utf8'));

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname === '/health') {
      return sendJson(response, { ok: true, installerAvailable: existsSync(installerPath) });
    }
    if (url.pathname === '/api/downloads') return sendJson(response, counter.status());
    if (url.pathname === '/api/status') {
      const downloads = counter.status();
      return sendJson(response, {
        version: release.version,
        product: release.product,
        installerAvailable: existsSync(installerPath),
        downloads: downloads.available ? downloads.count : null,
        downloadsAvailable: downloads.available,
        notes: release.notes,
        requirements: release.requirements,
      });
    }
    if (url.pathname === '/download') return sendInstaller(request, response, url, installerPath, counter);
    const file = staticFile(publicDir, url.pathname);
    if (!file) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    createReadStream(file).pipe(response);
  });

  return { server, counter, installerPath, release };
}

function sendInstaller(request, response, url, installerPath, counter) {
  if (!existsSync(installerPath)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('The Windows installer has not been published here yet.');
    return;
  }
  const info = statSync(installerPath);
  const headers = {
    'content-type': 'application/octet-stream',
    'content-length': info.size,
    'content-disposition': 'attachment; filename="BTP-Translator-Setup.exe"',
    'cache-control': 'no-store',
  };
  if (request.method === 'HEAD') {
    response.writeHead(200, headers);
    response.end();
    return;
  }
  if (url.searchParams.get('dl') !== '1') {
    response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Use the download button.');
    return;
  }
  const prefetch = isPrefetch(request);
  counter.hit({
    ip: request.socket.remoteAddress ?? '',
    ua: String(request.headers['user-agent'] ?? ''),
    now: Date.now(),
    prefetch,
  });
  response.writeHead(200, headers);
  createReadStream(installerPath).pipe(response);
}

function isPrefetch(request) {
  const purpose = `${request.headers.purpose ?? ''} ${request.headers['sec-purpose'] ?? ''} ${request.headers['x-moz'] ?? ''}`.toLowerCase();
  return purpose.includes('prefetch') || purpose.includes('preview');
}

function staticFile(publicDir, pathname) {
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = normalize(join(publicDir, relative));
  const base = publicDir.endsWith(sep) ? publicDir : `${publicDir}${sep}`;
  if (file !== publicDir && !file.startsWith(base)) return null;
  if (!existsSync(file) || statSync(file).isDirectory()) return null;
  return file;
}

function sendJson(response, body) {
  response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const splitAt = trimmed.indexOf('=');
    if (splitAt < 1) continue;
    const key = trimmed.slice(0, splitAt).trim();
    const value = trimmed.slice(splitAt + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
if (invoked === fileURLToPath(import.meta.url)) {
  loadEnvFile(join(root, '.env'));
  // Caddy on this PC connects to 127.0.0.1. Binding 0.0.0.0 would publish
  // plain HTTP on port 4173 to the network and bypass HTTPS.
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT ?? 4173);
  const { server, installerPath } = createApp();
  server.listen(port, host, () => {
    console.log(`BTP Translator website listening on http://${host}:${port}`);
    console.log(existsSync(installerPath) ? `Installer: ${installerPath}` : 'Installer file is not present. The download button stays disabled.');
  });
}
