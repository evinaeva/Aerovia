// Assemble www/ — the Capacitor webDir — from the built single-file index.html + assets.
//
// The normal `build` writes index.html at the repo root (served as-is by GitHub Pages).
// Capacitor needs a clean folder containing just the web app, so this rebuilds index.html
// and copies it together with assets/manifest/sw into www/. www/ is generated (gitignored).
//
//   npm run build:www      # then: npx cap sync android
import { build } from './build.mjs';
import { cpSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WWW = join(ROOT, 'www');

build();                                              // refresh index.html from src/
rmSync(WWW, { recursive: true, force: true });
mkdirSync(WWW, { recursive: true });
copyFileSync(join(ROOT, 'index.html'), join(WWW, 'index.html'));
cpSync(join(ROOT, 'assets'), join(WWW, 'assets'), { recursive: true });
for (const f of ['manifest.json', 'sw.js']) copyFileSync(join(ROOT, f), join(WWW, f));
console.log('assembled www/ for Capacitor (index.html + assets + manifest + sw)');
