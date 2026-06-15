// Build the single self-contained index.html from the modular sources in src/.
//
//   index.html is GENERATED — never edit it by hand. Edit src/ and rebuild.
//
// Run locally with `npm run build`. CI runs this on every push to main and
// deploys the result to GitHub Pages, so the published file is always rebuilt
// fresh from src/ — there is no built artifact to forget to regenerate.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
// Sources are stored with a trailing newline for a clean diff; drop exactly that
// one separator so re-joining with '\n' reproduces the original inner content.
const bodyOf = (p) => { const s = read(p); return s.endsWith('\n') ? s.slice(0, -1) : s; };

// The game IIFE, in the order its modules must concatenate (01 opens it, 13 closes it).
const GAME_ORDER = [
  '01-bootstrap-theme', '02-sprites', '03-i18n', '04-config-levels', '05-validate',
  '06-state-layout', '07-audio-services', '08-gameplay', '09-render',
  '10-scene-loop', '11-menu-ui', '12-achievements-medals', '13-init',
];
const game = GAME_ORDER.map((n) => bodyOf(`src/game/${n}.js`)).join('\n');
const css  = bodyOf('src/styles.css');
const boot = bodyOf('src/boot-sw.js');

// Function replacements so `$` sequences in the code aren't treated as special
// replacement patterns; each placeholder occurs exactly once.
const html = read('index.template.html')
  .replace('/*__BUILD_CSS__*/',  () => css)
  .replace('/*__BUILD_GAME__*/', () => game)
  .replace('/*__BUILD_BOOT__*/', () => boot);

writeFileSync(join(ROOT, 'index.html'), html);
console.log(`built index.html — ${html.length} chars from ${GAME_ORDER.length} game modules + css + boot`);
