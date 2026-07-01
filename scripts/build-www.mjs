// Assemble www/ — the Capacitor webDir — from the built single-file index.html + assets.
//
// The normal `build` writes index.html at the repo root (served as-is by GitHub Pages).
// Capacitor needs a clean folder containing just the web app, so this rebuilds index.html
// and copies it together with assets/manifest/sw into www/. www/ is generated (gitignored).
//
//   npm run build:www      # then: npx cap sync android
import { build } from './build.mjs';
import { cpSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WWW = join(ROOT, 'www');
const ASSETS = join(ROOT, 'assets');

// Ассеты, которых НЕ должно быть в поставке (APK/OTA/PWA) — только dev/tuning-инструментарий
// или мёртвый вес, который игра нигде не грузит. Держим бандл маленьким ради лимита памяти
// Android 17 (см. docs/memory-android17.md); CI-гард scripts/check-asset-budget.mjs следит,
// чтобы бюджет не рос. Всё перечисленное остаётся в репо (Pages/tuning/задел) — фильтруется
// ТОЛЬКО из www/.
//   • assets/skins/**        — тестовый набор скинов ТОЛЬКО для tuning-воркбенча
//                              (Pages отдаёт их из корня репо; сама игра их не грузит).
//   • *_src_reference.png    — исходники-референсы для генераторов спрайтов (dev-only).
//   • *.card.html            — dev-карточки предпросмотра скина/палитры (design), не арт.
//   • *_overview.png         — контакт-лист спрайтов (dev), кодом не грузится.
//   • sprites/neon/app-icon.png — байт-в-байт дубль icon/icon-512.png, нигде не референсится.
//   • hud/wow-bar.png        — задел WOW-рескина, кодом пока не грузится (2872 px, ~1 МБ).
function shipAsset(src) {
  const rel = relative(ASSETS, src).split(sep).join('/');
  if (rel === 'skins' || rel.startsWith('skins/')) return false;
  if (rel.endsWith('_src_reference.png')) return false;
  if (rel.endsWith('.card.html')) return false;
  if (rel.endsWith('_overview.png')) return false;
  if (rel === 'sprites/neon/app-icon.png') return false;
  if (rel === 'hud/wow-bar.png') return false;
  return true;
}

build();                                              // refresh index.html from src/
rmSync(WWW, { recursive: true, force: true });
mkdirSync(WWW, { recursive: true });
copyFileSync(join(ROOT, 'index.html'), join(WWW, 'index.html'));
cpSync(ASSETS, join(WWW, 'assets'), { recursive: true, filter: shipAsset });
for (const f of ['manifest.json', 'sw.js']) copyFileSync(join(ROOT, f), join(WWW, f));
console.log('assembled www/ for Capacitor (index.html + assets + manifest + sw)');
