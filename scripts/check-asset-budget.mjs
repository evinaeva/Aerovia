// CI-гард бюджета памяти (Android 17). Делает правила docs/memory-android17.md
// машинно-обязательными: сканирует СОБРАННЫЙ бандл www/assets и падает, если он
// превышает байт-бюджет, тащит слишком крупный битмап или дубликаты по хэшу.
//
//   npm run build:www            # собрать www/ (гард сканирует именно его)
//   node scripts/check-asset-budget.mjs
//
// Пороги («потолки») ниже — защита от РЕГРЕССА, а не цель: правило «потолок только
// опускается». Любой рост требует явного обоснования в описании PR и правки чисел здесь.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WWW_ASSETS = join(ROOT, 'www', 'assets');

// ── Пороги (см. таблицу «Бюджеты» в docs/memory-android17.md) ──────────────────
const MB = 1024 * 1024;
const CEIL_TOTAL = 19 * MB;   // суммарный размер www/assets
const CEIL_FILE  = 2.3 * MB;  // один битмап на диске
const MAX_PX     = 2048;      // большая сторона битмапа (в доке — «по возможности» → warning)

if (!existsSync(WWW_ASSETS)) {
  console.error('check-asset-budget: www/assets не найден — сначала `npm run build:www`.');
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// Размеры PNG из IHDR (первый чанк) — без сторонних зависимостей.
function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const files = walk(WWW_ASSETS);
const errors = [];
const warnings = [];
let total = 0;
const byHash = new Map();

for (const f of files) {
  const rel = relative(WWW_ASSETS, f).split(sep).join('/');
  const buf = readFileSync(f);
  total += buf.length;

  // дубликаты по содержимому
  const hash = createHash('sha256').update(buf).digest('hex');
  if (!byHash.has(hash)) byHash.set(hash, []);
  byHash.get(hash).push(rel);

  if (buf.length > CEIL_FILE)
    errors.push(`крупный файл: ${rel} — ${(buf.length / MB).toFixed(2)} МБ > ${(CEIL_FILE / MB).toFixed(1)} МБ`);

  if (f.toLowerCase().endsWith('.png')) {
    const d = pngSize(buf);
    if (d && Math.max(d.w, d.h) > MAX_PX)
      warnings.push(`крупный битмап: ${rel} — ${d.w}×${d.h} px > ${MAX_PX} px по большей стороне`);
  }
}

const dupes = [...byHash.values()].filter((g) => g.length > 1);

if (total > CEIL_TOTAL)
  errors.push(`суммарный размер www/assets — ${(total / MB).toFixed(2)} МБ > потолок ${(CEIL_TOTAL / MB).toFixed(0)} МБ`);

for (const g of dupes)
  errors.push(`дубликаты по хэшу (держать один файл, варианты — тинтом): ${g.join(', ')}`);

// ── Отчёт ──────────────────────────────────────────────────────────────────────
console.log(`www/assets: ${files.length} файлов, ${(total / MB).toFixed(2)} МБ (потолок ${(CEIL_TOTAL / MB).toFixed(0)} МБ)`);
for (const w of warnings) console.log(`  ⚠ ${w}`);

if (errors.length) {
  console.error('\nБюджет памяти НЕ соблюдён (см. docs/memory-android17.md):');
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log('✓ бюджет памяти соблюдён');
