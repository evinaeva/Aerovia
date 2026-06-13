// Сборка галереи скриншотов из docs/screenshots/<версия>/{main,gameplay,pause}.png.
//
// Читает снятые картинки (см. scripts/screenshots.mjs) и заголовки версий из
// CHANGELOG.md, пишет docs/screenshots/README.md — визуальную ленту прогресса,
// новые версии сверху. Безопасно перегенерировать в любой момент.
//
// Запуск: node scripts/build-gallery.mjs
import { readFile, readdir, writeFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT_ROOT = join(ROOT, 'docs', 'screenshots');
const SHOTS = [['main', 'Главный экран'], ['gameplay', 'Геймплей'], ['pause', 'Пауза']];

// версия → краткий заголовок из CHANGELOG (строки вида «## 0.22 — название»)
async function changelogTitles() {
  const titles = new Map();
  try {
    const txt = await readFile(join(ROOT, 'CHANGELOG.md'), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^##\s+(\d+\.\d+(?:\.\d+)?)\s*[—-]\s*(.+)$/);
      if (m && !titles.has(m[1])) titles.set(m[1], m[2].trim());
    }
  } catch {}
  return titles;
}

// сравнение версий по числовым компонентам (0.19.1 между 0.19 и 0.20)
function cmpVer(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

async function exists(p) { try { await stat(p); return true; } catch { return false; } }

async function main() {
  let dirs = [];
  try { dirs = (await readdir(OUT_ROOT, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name); }
  catch { console.error(`Нет каталога ${OUT_ROOT} — сначала сними скриншоты (scripts/screenshots.mjs).`); process.exit(1); }

  const versions = dirs.filter((d) => /^\d+\.\d+/.test(d)).sort((a, b) => cmpVer(b, a)); // новые сверху
  const titles = await changelogTitles();

  const out = [];
  out.push('# Галерея версий PlaneFlow');
  out.push('');
  out.push('Скриншоты главного экрана, геймплея и меню паузы по версиям — чтобы видеть прогресс. Новые сверху.');
  out.push('');
  out.push('> Картинки генерируются автоматически: workflow **«Screenshots»** (`.github/workflows/screenshots.yml`)');
  out.push('> прогоняет игру каждой версии в Chromium. Локально — `npm run screenshots -- --all && npm run gallery`.');
  out.push('> Текстовая история — в [`CHANGELOG.md`](../../CHANGELOG.md).');
  out.push('');

  for (const v of versions) {
    const title = titles.get(v);
    out.push(`## ${v}${title ? ` — ${title}` : ''}`);
    out.push('');
    const cells = [], heads = [];
    for (const [file, label] of SHOTS) {
      const rel = `${v}/${file}.png`;
      heads.push(label);
      cells.push((await exists(join(OUT_ROOT, v, `${file}.png`))) ? `![${label} ${v}](${rel})` : '_—_');
    }
    out.push(`| ${heads.join(' | ')} |`);
    out.push(`| ${heads.map(() => '---').join(' | ')} |`);
    out.push(`| ${cells.join(' | ')} |`);
    out.push('');
  }

  const earliest = versions[versions.length - 1];
  if (earliest && cmpVer(earliest, '0.1') > 0) {
    out.push('---');
    out.push('');
    out.push(`_Более ранние версии (до ${earliest}) в галерею не попадают: их код предшествует началу`);
    out.push('git-истории репозитория, отрисовать их не из чего — описание есть только в');
    out.push('[`CHANGELOG.md`](../../CHANGELOG.md)._');
    out.push('');
  }

  await writeFile(join(OUT_ROOT, 'README.md'), out.join('\n'));
  console.log(`Галерея собрана: ${versions.length} версий → docs/screenshots/README.md`);
}

main().catch((e) => { console.error(e); process.exit(1); });
