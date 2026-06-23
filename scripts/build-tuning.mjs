// Build the single self-contained tuning.html from the modular sources in
// src/tuning/ (+ src/tuning.css). Mirrors scripts/build.mjs exactly.
//
//   tuning.html is GENERATED — never edit it by hand. Edit src/ and rebuild.
//
// tuning.html is the dev workbench (motion / level / difficulty / layout tuning).
// It is NOT bundled or minified: the modules are fragments of one shared IIFE
// scope, so we only strip TypeScript types (if any) and concatenate — the output
// stays plain, readable HTML identical to hand-writing one file.
//
// Run locally with `npm run build:tuning`. CI runs this on every push to main
// and deploys the result to GitHub Pages alongside index.html, so the published
// file is always rebuilt fresh from src/ — there is no artifact to forget.
//
// TUNING_ORDER and build() are exported so tests can introspect the module list
// without rebuilding; the build runs only when this file is invoked directly.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { argv } from 'node:process';
import ts from 'typescript';
import { scanSkins } from './scan-skins.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
// Sources are stored with a trailing newline for a clean diff; drop exactly that
// one separator so re-joining with '\n' reproduces the original inner content.
const bodyOf = (p) => { const s = read(p); return s.endsWith('\n') ? s.slice(0, -1) : s; };

// A module is authored as plain JS (used verbatim) or TypeScript (types stripped,
// no other transform). The modules are fragments of one shared IIFE scope, so we
// only strip types and concatenate — never bundle or wrap.
const stripTypes = (code, file) => ts.transpileModule(code, {
  fileName: file,
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    removeComments: false,
    newLine: ts.NewLineKind.LineFeed,
  },
}).outputText;
const tuningModule = (name) => {
  if (existsSync(join(ROOT, `src/tuning/${name}.ts`))) {
    // Drop a leading `// @ts-nocheck` migration directive so it never lands in
    // the shipped bundle. The transpiler also appends a trailing newline; drop
    // that too so join('\n') re-creates the seam.
    const src = read(`src/tuning/${name}.ts`).replace(/^\/\/ @ts-nocheck.*\r?\n/, '');
    return stripTypes(src, `${name}.ts`).replace(/\n+$/, '');
  }
  return bodyOf(`src/tuning/${name}.js`);
};

// The workbench IIFE, in the order its modules must concatenate (01 opens it,
// 16 closes it). They are fragments of one shared closure scope — not ES modules.
export const TUNING_ORDER = [
  '01-bootstrap-i18n', '02-phone-preview', '03-popups', '04-cutout',
  '05-splitter', '06-zone-legend', '07-motion-subtabs', '08-motion-ui',
  '09-level-lab', '10-difficulty-lab', '11-tabs', '12-layout-designer',
  '13-zones-overlay', '14-preview-mode', '15-resources', '16-init-test',
];

export function build() {
  scanSkins();   // keep assets/skins/index.json fresh (the «Скины» tab fetches it)
  const js  = TUNING_ORDER.map(tuningModule).join('\n');
  const css = bodyOf('src/tuning.css');

  // Fill each placeholder exactly once. Function replacements keep `$` sequences
  // in the code from being read as special replacement patterns; the includes()
  // guard turns a renamed/removed placeholder into a loud build error instead of
  // a silently broken page.
  let html = read('tuning.template.html');
  for (const [placeholder, value] of [
    ['/*__BUILD_TUNING_CSS__*/', css],
    ['/*__BUILD_TUNING_JS__*/',  js],
  ]) {
    if (!html.includes(placeholder)) throw new Error(`build-tuning: ${placeholder} missing from tuning.template.html`);
    html = html.replace(placeholder, () => value);
  }

  writeFileSync(join(ROOT, 'tuning.html'), html);
  console.log(`built tuning.html — ${html.length} chars from ${TUNING_ORDER.length} modules + css`);
  return html;
}

// Run the build only when invoked directly (`node scripts/build-tuning.mjs`), so
// that importing this module for TUNING_ORDER (e.g. from tests) has no side effects.
if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) build();
