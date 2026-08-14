// Generates public/icons/icon-{192,512}.png and public/apple-touch-icon.png —
// the same rounded-square "H" as the in-app brand mark, in the app's orange
// (--color-primary, #f97316) rather than the extension's indigo.
//
// Same hand-rolled PNG encoder as extension/scripts/generate-icons.mjs, so
// icon generation stays dependency-free. Re-run with
// `node scripts/generate-app-icons.mjs` after changing the mark.
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const BG = [249, 115, 22, 255]; // #f97316, matches --color-primary and <meta theme-color>
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
      px.set(color, (y * size + x) * 4);
    }
  }
}

/** `square: true` fills the corners — iOS masks apple-touch-icon itself and looks wrong with transparency. */
function makeIcon(size, { square = false } = {}) {
  const px = new Uint8Array(size * size * 4);
  const radius = square ? 0 : size * 0.22;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (roundedRectContains(x, y, size, radius)) px.set(BG, (y * size + x) * 4);
    }
  }

  const barW = Math.max(1, Math.round(size * 0.13));
  const barH = Math.round(size * 0.5);
  const top = Math.round((size - barH) / 2);
  const leftX = Math.round(size * 0.28);
  const rightX = Math.round(size * 0.72 - barW);
  const midY = Math.round(size / 2 - barW / 2);

  drawRect(px, size, leftX, top, barW, barH, FG);
  drawRect(px, size, rightX, top, barW, barH, FG);
  drawRect(px, size, leftX, midY, rightX + barW - leftX, barW, FG);

  return px;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData) >>> 0, 0);
  return Buffer.concat([len, typeAndData, crc]);
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

fs.mkdirSync(path.join(PUBLIC_DIR, "icons"), { recursive: true });

for (const size of [192, 512]) {
  const out = path.join(PUBLIC_DIR, "icons", `icon-${size}.png`);
  fs.writeFileSync(out, encodePNG(makeIcon(size), size));
  console.log(`wrote ${out}`);
}

const appleOut = path.join(PUBLIC_DIR, "apple-touch-icon.png");
fs.writeFileSync(appleOut, encodePNG(makeIcon(180, { square: true }), 180));
console.log(`wrote ${appleOut}`);
