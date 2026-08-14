// Generates every Handy mark from one drawing routine:
//
//   assets/icon.png             launcher icon (orange tile, white H)
//   assets/icon_foreground.png  adaptive foreground (H on transparency)
//   assets/splash.png           splash mark
//   android/.../drawable-*/ic_notification.png
//                               status-bar silhouette, white on transparent
//
// The notification icon is NOT the launcher icon: Android masks status-bar
// icons to their alpha channel, so anything with a coloured background renders
// as a solid white blob. It needs its own white-on-transparent artwork, and
// its own padding, because the system draws it small.
//
// Hand-rolled PNG encoder so this needs no image library, and 4x supersampling
// so the rounded caps come out smooth. Re-run with `node tool/make_icon.mjs`,
// then `dart run flutter_launcher_icons` and `dart run flutter_native_splash:create`.
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const assets = path.join(dir, '..', 'assets');
const res = path.join(dir, '..', 'android', 'app', 'src', 'main', 'res');

const ORANGE = [249, 115, 22];
const WHITE = [255, 255, 255];

/** Supersampling factor. 4x is the point where the curves stop looking stepped. */
const SS = 4;

/** Distance from a point to a line segment — the basis for every rounded bar. */
function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * The H, as three rounded bars.
 *
 * Drawn from segments rather than rectangles so the stroke ends are true
 * semicircles — that roundness is what stops the mark reading as a default
 * system font glyph.
 *
 * @param inset fraction of the canvas to keep clear around the mark. The
 *   notification icon needs a lot (Android draws it small inside its own
 *   padding); the launcher icon needs little.
 */
function markCoverage(x, y, size, inset) {
  const box = size * (1 - 2 * inset);
  const originX = size * inset;
  const originY = size * inset;

  const stroke = box * 0.19;
  const radius = stroke / 2;

  const left = originX + box * 0.22;
  const right = originX + box * 0.78;
  const top = originY + box * 0.13;
  const bottom = originY + box * 0.87;
  const middle = originY + box * 0.5;

  const bars = [
    [left, top, left, bottom], // left stem
    [right, top, right, bottom], // right stem
    [left, middle, right, middle], // crossbar
  ];

  let nearest = Infinity;
  for (const [x1, y1, x2, y2] of bars) {
    nearest = Math.min(nearest, distanceToSegment(x, y, x1, y1, x2, y2));
  }
  return nearest <= radius;
}

function roundedSquareCoverage(x, y, size) {
  const r = size * 0.235;
  const inner = size - r;
  const cx = Math.min(Math.max(x, r), inner);
  const cy = Math.min(Math.max(y, r), inner);
  return Math.hypot(x - cx, y - cy) <= r;
}

/**
 * @param background null leaves the tile transparent — what the adaptive
 *   foreground and the notification silhouette both need.
 */
function render(size, { background, mark, inset = 0.0 }) {
  const px = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgHits = 0;
      let markHits = 0;

      // Supersample: count how many sub-pixels land inside each shape, then
      // use the ratio as coverage. This is the anti-aliasing.
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px1 = x + (sx + 0.5) / SS;
          const py1 = y + (sy + 0.5) / SS;
          if (background && roundedSquareCoverage(px1, py1, size)) bgHits++;
          if (markCoverage(px1, py1, size, inset)) markHits++;
        }
      }

      const total = SS * SS;
      const bgAlpha = background ? bgHits / total : 0;
      const markAlpha = markHits / total;
      const idx = (y * size + x) * 4;

      if (markAlpha > 0) {
        // Mark over background: composite so the edge blends into the tile
        // rather than onto transparency.
        const base = background ?? mark;
        for (let c = 0; c < 3; c++) {
          px[idx + c] = Math.round(mark[c] * markAlpha + base[c] * (1 - markAlpha));
        }
        px[idx + 3] = Math.round(255 * Math.max(markAlpha, bgAlpha));
      } else if (bgAlpha > 0) {
        px.set(background, idx);
        px[idx + 3] = Math.round(255 * bgAlpha);
      }
    }
  }

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

function write(file, px, size) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encodePNG(px, size));
  console.log('wrote', path.relative(path.join(dir, '..'), file));
}

fs.mkdirSync(assets, { recursive: true });

// Launcher icon: mark on the orange tile.
write(path.join(assets, 'icon.png'), render(1024, { background: ORANGE, mark: WHITE, inset: 0.16 }), 1024);

// Adaptive foreground: the launcher masks and scales it, so the mark sits
// smaller inside a transparent square to survive the crop.
write(
  path.join(assets, 'icon_foreground.png'),
  render(1024, { background: null, mark: WHITE, inset: 0.28 }),
  1024,
);

// Splash: orange ground is painted by the splash config, so the mark alone.
write(path.join(assets, 'splash.png'), render(512, { background: null, mark: WHITE, inset: 0.2 }), 512);

// Status-bar silhouette, per density. Generous inset: Android draws these
// small and adds no padding of its own.
for (const [density, size] of [
  ['mdpi', 24],
  ['hdpi', 36],
  ['xhdpi', 48],
  ['xxhdpi', 72],
  ['xxxhdpi', 96],
]) {
  write(
    path.join(res, `drawable-${density}`, 'ic_notification.png'),
    render(size, { background: null, mark: WHITE, inset: 0.14 }),
    size,
  );
}
