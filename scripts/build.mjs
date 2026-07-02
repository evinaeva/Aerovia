// Build the single self-contained index.html from the modular sources in src/.
//
//   index.html is GENERATED — never edit it by hand. Edit src/ and rebuild.
//
// Run locally with `npm run build`. CI runs this on every push to main and
// deploys the result to GitHub Pages, so the published file is always rebuilt
// fresh from src/ — there is no built artifact to forget to regenerate.
//
// GAME_ORDER and build() are exported so tests can introspect the module list
// without rebuilding; the build runs only when this file is invoked directly.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { argv } from 'node:process';
import ts from 'typescript';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
// Sources are stored with a trailing newline for a clean diff; drop exactly that
// one separator so re-joining with '\n' reproduces the original inner content.
const bodyOf = (p) => { const s = read(p); return s.endsWith('\n') ? s.slice(0, -1) : s; };

// A game module is authored as plain JS (used verbatim) or TypeScript (types
// stripped, no other transform). The modules are fragments of one shared IIFE
// scope, so we only strip types and concatenate — never bundle or wrap.
const stripTypes = (code, file) => ts.transpileModule(code, {
  fileName: file,
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    removeComments: false,
    newLine: ts.NewLineKind.LineFeed,
  },
}).outputText;
const gameModule = (name) => {
  if (existsSync(join(ROOT, `src/game/${name}.ts`))) {
    // Drop a leading `// @ts-nocheck` migration directive so it never lands in
    // the shipped bundle. The transpiler also appends a trailing newline; drop
    // that too so join('\n') re-creates the seam.
    const src = read(`src/game/${name}.ts`).replace(/^\/\/ @ts-nocheck.*\r?\n/, '');
    return stripTypes(src, `${name}.ts`).replace(/\n+$/, '');
  }
  return bodyOf(`src/game/${name}.js`);
};

// The game IIFE, in the order its modules must concatenate (01 opens it, 13 closes it).
export const GAME_ORDER = [
  '01-bootstrap-theme', '02-sprites', '02b-asset-metadata', '03-i18n', '04-config-levels', '04b-motion-tuning', '05-validate', '14-level-analysis',
  '06-state-layout', '07-audio-services', '08-gameplay', '08b-gameplay-step', '08c-fsm', '08d-scenario-pilot',
  '09-render', '09b-render-entities', '10-scene-loop', '11-menu-ui',
  '12-achievements-medals', '12b-native-play-games', '12c-cloud-saves', '12d-consent', '12e-firebase-sink', '12f-back-button', '12g-in-app-review', '12h-remote-config', '12i-deep-links', '13-init',
];

export function build() {
  const pkg = JSON.parse(read('package.json'));
  const game = GAME_ORDER.map(gameModule).join('\n')
    .replace("'__GAME_VERSION__'", () => `'${pkg.version}'`);
  const css  = bodyOf('src/styles.css');
  const boot = bodyOf('src/boot-sw.js');

  // Fill each placeholder exactly once. Function replacements keep `$` sequences
  // in the code from being read as special replacement patterns; the includes()
  // guard turns a renamed/removed placeholder into a loud build error instead of
  // a silently broken page.
  let html = read('index.template.html');
  for (const [placeholder, value] of [
    ['/*__BUILD_CSS__*/',  css],
    ['/*__BUILD_GAME__*/', game],
    ['/*__BUILD_BOOT__*/', boot],
  ]) {
    if (!html.includes(placeholder)) throw new Error(`build: ${placeholder} missing from index.template.html`);
    html = html.replace(placeholder, () => value);
  }

  writeFileSync(join(ROOT, 'index.html'), html);
  console.log(`built index.html — ${html.length} chars from ${GAME_ORDER.length} game modules + css + boot`);
  return html;
}

// Run the build only when invoked directly (`node scripts/build.mjs`), so that
// importing this module for GAME_ORDER (e.g. from tests) has no side effects.
if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) build();
