// Generates public/og-image.png — the 1200×630 card shown when the landing
// page is shared on WhatsApp, Twitter, Slack or anywhere else that reads
// Open Graph tags. Re-run with `node scripts/generate-og-image.mjs`.
//
// Same hand-rolled, dependency-free PNG encoder as generate-app-icons.mjs,
// widened to non-square images. Type is drawn from stroked line segments
// rather than a font file, because there is no font renderer here and adding
// one (canvas, sharp, resvg) would put a native binary in the toolchain for a
// single 40KB image.
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const W = 1200;
const H = 630;

const BG = [7, 9, 15];
const ORANGE = [249, 115, 22];
const ORANGE_LIGHT = [251, 146, 60];
const WHITE = [245, 247, 250];
const MUTED = [152, 162, 179];

// ---------------------------------------------------------------- canvas

const px = new Uint8Array(W * H * 4);

function put(x, y, [r, g, b], alpha) {
  if (alpha <= 0 || x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  const a = Math.min(1, alpha);
  px[i] = px[i] * (1 - a) + r * a;
  px[i + 1] = px[i + 1] * (1 - a) + g * a;
  px[i + 2] = px[i + 2] * (1 - a) + b * a;
  px[i + 3] = 255;
}

function fill(color) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, color, 1);
}

/** Soft radial light, the same trick the hero section uses in CSS. */
function glow(cx, cy, radius, color, strength) {
  for (let y = Math.max(0, cy - radius); y < Math.min(H, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x < Math.min(W, cx + radius); x++) {
      const d = Math.hypot(x - cx, y - cy) / radius;
      if (d >= 1) continue;
      // Smooth falloff — a linear one leaves a visible edge.
      put(x, y, color, strength * (1 - d) ** 2.2);
    }
  }
}

/** Distance from a point to a line segment; the basis of every stroke here. */
function distToSeg(px_, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px_ - x0) * dx + (py - y0) * dy) / lenSq));
  return Math.hypot(px_ - (x0 + t * dx), py - (y0 + t * dy));
}

/** Round-capped stroke, antialiased by the sub-pixel remainder of the distance. */
function stroke(x0, y0, x1, y1, thickness, color) {
  const half = thickness / 2;
  const pad = Math.ceil(half) + 2;
  const minX = Math.floor(Math.min(x0, x1)) - pad;
  const maxX = Math.ceil(Math.max(x0, x1)) + pad;
  const minY = Math.floor(Math.min(y0, y1)) - pad;
  const maxY = Math.ceil(Math.max(y0, y1)) + pad;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d = distToSeg(x + 0.5, y + 0.5, x0, y0, x1, y1);
      put(x, y, color, Math.max(0, Math.min(1, half + 0.5 - d)));
    }
  }
}

function roundedRect(x0, y0, w, h, r, color) {
  for (let y = Math.floor(y0); y < y0 + h; y++) {
    for (let x = Math.floor(x0); x < x0 + w; x++) {
      const dx = Math.max(x0 + r - x, 0, x - (x0 + w - r - 1));
      const dy = Math.max(y0 + r - y, 0, y - (y0 + h - r - 1));
      const d = Math.hypot(dx, dy);
      put(x, y, color, Math.max(0, Math.min(1, r + 0.5 - d)));
    }
  }
}

// ------------------------------------------------------------------ type

/**
 * Uppercase letterforms as stroke segments in a 0..1 box, y pointing down.
 * Curves are polygonal — at the sizes used here the flats are invisible, and
 * it keeps each glyph to a handful of numbers.
 */
const GLYPHS = {
  A: [[0, 1, 0.5, 0], [0.5, 0, 1, 1], [0.16, 0.68, 0.84, 0.68]],
  B: [[0, 0, 0, 1], [0, 0, 0.6, 0], [0.6, 0, 0.95, 0.16], [0.95, 0.16, 0.95, 0.32], [0.95, 0.32, 0.6, 0.48], [0, 0.48, 0.6, 0.48], [0.6, 0.48, 1, 0.66], [1, 0.66, 1, 0.84], [1, 0.84, 0.6, 1], [0, 1, 0.6, 1]],
  C: [[0.96, 0.2, 0.62, 0.02], [0.62, 0.02, 0.24, 0.16], [0.24, 0.16, 0.06, 0.5], [0.06, 0.5, 0.24, 0.84], [0.24, 0.84, 0.62, 0.98], [0.62, 0.98, 0.96, 0.8]],
  D: [[0, 0, 0, 1], [0, 0, 0.52, 0], [0.52, 0, 1, 0.34], [1, 0.34, 1, 0.66], [1, 0.66, 0.52, 1], [0, 1, 0.52, 1]],
  E: [[0, 0, 0, 1], [0, 0, 0.9, 0], [0, 0.5, 0.74, 0.5], [0, 1, 0.9, 1]],
  F: [[0, 0, 0, 1], [0, 0, 0.9, 0], [0, 0.5, 0.74, 0.5]],
  G: [[0.96, 0.2, 0.62, 0.02], [0.62, 0.02, 0.24, 0.16], [0.24, 0.16, 0.06, 0.5], [0.06, 0.5, 0.24, 0.84], [0.24, 0.84, 0.62, 0.98], [0.62, 0.98, 0.96, 0.8], [0.96, 0.8, 0.96, 0.54], [0.96, 0.54, 0.58, 0.54]],
  H: [[0, 0, 0, 1], [1, 0, 1, 1], [0, 0.5, 1, 0.5]],
  I: [[0.5, 0, 0.5, 1]],
  J: [[0.88, 0, 0.88, 0.74], [0.88, 0.74, 0.58, 0.99], [0.58, 0.99, 0.2, 0.84]],
  K: [[0, 0, 0, 1], [0.98, 0, 0.06, 0.56], [0.34, 0.38, 1, 1]],
  L: [[0, 0, 0, 1], [0, 1, 0.88, 1]],
  M: [[0, 1, 0, 0], [0, 0, 0.5, 0.62], [0.5, 0.62, 1, 0], [1, 0, 1, 1]],
  N: [[0, 1, 0, 0], [0, 0, 1, 1], [1, 1, 1, 0]],
  O: [[0.5, 0.02, 0.16, 0.2], [0.16, 0.2, 0.04, 0.5], [0.04, 0.5, 0.16, 0.8], [0.16, 0.8, 0.5, 0.98], [0.5, 0.98, 0.84, 0.8], [0.84, 0.8, 0.96, 0.5], [0.96, 0.5, 0.84, 0.2], [0.84, 0.2, 0.5, 0.02]],
  P: [[0, 0, 0, 1], [0, 0, 0.6, 0], [0.6, 0, 1, 0.2], [1, 0.2, 1, 0.36], [1, 0.36, 0.6, 0.56], [0, 0.56, 0.6, 0.56]],
  Q: [[0.5, 0.02, 0.16, 0.2], [0.16, 0.2, 0.04, 0.5], [0.04, 0.5, 0.16, 0.8], [0.16, 0.8, 0.5, 0.98], [0.5, 0.98, 0.84, 0.8], [0.84, 0.8, 0.96, 0.5], [0.96, 0.5, 0.84, 0.2], [0.84, 0.2, 0.5, 0.02], [0.6, 0.72, 1, 1.06]],
  R: [[0, 0, 0, 1], [0, 0, 0.6, 0], [0.6, 0, 1, 0.2], [1, 0.2, 1, 0.36], [1, 0.36, 0.6, 0.56], [0, 0.56, 0.6, 0.56], [0.46, 0.56, 1, 1]],
  S: [[0.95, 0.18, 0.6, 0.01], [0.6, 0.01, 0.2, 0.11], [0.2, 0.11, 0.1, 0.33], [0.1, 0.33, 0.52, 0.48], [0.52, 0.48, 0.9, 0.63], [0.9, 0.63, 0.8, 0.87], [0.8, 0.87, 0.4, 0.99], [0.4, 0.99, 0.05, 0.81]],
  T: [[0, 0, 1, 0], [0.5, 0, 0.5, 1]],
  U: [[0, 0, 0, 0.68], [0, 0.68, 0.3, 0.98], [0.3, 0.98, 0.7, 0.98], [0.7, 0.98, 1, 0.68], [1, 0.68, 1, 0]],
  V: [[0, 0, 0.5, 1], [0.5, 1, 1, 0]],
  W: [[0, 0, 0.22, 1], [0.22, 1, 0.5, 0.36], [0.5, 0.36, 0.78, 1], [0.78, 1, 1, 0]],
  X: [[0, 0, 1, 1], [1, 0, 0, 1]],
  Y: [[0, 0, 0.5, 0.52], [1, 0, 0.5, 0.52], [0.5, 0.52, 0.5, 1]],
  Z: [[0, 0, 1, 0], [1, 0, 0, 1], [0, 1, 1, 1]],
  " ": [],
};

/**
 * Draws a word and returns the width it used, so callers can centre it by
 * measuring first and drawing second.
 */
function text(str, x, y, size, thickness, color, { measure = false } = {}) {
  const aspect = 0.72; // glyph box width relative to its height
  const tracking = size * 0.26;
  let cursor = x;

  for (const ch of str.toUpperCase()) {
    const glyph = GLYPHS[ch];
    // "I" is a single stroke; advancing it a full box leaves a hole in the
    // word ("AD I TYA"). Narrowing its advance is what a real font's metrics
    // would do.
    const w = ch === " " ? size * 0.34 : size * aspect * (ch === "I" ? 0.18 : 1);
    if (glyph && !measure) {
      for (const [ax, ay, bx, by] of glyph) {
        stroke(cursor + ax * w, y + ay * size, cursor + bx * w, y + by * size, thickness, color);
      }
    }
    cursor += w + tracking;
  }
  return cursor - tracking - x;
}

function centeredText(str, y, size, thickness, color) {
  const width = text(str, 0, 0, size, thickness, color, { measure: true });
  text(str, (W - width) / 2, y, size, thickness, color);
  return width;
}

// -------------------------------------------------------------- compose

fill(BG);
glow(200, 90, 620, ORANGE, 0.3);
glow(1040, 40, 520, [99, 102, 241], 0.22);

// Faint grid, matching the hero's backdrop.
for (let x = 0; x < W; x += 64) for (let y = 0; y < H; y++) put(x, y, [255, 255, 255], 0.03);
for (let y = 0; y < H; y += 64) for (let x = 0; x < W; x++) put(x, y, [255, 255, 255], 0.03);

// The app mark: the same rounded square and "H" as the icon, in orange.
const MARK = 92;
const markX = (W - MARK) / 2;
const markY = 104;
roundedRect(markX, markY, MARK, MARK, MARK * 0.28, ORANGE);
{
  const barW = MARK * 0.13;
  const barH = MARK * 0.5;
  const top = markY + (MARK - barH) / 2;
  const left = markX + MARK * 0.28;
  const right = markX + MARK * 0.72 - barW;
  roundedRect(left, top, barW, barH, 1, WHITE);
  roundedRect(right, top, barW, barH, 1, WHITE);
  roundedRect(left, markY + MARK / 2 - barW / 2, right + barW - left, barW, 1, WHITE);
}

centeredText("HANDY", 248, 96, 11, WHITE);
centeredText("YOUR ATTENDANCE", 396, 40, 5.5, ORANGE_LIGHT);
centeredText("WITH THE ANSWER ATTACHED", 456, 40, 5.5, ORANGE_LIGHT);
centeredText("FOR ADITYA UNIVERSITY STUDENTS", 546, 22, 3.2, MUTED);

// ------------------------------------------------------------- encoding

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

function encodePNG(pixels, width, height) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type: none
    Buffer.from(pixels.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const out = path.join(PUBLIC_DIR, "og-image.png");
fs.writeFileSync(out, encodePNG(px, W, H));
console.log(`wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
