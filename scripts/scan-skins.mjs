// Scan assets/skins/<zone>/<name>/skin.json into a single assets/skins/index.json
// that the tuning workbench («Скины» tab) fetches at runtime to list and preview
// zone skins. Generated file — regenerate with `npm run scan:skins` (also run as a
// side-effect of `npm run build:tuning`). It is committed so it's always present in
// the deployed tree (the workbench fetches it as a separate file, not inlined).
//
// Convention (one skin = one folder):
//   assets/skins/<zone>/<name>/skin.json
//   assets/skins/<zone>/<name>/<state>.png …
// where <zone> ∈ hangar | apron | runway | plane | arrival | background.
//
// skin.json shape:
//   { "id": "hangar-neon",                     // OPTIONAL: stable unique id (recommended)
//     "label": "Human name",
//     "base": "assets/sprites/neon",          // OPTIONAL: resolve images from here
//     "states": { "fuel": "open-fuel.png", "locked": "locked.png", … } }
// The "id" is what lands in the exported level JSON (skins.<zone> = id). It is decoupled
// from the folder name so renaming a folder doesn't break references in already-exported
// JSONs. If omitted, it falls back to the folder name. If "base" is omitted, image files
// resolve relative to the skin folder itself.
//
// scanSkins() is exported so tests can introspect; the write runs only when this
// file is invoked directly (mirrors scripts/build-tuning.mjs).
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { argv } from 'node:process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKINS_DIR = join(ROOT, 'assets/skins');
const OUT = join(ROOT, 'assets/skins/index.json');

const dirsIn = (p) => existsSync(p)
  ? readdirSync(p).filter((n) => statSync(join(p, n)).isDirectory())
  : [];

export function scanSkins() {
  const index = {};
  const warnings = [];

  for (const zone of dirsIn(SKINS_DIR).sort()) {
    const zoneDir = join(SKINS_DIR, zone);
    for (const name of dirsIn(zoneDir).sort()) {
      const skinFile = join(zoneDir, name, 'skin.json');
      if (!existsSync(skinFile)) continue;

      let meta;
      try { meta = JSON.parse(readFileSync(skinFile, 'utf8')); }
      catch (e) { warnings.push(`skip ${zone}/${name}: bad skin.json (${e.message})`); continue; }

      // Image base: explicit "base" (repo-root-relative) or the skin folder itself.
      const base = (meta.base || `assets/skins/${zone}/${name}`).replace(/\\/g, '/').replace(/\/+$/, '');
      const states = {};
      for (const [state, file] of Object.entries(meta.states || {})) {
        const rel = `${base}/${file}`.replace(/\\/g, '/');
        if (!existsSync(join(ROOT, rel))) { warnings.push(`missing image ${zone}/${name}: ${rel}`); continue; }
        states[state] = rel;
      }
      if (!Object.keys(states).length) { warnings.push(`skip ${zone}/${name}: no usable images`); continue; }

      // Стабильный уникальный id — это то, что попадёт в экспорт уровня (поле skins.<zone>).
      // Берём явный meta.id (рекомендуется), иначе имя папки. id развязан от имени папки,
      // чтобы переименование папки не сломало ссылки в уже выгруженных JSON.
      const id = meta.id || name;
      const zoneArr = (index[zone] ||= []);
      if (zoneArr.some(s => s.id === id)) { warnings.push(`skip ${zone}/${name}: duplicate id "${id}" (id должен быть уникален в зоне)`); continue; }
      zoneArr.push({ id, name, label: meta.label || name, dir: base, states });
    }
  }

  writeFileSync(OUT, JSON.stringify(index, null, 2) + '\n');
  const total = Object.values(index).reduce((n, a) => n + a.length, 0);
  console.log(`scan-skins: ${total} skin(s) across ${Object.keys(index).length} zone(s) → assets/skins/index.json`);
  warnings.forEach((w) => console.warn('  ⚠ ' + w));
  return index;
}

if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) scanSkins();
