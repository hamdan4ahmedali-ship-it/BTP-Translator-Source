import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'build');
mkdirSync(root, { recursive: true });

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, pixels) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    pixels.copy(raw, row + 1, y * size * 4, (y + 1) * size * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function draw(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const margin = size * 0.08;
  const radius = size * 0.18;
  const blue = [27, 110, 217, 255];
  const white = [255, 255, 255, 255];
  const bar = size * 0.1;
  const width = size * 0.42;
  const height = size * 0.48;
  const left = (size - width) / 2;
  const right = left + width;
  const top = (size - height) / 2;
  const bottom = top + height;
  const mid = (size - bar) / 2;
  const inside = (x, y) => {
    const l = margin;
    const t = margin;
    const r = size - margin;
    const b = size - margin;
    if (x < l || y < t || x >= r || y >= b) return false;
    const cx = x < l + radius ? l + radius : x > r - radius ? r - radius : x;
    const cy = y < t + radius ? t + radius : y > b - radius ? b - radius : y;
    if (cx === x || cy === y) return true;
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= radius * radius;
  };
  const letter = (x, y) => {
    const stem = (y >= top && y <= bottom) && ((x >= left && x <= left + bar) || (x >= right - bar && x <= right));
    const cross = y >= mid && y <= mid + bar && x >= left && x <= right;
    return stem || cross;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!inside(x, y)) continue;
      const color = letter(x, y) ? white : blue;
      const index = (y * size + x) * 4;
      pixels[index] = color[0];
      pixels[index + 1] = color[1];
      pixels[index + 2] = color[2];
      pixels[index + 3] = color[3];
    }
  }
  return png(size, pixels);
}

function ico(images) {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  const entries = [];
  let offset = 6 + count * 16;
  for (const image of images) {
    const entry = Buffer.alloc(16);
    entry[0] = image.size === 256 ? 0 : image.size;
    entry[1] = image.size === 256 ? 0 : image.size;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += image.png.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
}

const sizes = [16, 32, 48, 256];
const images = sizes.map((size) => ({ size, png: draw(size) }));
writeFileSync(join(root, 'icon.png'), images[3].png);
writeFileSync(join(root, 'icon.ico'), ico(images));
writeFileSync(join(root, 'license.txt'), `BTP Translator
Copyright © HAMDAN SYSTEMS
Made by Hamdan Ahmed Iftikhar Ali

This application translates Python and Pybricks programs into Blockly blocks on your computer.
`);
console.log('Wrote build/icon.ico and build/icon.png');
