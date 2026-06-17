// Авто-скриншотер истории версий PlaneFlow.
//
// Снимает три экрана — ГЛАВНЫЙ / ГЕЙМПЛЕЙ / ПАУЗА — для текущей версии или для
// всех выпущенных версий из git-истории (флаг --all). Результат кладётся в
// docs/screenshots/<версия>/{main,gameplay,pause}.png. Галерею из этих картинок
// собирает scripts/build-gallery.mjs.
//
// Зачем отдельно от тестов: для рендеринга Canvas нужен настоящий браузер
// (Chromium). В песочнице Claude Code на вебе загрузка браузера заблокирована
// сетевой политикой, поэтому скрипт гоняется в GitHub Actions (workflow
// `.github/workflows/screenshots.yml`) или на хосте с доступным egress.
//
// Запуск:
//   node scripts/screenshots.mjs            # только рабочее дерево (текущая версия)
//   node scripts/screenshots.mjs --all      # все версии из git-истории
//   node scripts/screenshots.mjs --versions 0.22,0.20   # конкретные версии
//
// Нужен установленный Chromium: `npx playwright install chromium`.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT_ROOT = join(ROOT, 'docs', 'screenshots');

// Размер кадра: ландшафт (игра горизонтальная), 2× для чёткости.
const VIEWPORT = { width: 1280, height: 720 };
const SCALE = 2;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

// ---- минимальный статический сервер (без зависимостей) ----
function startServer(rootDir) {
  return new Promise((res) => {
    const server = createServer(async (req, resp) => {
      try {
        let path = decodeURIComponent((req.url || '/').split('?')[0]);
        if (path.endsWith('/')) path += 'index.html';
        // не выпускаем за пределы каталога версии
        const file = normalize(join(rootDir, path));
        if (!file.startsWith(rootDir)) { resp.writeHead(403).end(); return; }
        const buf = await readFile(file);
        resp.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
        resp.end(buf);
      } catch {
        resp.writeHead(404).end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      res({ url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

// ---- helpers взаимодействия (всё best-effort: шаг не должен ронять прогон) ----
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickIfVisible(page, selector, timeout = 2500) {
  try {
    const loc = page.locator(selector).first();
    await loc.waitFor({ state: 'visible', timeout });
    await loc.click({ timeout: 1500 });
    return true;
  } catch { return false; }
}

async function pauseVisible(page) {
  try {
    return await page.evaluate(() => {
      const el = document.getElementById('pauseScreen');
      return !!el && !el.classList.contains('hidden');
    });
  } catch { return false; }
}

// Вход в геймплей: Играть → первый открытый уровень → закрыть окно целей (если есть).
async function enterGameplay(page) {
  await clickIfVisible(page, '#startBtn');
  await wait(400);
  // первый незаблокированный узел уровня (верстка менялась за версии — пробуем по очереди):
  // сейчас (≥0.26) это .lvlnode на карте-тропинке; раньше — .levelcard (в т.ч. .levelcard.suitcase).
  const cardSelectors = ['#levelList .lvlnode:not(.locked)', '.lvlnode:not(.locked)', '#levelList .levelcard:not(.locked)', '.levelcard:not(.locked)', '#levelList .levelcard', '.levelcard'];
  for (const sel of cardSelectors) { if (await clickIfVisible(page, sel, 1500)) break; }
  await wait(500);
  await clickIfVisible(page, '#goalsOk', 1500); // окно целей появилось с 0.17; на старых — нет
  await wait(2600); // дать времени появиться бортам на поле
}

// Открыть паузу: кнопка паузы рисуется на canvas в правом-верхнем углу — кликаем
// по сетке кандидатов, пока DOM-оверлей #pauseScreen не станет видимым.
async function openPause(page) {
  let box;
  try { box = await page.locator('canvas').first().boundingBox(); } catch { box = null; }
  if (!box) return false;
  const right = box.x + box.width, top = box.y;
  for (const dx of [22, 34, 48, 64, 16, 80]) {
    for (const dy of [22, 16, 30, 40]) {
      try { await page.mouse.click(right - dx, top + dy); } catch {}
      await wait(120);
      if (await pauseVisible(page)) return true;
    }
  }
  return false;
}

async function captureVersion(browser, baseURL, outDir) {
  await mkdir(outDir, { recursive: true });
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const shot = async (name) => { try { await page.screenshot({ path: join(outDir, `${name}.png`) }); return true; } catch { return false; } };
  const done = { main: false, gameplay: false, pause: false };
  try {
    try { await page.goto(`${baseURL}/index.html`, { waitUntil: 'networkidle', timeout: 15000 }); }
    catch { await page.goto(`${baseURL}/index.html`, { waitUntil: 'load', timeout: 15000 }); }
    await wait(1300); // шрифты/спрайты
    done.main = await shot('main');

    try { await enterGameplay(page); done.gameplay = await shot('gameplay'); } catch {}
    try { if (await openPause(page)) done.pause = await shot('pause'); } catch {}
  } finally {
    await ctx.close();
  }
  return done;
}

// ---- карта версий: версия → коммит её финального состояния ----
// История репозитория имеет два корня (импорт/графт), поэтому `git log -- index.html`
// из-за упрощения истории теряет корень v0.7. Обходим ВСЕ достижимые из HEAD коммиты
// в топологическом порядке и читаем VERSION в каждом. Берём ПОСЛЕДНИЙ коммит каждой
// версии — это её самое полное состояние перед бампом (а для текущей версии — HEAD).
function git(args) { return execFileSync('git', args, { cwd: ROOT, maxBuffer: 1 << 30 }).toString(); }

function versionMap() {
  const shas = git(['log', '--topo-order', '--reverse', '--format=%H']).trim().split('\n').filter(Boolean);
  const map = new Map(); // версия → коммит (last-wins)
  for (const sha of shas) {
    let html;
    try { html = git(['show', `${sha}:index.html`]); } catch { continue; }
    const m = html.match(/VERSION\s*=\s*'([^']+)'/);
    if (!m) continue;
    map.set(m[1], sha);
  }
  return map;
}

async function main() {
  const argv = process.argv.slice(2);
  const all = argv.includes('--all');
  const only = (() => {
    const i = argv.indexOf('--versions');
    return i >= 0 && argv[i + 1] ? new Set(argv[i + 1].split(',').map((s) => s.trim())) : null;
  })();

  const browser = await chromium.launch();
  const results = [];
  try {
    if (!all && !only) {
      // только рабочее дерево (текущая версия)
      const srv = await startServer(ROOT);
      try {
        const html = await readFile(join(ROOT, 'index.html'), 'utf8');
        const v = (html.match(/VERSION\s*=\s*'([^']+)'/) || [, 'current'])[1];
        const d = await captureVersion(browser, srv.url, join(OUT_ROOT, v));
        results.push([v, d]);
      } finally { await srv.close(); }
    } else {
      const map = versionMap();
      let entries = [...map.entries()];
      if (only) entries = entries.filter(([v]) => only.has(v));
      const wtBase = join(process.env.RUNNER_TEMP || tmpdir(), 'pf-shots');
      for (const [v, sha] of entries) {
        const wt = join(wtBase, v.replace(/[^\w.]/g, '_'));
        try { await rm(wt, { recursive: true, force: true }); } catch {}
        try { git(['worktree', 'add', '--detach', '--force', wt, sha]); }
        catch (e) { console.warn(`! ${v}: не удалось создать worktree (${sha}) — пропуск`); continue; }
        const srv = await startServer(wt);
        try {
          const d = await captureVersion(browser, srv.url, join(OUT_ROOT, v));
          results.push([v, d]);
          console.log(`✓ ${v.padEnd(7)} main:${d.main ? '✓' : '·'} gameplay:${d.gameplay ? '✓' : '·'} pause:${d.pause ? '✓' : '·'}`);
        } finally {
          await srv.close();
          try { git(['worktree', 'remove', '--force', wt]); } catch {}
        }
      }
    }
  } finally {
    await browser.close();
  }

  if (!results.length) { console.error('Не снято ни одной версии.'); process.exit(1); }
  console.log(`\nГотово: ${results.length} версий → ${OUT_ROOT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
