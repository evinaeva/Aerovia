// Generate a small TEST set of zone skins for the tuning workbench («Скины» tab).
// These are deliberate placeholder overlays (a translucent neon-tinted fill, a solid
// border and an "X" so they read as "test, not final art") — their only job is to
// prove the zone-skin selector actually switches images and replaces the baseline
// «Неон» (the default, no-overlay look the engine draws itself).
//
// Two skins per zone — «Тест A» (cyan) and «Тест B» (magenta) — so you can switch
// default → A → B → default and see each take over the zone. For the hangar each of
// the five service states gets its own fill colour, so the hangar-state selector is
// visibly switching too.
//
// Run with `node tools/gen-test-skins.mjs`, then `npm run scan:skins` (or
// `npm run build:tuning`, which scans as a side-effect) to refresh index.json.
// Sizes follow docs/design/skins/ZONES.md; the engine stretches without resampling,
// so exact dimensions don't matter for a placeholder — we match the brief anyway.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKINS = join(ROOT, 'assets/skins');

/* ---- minimal RGBA PNG encoder (no deps) ---- */
const CRC = (() => { const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  return t; })();
const crc32 = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function png(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;   // 8-bit, RGBA
  const stride = w * 4, raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
// Translucent `fill`, solid `edge` border + an "X" so it reads as a placeholder.
function testTile(w, h, fill, edge) {
  const buf = Buffer.alloc(w * h * 4);
  const bw = Math.max(4, Math.round(Math.min(w, h) * 0.05));   // border thickness
  const t = 3 / Math.min(w, h);                                // diagonal half-width (normalized)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = x / (w - 1), ny = y / (h - 1);
    const onEdge = x < bw || y < bw || x >= w - bw || y >= h - bw;
    const onDiag = Math.abs(nx - ny) < t || Math.abs(nx - (1 - ny)) < t;
    const c = (onEdge || onDiag) ? edge : fill;
    const i = (y * w + x) * 4;
    buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = c[3];
  }
  return png(w, h, buf);
}

const CYAN = [0, 229, 255, 255], MAGENTA = [224, 64, 251, 255];
const a = (rgb, alpha) => [rgb[0], rgb[1], rgb[2], alpha];
// Per-service hangar fills (matches the ZONES brief's accent colours) so switching
// the hangar state visibly changes the picture.
const HANGAR_FILL = {
  fuel:   a([0, 229, 255], 120), board:  a([224, 64, 251], 120), repair: a([255, 215, 64], 120),
  deice:  a([128, 216, 255], 120), locked: a([120, 140, 160], 130),
};

// zone → { size:[w,h], single:bool, states:[…] }
const ZONES = {
  hangar:     { size: [256, 256],   states: ['fuel', 'board', 'repair', 'deice', 'locked'] },
  apron:      { size: [512, 512],   states: ['default'] },
  runway:     { size: [512, 192],   states: ['default'] },
  plane:      { size: [256, 256],   states: ['default'] },
  arrival:    { size: [512, 512],   states: ['default'] },
  background: { size: [1920, 1080], states: ['default'] },
};
// hangar state → png filename (matches the «Неон» baseline naming).
const HANGAR_FILE = { fuel: 'bay-fuel.png', board: 'bay-board.png', repair: 'bay-repair.png', deice: 'bay-deice.png', locked: 'bay-locked.png' };
const ZONE_FILE = { apron: 'apron.png', runway: 'runway.png', plane: 'plane.png', arrival: 'arrival.png', background: 'background.png' };

const SKINS_DEF = [
  { name: 'test-a', label: 'Тест A', edge: CYAN },
  { name: 'test-b', label: 'Тест B', edge: MAGENTA },
];

let pngCount = 0;
for (const [zone, z] of Object.entries(ZONES)) {
  for (const def of SKINS_DEF) {
    const dir = join(SKINS, zone, def.name);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const [w, h] = z.size;
    const states = {};
    for (const st of z.states) {
      const file = zone === 'hangar' ? HANGAR_FILE[st] : ZONE_FILE[zone];
      // hangar: per-service fill; other zones: skin-themed translucent fill.
      const fill = zone === 'hangar' ? HANGAR_FILL[st] : a(def.edge, 70);
      writeFileSync(join(dir, file), testTile(w, h, fill, def.edge));
      states[st] = file;
      pngCount++;
    }
    const meta = { id: `${zone}-${def.name}`, label: def.label, states };
    writeFileSync(join(dir, 'skin.json'), JSON.stringify(meta, null, 2) + '\n');
  }
}
console.log(`gen-test-skins: wrote ${pngCount} png across ${Object.keys(ZONES).length} zones × ${SKINS_DEF.length} skins`);
