/**
 * Generates the PWA icons as PNGs with no image dependencies.
 *
 * Draws the same mark as public/favicon.svg — a rounded teal tile with a
 * speech bubble — using signed-distance fields for anti-aliasing, then
 * encodes the raw pixels as PNG via node:zlib.
 *
 * Run: node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

const TEAL = [0x3d, 0x8b, 0x85];
const CREAM = [0xfa, 0xf7, 0xf2];

/** Distance from a point to a rounded rectangle (negative = inside). */
function roundedRectSdf(px, py, cx, cy, halfW, halfH, radius) {
  const dx = Math.abs(px - cx) - (halfW - radius);
  const dy = Math.abs(py - cy) - (halfH - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - radius;
}

/** Distance to the bubble's triangular tail. */
function triangleSdf(px, py, ax, ay, bx, by, cx, cy) {
  const sign = (x1, y1, x2, y2, x3, y3) => (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
  const d1 = sign(px, py, ax, ay, bx, by);
  const d2 = sign(px, py, bx, by, cx, cy);
  const d3 = sign(px, py, cx, cy, ax, ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return hasNeg && hasPos ? 1 : -1; // inside => negative
}

function renderIcon(size) {
  const s = size / 64; // design grid is 64x64, matching the SVG
  const pixels = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;

      // Background tile: full-bleed rounded square.
      const tile = roundedRectSdf(px, py, size / 2, size / 2, size / 2, size / 2, 16 * s);
      const tileAlpha = clamp01(0.5 - tile);

      // Speech bubble body + tail.
      const body = roundedRectSdf(px, py, 32 * s, 34 * s, 16 * s, 10 * s, 4 * s);
      const tail = triangleSdf(px, py, 24 * s, 42 * s, 32 * s, 42 * s, 24 * s, 51 * s);
      const bubbleAlpha = Math.max(clamp01(0.5 - body), tail < 0 ? 1 : 0);

      const [r, g, b] = mix(TEAL, CREAM, bubbleAlpha);
      const offset = (y * size + x) * 4;
      pixels[offset] = r;
      pixels[offset + 1] = g;
      pixels[offset + 2] = b;
      pixels[offset + 3] = Math.round(tileAlpha * 255);
    }
  }

  return pixels;
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const mix = (a, b, t) => a.map((channel, i) => Math.round(channel + (b[i] - channel) * t));

// --- Minimal PNG encoder -----------------------------------------------

function crc32(buf) {
  let crc = ~0;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10-12 default to 0: deflate, adaptive filtering, no interlace.

  // Prefix each scanline with filter type 0 (none).
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [192, 512]) {
  const file = join(OUT_DIR, `icon-${size}.png`);
  writeFileSync(file, encodePng(size, renderIcon(size)));
  console.log(`wrote ${file}`);
}
