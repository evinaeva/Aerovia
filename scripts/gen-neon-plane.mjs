// One-off script: convert reference plane PNG → neon-styled sprite
// Usage: node scripts/gen-neon-plane.mjs
import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..');
const SRC   = join(ROOT, 'assets', 'sprites', 'neon', 'plane_src_reference.png');
const NEON  = join(ROOT, 'assets', 'sprites', 'neon');
const SIZE  = 256;

// ── Flood-fill background removal ─────────────────────────────────────────
function floodFillBackground(data, w, h, channels, thresh = 238) {
  // Mark pixels as "background" starting from all 4 edges via BFS.
  // A pixel is background if it's bright (nearly white) AND low-saturation.
  const mask = new Uint8Array(w * h); // 1 = background
  const queue = [];

  function isWhiteish(idx) {
    const r = data[idx], g = data[idx+1], b = data[idx+2];
    const bright = (r + g + b) / 3;
    const maxC = Math.max(r, g, b);
    const sat = maxC > 0 ? (maxC - Math.min(r, g, b)) / maxC : 0;
    return bright > thresh && sat < 0.20;
  }

  // Seed from all border pixels
  for (let x = 0; x < w; x++) {
    for (const y of [0, h-1]) {
      const pi = y * w + x;
      if (!mask[pi] && isWhiteish(pi * channels)) { mask[pi] = 1; queue.push(pi); }
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w-1]) {
      const pi = y * w + x;
      if (!mask[pi] && isWhiteish(pi * channels)) { mask[pi] = 1; queue.push(pi); }
    }
  }

  // BFS
  let qi = 0;
  while (qi < queue.length) {
    const pi = queue[qi++];
    const px = pi % w, py = Math.floor(pi / w);
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nx = px+dx, ny = py+dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (!mask[ni] && isWhiteish(ni * channels)) { mask[ni] = 1; queue.push(ni); }
    }
  }

  return mask; // 1 = transparent background
}

// ── Main processing ────────────────────────────────────────────────────────
async function buildNeonSprite(srcPath, outPath) {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h, channels: ch } = info;
  const bgMask = floodFillBackground(data, w, h, ch, 236);

  const out = Buffer.alloc(w * h * 4);

  for (let i = 0; i < w * h; i++) {
    const bi = i * ch;
    const r = data[bi], g = data[bi+1], b = data[bi+2];

    if (bgMask[i]) {
      out[i*4+3] = 0; // transparent
      continue;
    }

    // ── neon colour conversion ──
    // Classify pixel:
    //   Engine nacelle: clearly blue (b >> r by >25)
    //   Window/cockpit: very bright + slightly blue tint
    //   Wing/body:      grey, moderate brightness
    let nr, ng, nb, na;

    const maxC = Math.max(r, g, b);
    const sat  = maxC > 0 ? (maxC - Math.min(r,g,b)) / maxC : 0;
    const bright = (r + g + b) / 3;

    if (b > r + 25 && b > 100) {
      // Engine → strong neon cyan
      nr = 10;
      ng = Math.min(255, Math.round(g * 0.6 + 100));
      nb = Math.min(255, Math.round(b * 0.7 + 120));
    } else if (bright > 190 && sat < 0.12) {
      // Body highlight / fuselage → bright neon blue-white
      nr = Math.min(255, Math.round(r * 0.70 + 55));
      ng = Math.min(255, Math.round(g * 0.78 + 50));
      nb = Math.min(255, Math.round(b * 0.90 + 70));
    } else {
      // Wing shadow / general body → medium neon blue-grey
      nr = Math.min(255, Math.round(r * 0.55 + 40));
      ng = Math.min(255, Math.round(g * 0.65 + 45));
      nb = Math.min(255, Math.round(b * 0.80 + 70));
    }

    // alpha: feather hard edges slightly
    const edgeAlpha = bgMask[i] === 0 ? 255 : 0;
    na = edgeAlpha;

    out[i*4+0] = nr;
    out[i*4+1] = ng;
    out[i*4+2] = nb;
    out[i*4+3] = na;
  }

  const tintedSharp = sharp(out, { raw: { width: w, height: h, channels: 4 } }).png();
  const tintedBuf   = await tintedSharp.toBuffer();

  // Glow layers: outer (wide, softer) + inner (tight, brighter)
  const glowOuter = await sharp(tintedBuf)
    .blur(24)
    .tint({ r: 0, g: 200, b: 255 })
    .modulate({ brightness: 3.5 })
    .toBuffer();

  const glowInner = await sharp(tintedBuf)
    .blur(8)
    .tint({ r: 30, g: 230, b: 255 })
    .modulate({ brightness: 2.5 })
    .toBuffer();

  // Composite: outer glow → inner glow → sharp tinted plane
  const compositedBuf = await sharp(glowOuter)
    .composite([
      { input: glowInner, blend: 'screen' },
      { input: tintedBuf, blend: 'over'   },
    ])
    .toBuffer();

  await sharp(compositedBuf)
    .resize(SIZE, SIZE, {
      kernel: sharp.kernel.lanczos3,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outPath);

  console.log(`✓ ${outPath}`);
}

// ── Variants ───────────────────────────────────────────────────────────────
// ВНИМАНИЕ: ливрейные варианты сейчас НЕ поставляются как отдельные файлы — в рантайме
// они переиспользуют базовый plane.png (см. PLANE_LIVERY_FALLBACK в src/game/02-sprites.ts
// и docs/memory-android17.md), чтобы не тащить дубликаты битмапов. Если регенерируешь их
// как РАЗЛИЧАЮЩИЕСЯ ливреи — верни их id в assets/sprites/neon/manifest.json: фолбэк тогда
// автоматически предпочтёт собственный файл варианта.
await buildNeonSprite(SRC, join(NEON, 'plane.png'));

// VIP: gold tint
const baseBuf = await sharp(join(NEON, 'plane.png')).toBuffer();
for (const [id, tint] of [
  ['plane-vip',       { r: 255, g: 200, b: 40  }],
  ['plane-emergency', { r: 255, g: 110, b: 50  }],
  ['plane-medevac',   { r: 255, g: 255, b: 255 }],
]) {
  const buf = await sharp(baseBuf).tint(tint).toBuffer();
  writeFileSync(join(NEON, `${id}.png`), buf);
  console.log(`✓ ${id}.png`);
}

console.log('Done.');
