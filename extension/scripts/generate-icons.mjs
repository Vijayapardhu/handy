// Generates extension/icons/icon{16,48,128}.png — a simple indigo rounded
// square with a white "H" mark. Hand-rolled PNG encoder (signature + IHDR +
// IDAT + IEND) so icon generation has zero dependencies. Re-run with
// `node extension/scripts/generate-icons.mjs` if you want to change the mark.
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "icons");

const BG = [79, 70, 229, 255]; // indigo #4F46E5
const FG = [255, 255, 255, 255];

function roundedRectContains(x, y, size, r) {
  const outsideCorner = (cx, cy) => (x - cx) ** 2 + (y - cy) ** 2 > r * r;
  if (x < r && y < r && outsideCorner(r, r)) return false;
  if (x >= size - r && y < r && outsideCorner(size - r, r)) return false;
  if (x < r && y >= size - r && outsideCorner(r, size - r)) return false;
  if (x >= size - r && y >= size - r && outsideCorner(size - r, size - r)) return false;
  return true;
}

function drawRect(px, size, x0, y0, w, h, color) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const idx = (y * size + x) * 4;
      px.set(color, idx);
    }
  }
}

function makeIcon(size) {
  const px = new Uint8Array(size * size * 4);
  const radius = size * 0.22;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      if (roundedRectContains(x, y, size, radius)) px.set(BG, idx);
    }
  }

  const barW = Math.max(1, Math.round(size * 0.14));
  const barH = Math.round(size * 0.56);
  const top = Math.round((size - barH) / 2);
  const leftX = Math.round(size * 0.26);
  const rightX = Math.round(size * 0.74 - barW);
  const midY = Math.round(size / 2 - barW / 2);

  drawRect(px, size, leftX, top, barW, barH, FG);
  drawRect(px, size, rightX, top, barW, barH, FG);
  drawRect(px, size, leftX, midY, rightX + barW - leftX, barW, FG);

  return px;
}

function crc32(buf) {
  const table =
    crc32.table ||
    (crc32.table = (() => {
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
      }
      return t;
    })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(px, size) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter type: none
    Buffer.from(px.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = zlib.deflateSync(raw);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

/**
 * The same mark, rendered `ss` times oversized and box-filtered back down.
 *
 * makeIcon draws with hard pixel tests, which is fine at 16px where a corner is
 * two pixels anyway, but at store-logo size the rounded corners read as visibly
 * stepped. Averaging an oversampled render is the whole of antialiasing here.
 *
 * The three manifest icons are deliberately left on the original path so this
 * change doesn't rewrite assets that are already shipped and fine.
 */
function makeIconAA(size, ss = 4) {
  const big = makeIcon(size * ss);
  const out = new Uint8Array(size * size * 4);
  const samples = ss * ss;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let dy = 0; dy < ss; dy++) {
        for (let dx = 0; dx < ss; dx++) {
          const idx = ((y * ss + dy) * size * ss + (x * ss + dx)) * 4;
          r += big[idx]; g += big[idx + 1]; b += big[idx + 2]; a += big[idx + 3];
        }
      }
      const idx = (y * size + x) * 4;
      out[idx] = Math.round(r / samples);
      out[idx + 1] = Math.round(g / samples);
      out[idx + 2] = Math.round(b / samples);
      out[idx + 3] = Math.round(a / samples);
    }
  }
  return out;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const size of [16, 48, 128]) {
  const png = encodePNG(makeIcon(size), size);
  const outPath = path.join(OUT_DIR, `icon${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${png.length} bytes)`);
}

// Store logo for the Edge Add-ons listing, which requires exactly 300x300 and
// is not part of the extension package — hence dist-extension/, not icons/.
const STORE_DIR = path.join(__dirname, "..", "..", "dist-extension", "listing");
fs.mkdirSync(STORE_DIR, { recursive: true });
const logo = encodePNG(makeIconAA(300), 300);
const logoPath = path.join(STORE_DIR, "store-logo-300.png");
fs.writeFileSync(logoPath, logo);
console.log(`wrote ${logoPath} (${logo.length} bytes)`);
