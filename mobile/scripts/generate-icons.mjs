// Generates the app icon, Android adaptive icon layers, splash mark, notification icon and favicon as PNGs.
// Pure Node (zlib + a tiny rasterizer), so it runs anywhere: `node scripts/generate-icons.mjs` from mobile/.
// Design: the Christmas Market night sky — a gold eight-point star with a soft glow on midnight blue,
// ringed by a thin gold circle. Replace with final brand artwork before store submission (see BUILD_GUIDE.md).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets');

const MIDNIGHT = [11, 20, 48];
const DEEP = [6, 11, 29];
const GOLD = [242, 196, 109];
const GOLD_HI = [255, 241, 201];
const GOLD_LO = [168, 122, 28];

// ── PNG encoding ──
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ── geometry ──
const starPoly = (cx, cy, r, inner, points) => Array.from({ length: points * 2 }, (_, i) => {
  const rr = i % 2 ? r * inner : r; const a = (i * Math.PI) / points - Math.PI / 2;
  return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
});
function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]; const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/**
 * Renders the mark into a w×h canvas. opts: { bg: 'solid'|'none', scale (mark size 0..1), mono (white silhouette) }.
 * 4×4 supersampling per pixel for smooth edges.
 */
function render(w, h, { bg = 'solid', scale = 0.62, mono = false, ring = true } = {}) {
  const buf = Buffer.alloc(w * h * 4);
  const cx = w / 2; const cy = h / 2; const R = (Math.min(w, h) / 2) * scale;
  const big = starPoly(cx, cy, R, 0.42, 8);
  const inner = starPoly(cx, cy, R * 0.52, 0.5, 8);
  const SS = 4;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = [0, 0, 0]; let alpha = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS; const py = y + (sy + 0.5) / SS;
          const d = Math.hypot(px - cx, py - cy);
          let col = null; let a = 0;
          if (bg === 'solid') {
            const t = Math.min(1, d / (Math.max(w, h) * 0.75));
            col = mix(MIDNIGHT, DEEP, t); a = 1;
            const glow = Math.max(0, 1 - d / (R * 1.6));
            col = mix(col, GOLD, glow * glow * 0.28);
          }
          if (ring && Math.abs(d - R * 1.32) < Math.max(1.2, R * 0.022)) { col = mono ? [255, 255, 255] : GOLD_LO; a = 1; }
          if (inPoly(px, py, big)) {
            const t = Math.max(0, Math.min(1, (px - cx + py - cy + R * 1.42) / (2.84 * R)));
            col = mono ? [255, 255, 255] : (t < 0.5 ? mix(GOLD_HI, GOLD, t * 2) : mix(GOLD, GOLD_LO, (t - 0.5) * 2)); a = 1;
            if (!mono && inPoly(px, py, inner)) col = mix(col, GOLD_HI, 0.55);
            if (!mono && d < R * 0.12) col = [255, 255, 255];
          }
          if (col) { acc = acc.map((v, i) => v + col[i] * a); alpha += a; }
        }
      }
      const n = SS * SS; const o = (y * w + x) * 4;
      if (alpha > 0) { buf[o] = Math.round(acc[0] / alpha); buf[o + 1] = Math.round(acc[1] / alpha); buf[o + 2] = Math.round(acc[2] / alpha); }
      buf[o + 3] = Math.round((alpha / n) * 255);
    }
  }
  return png(w, h, buf);
}

const jobs = [
  ['icon.png', 1024, 1024, { bg: 'solid', scale: 0.56 }],
  ['android-icon-background.png', 512, 512, { bg: 'solid', scale: 0, ring: false }],
  ['android-icon-foreground.png', 512, 512, { bg: 'none', scale: 0.4 }],
  ['android-icon-monochrome.png', 432, 432, { bg: 'none', scale: 0.4, mono: true }],
  ['splash-icon.png', 512, 512, { bg: 'none', scale: 0.62 }],
  ['notification-icon.png', 96, 96, { bg: 'none', scale: 0.62, mono: true, ring: false }],
  ['favicon.png', 48, 48, { bg: 'solid', scale: 0.6, ring: false }],
];
for (const [name, w, h, opts] of jobs) {
  fs.writeFileSync(path.join(out, name), render(w, h, opts));
  console.log('wrote assets/' + name);
}
