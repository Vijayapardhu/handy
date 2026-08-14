// Generates the app icon and splash mark — the same rounded "H" used by the
// web favicon and the extension, in the app's orange.
//
// Hand-rolled PNG encoder (signature + IHDR + IDAT + IEND) so icon generation
// needs no image library, matching scripts/generate-app-icons.mjs in the web
// app. Re-run with `node tool/make_icon.mjs`.
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(dir, '..', 'assets');

const ORANGE = [249, 115, 22, 255];
const WHITE = [255, 255, 255, 255];
const TRANSPARENT = [0, 0, 0, 0];

function roundedRectContains(x, y, size, r) {
  const outside = (cx, cy) => (x - cx) ** 2 + (y - cy) ** 2 > r * r;
  if (x < r && y < r && outside(r, r)) return false;
  if (x >= size - r && y < r && outside(size - r, r)) return false;
  if (x < r && y >= size - r && outside(r, size - r)) return false;
  if (x >= size - r && y >= size - r && outside(size - r, size - r)) return false;
  return true;
}

function drawRect(px, size, x0, y0, w, h, colour) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      px.set(colour, (y * size + x) * 4);
    }
  }
}

/**
 * @param background `null` draws the H alone on transparency — what the splash
 *   and the adaptive-icon foreground need, since the launcher supplies its own
 *   background layer and would otherwise clip a second one.
 */
function makeIcon(size, { background = ORANGE, scale = 1 } = {}) {
  const px = new Uint8Array(size * size * 4);

  if (background) {
    const radius = size * 0.22;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        px.set(roundedRectContains(x, y, size, radius) ? background : TRANSPARENT, (y * size + x) * 4);
      }
    }
  }

  const mark = background ? WHITE : ORANGE;
  const barW = Math.max(1, Math.round(size * 0.13 * scale));
  const barH = Math.round(size * 0.5 * scale);
  const top = Math.round((size - barH) / 2);
  const leftX = Math.round(size / 2 - size * 0.22 * scale);
  const rightX = Math.round(size / 2 + size * 0.22 * scale - barW);
  const midY = Math.round(size / 2 - barW / 2);

  drawRect(px, size, leftX, top, barW, barH, mark);
  drawRect(px, size, rightX, top, barW, barH, mark);
  drawRect(px, size, leftX, midY, rightX + barW - leftX, barW, mark);

  return px;
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(px, size) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(px.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(out, { recursive: true });

const files = [
  ['icon.png', 1024, {}],
  // Adaptive foreground: the launcher masks and scales it, so the mark sits
  // smaller inside a transparent square to survive the crop.
  ['icon_foreground.png', 1024, { background: null, scale: 0.62 }],
  ['splash.png', 512, { background: null }],
];

for (const [name, size, options] of files) {
  const file = path.join(out, name);
  fs.writeFileSync(file, encodePNG(makeIcon(size, options), size));
  console.log('wrote', file);
}
