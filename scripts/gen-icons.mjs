// Генерация производных иконок PWA из мастера assets/icon/icon-512.png.
//
// Зачем свой кодек: в облачной песочнице нет ImageMagick/sharp/PIL, а нам нужны
// просто даунскейлы мастер-иконки. Мастер — 8-bit RGBA PNG без интерлейса, так что
// хватает минимального декодера/энкодера на встроенном zlib.
//
// Выдаёт:
//   icon-192.png            — «any» 192×192 (требование установки в Chrome/Android)
//   icon-180.png            — apple-touch-icon 180×180 (iOS берёт выделенный размер)
//   icon-maskable-512.png   — maskable с safe-zone: арт ужат до 80% на фоне bg
//   icon-maskable-192.png   — то же, 192×192
//
// Запуск: node scripts/gen-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import zlib from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const ICON = join(HERE, '..', 'assets', 'icon');
const BG = [0x11, 0x0e, 0x18, 0xff];   // manifest background_color #110e18

// ---- CRC32 (для чанков PNG) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---- декодер: PNG (8-bit, colorType 6 RGBA, без интерлейса) → {w,h,data:RGBA} ----
function decode(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('не PNG');
  let off = 8, w = 0, h = 0, colorType = 0, bitDepth = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
      if (data[12] !== 0) throw new Error('интерлейс не поддержан');
    } else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || colorType !== 6) throw new Error(`нужен 8-bit RGBA (got bd=${bitDepth} ct=${colorType})`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let p = 0;
  const pae = (a, b, c) => { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < h; y++) {
    const ft = raw[p++];
    for (let x = 0; x < stride; x++) {
      const v = raw[p++];
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let r;
      if (ft === 0) r = v; else if (ft === 1) r = v + a; else if (ft === 2) r = v + b;
      else if (ft === 3) r = v + ((a + b) >> 1); else if (ft === 4) r = v + pae(a, b, c);
      else throw new Error('неизвестный фильтр ' + ft);
      out[y * stride + x] = r & 0xff;
    }
  }
  return { w, h, data: out };
}

// ---- энкодер: {w,h,data:RGBA} → PNG buffer (фильтр 0) ----
function encode(img) {
  const { w, h, data } = img, stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    data.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const comp = zlib.deflateSync(raw, { level: 9 });
  const chunk = (type, payload) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(payload.length, 0);
    const tb = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([tb, payload])), 0);
    return Buffer.concat([len, tb, payload, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', comp), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- box-даунскейл src → (tw,th) ----
function resize(src, tw, th) {
  const { w: sw, h: sh, data } = src, out = Buffer.alloc(tw * th * 4);
  for (let ty = 0; ty < th; ty++) {
    const y0 = Math.floor(ty * sh / th), y1 = Math.max(y0 + 1, Math.floor((ty + 1) * sh / th));
    for (let tx = 0; tx < tw; tx++) {
      const x0 = Math.floor(tx * sw / tw), x1 = Math.max(x0 + 1, Math.floor((tx + 1) * sw / tw));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * sw + x) * 4; r += data[i]; g += data[i + 1]; b += data[i + 2]; a += data[i + 3]; n++;
      }
      const o = (ty * tw + tx) * 4;
      out[o] = (r / n) | 0; out[o + 1] = (g / n) | 0; out[o + 2] = (b / n) | 0; out[o + 3] = (a / n) | 0;
    }
  }
  return { w: tw, h: th, data: out };
}

// ---- maskable: арт масштабируем до `inner`, центрируем на фоне bg (safe-zone) ----
function maskable(src, size, scale = 0.8) {
  const inner = Math.round(size * scale);
  const art = resize(src, inner, inner);
  const out = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) { const o = i * 4; out[o] = BG[0]; out[o + 1] = BG[1]; out[o + 2] = BG[2]; out[o + 3] = BG[3]; }
  const off = Math.floor((size - inner) / 2);
  for (let y = 0; y < inner; y++) for (let x = 0; x < inner; x++) {
    const si = (y * inner + x) * 4, di = ((y + off) * size + (x + off)) * 4;
    out[di] = art.data[si]; out[di + 1] = art.data[si + 1]; out[di + 2] = art.data[si + 2]; out[di + 3] = art.data[si + 3];
  }
  return { w: size, h: size, data: out };
}

const master = decode(readFileSync(join(ICON, 'icon-512.png')));
const jobs = [
  ['icon-192.png', resize(master, 192, 192)],
  ['icon-180.png', resize(master, 180, 180)],
  ['icon-maskable-512.png', maskable(master, 512)],
  ['icon-maskable-192.png', maskable(master, 192)],
];
for (const [name, img] of jobs) {
  writeFileSync(join(ICON, name), encode(img));
  console.log('wrote', name, img.w + 'x' + img.h);
}
