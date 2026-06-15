# Project notes for Claude

## Visual look — single `neon` skin

The game has **one look, `neon`** (dark night-radar with glow). There is no skin
selection anymore — the old multi-skin system (`cozy`/`neon`/`cartoon`, the
`SKIN_DEFS` registry and the "logic is the parent over skins" rule) has been removed.

In code (`index.html`): the neon palette (`NEON_TOKENS`) is applied on top of the
base `PALETTE`; the field is drawn by `drawNeonField`; sprites come from
`assets/sprites/neon/` with the base `assets/sprites/planeflow-*.svg` as fallback,
and `ATLAS` is just a flag for "sprite atlas loaded yet?". Keep gameplay logic,
mechanics and geometry independent of the look (as before) — there's simply nothing
to fork against now.

## Source layout — edit `src/`, never edit `index.html`

`index.html` is a **generated build artifact** (and is git-ignored). Run
`node scripts/build.mjs` (or `npm run build`) to assemble it. **Do not edit
`index.html` by hand** — it is overwritten on every build, and it is not in git.

The game source lives in `src/`:
- `src/styles.css` — all CSS (the former `<style>` block).
- `src/game/01..13-*.{js,ts}` — the game IIFE split into ordered modules. The
  build concatenates them, in the order listed in `scripts/build.mjs`, into one
  `<script>`. **Module 01 opens the IIFE and module 13 closes it**, so the files
  are fragments of one shared closure scope — *not* ES modules. Do not add
  `import`/`export`; just edit the relevant module. A module may be `.js` or
  `.ts` (see "TypeScript" below); the build picks whichever file exists.
- `src/boot-sw.js` — the PWA/service-worker registration (final `<script>`).
- `index.template.html` — the HTML shell with `/*__BUILD_*__*/` placeholders the
  build fills in.

The build concatenates + inlines and strips TypeScript types — no minify, no
bundling — so the output stays plain readable HTML, identical in behavior to
hand-writing one file. `npm test`, `npm run test:e2e` and `npm run serve` build
first. CI (`.github/workflows/deploy.yml`) type-checks, builds and unit-tests on
every push to `main` and publishes to GitHub Pages, so nobody has to remember to
rebuild and `index.html` is never committed.

## TypeScript (gradual migration)

Modules may be authored in TypeScript (`.ts`). The migration is gradual: `.js`
and `.ts` modules coexist, `scripts/build.mjs` strips types from `.ts` and uses
`.js` verbatim. Run **`npm run typecheck`** (`tsc --noEmit`) — CI runs it too,
and `npm test` runs it first.

Because the game is **one IIFE scope** (not ES modules), each `.ts` module is a
*script*: no `import`/`export`, and its top-level declarations are globals shared
with the other modules. Names a `.ts` module borrows from a still-`.js` module go
in **`src/game/_contracts.d.ts`**; as each owning module becomes `.ts`, move its
real declaration there and shrink the contracts file. `tsconfig.json` includes
only `.ts` (the `.js` fragments 01/13 open/close the IIFE and don't parse alone).

## Tracking development time

If the user asks how many hours went into the project (e.g. "посчитай мои часы",
"how long have I spent", "сколько времени на разработку"), run the committed script
**`tools/devtime-git.ps1`** and report its output — don't reinvent the calculation.

```powershell
pwsh tools/devtime-git.ps1                       # all-time, per-day + total
pwsh tools/devtime-git.ps1 -Author 'exzhe'       # only the user's commits
pwsh tools/devtime-git.ps1 -GapMinutes 90 -LeadInMinutes 15   # tune the heuristic
```

It estimates time purely from **git history** (the single source of truth, since
commits from all of the user's machines — home PC, work PC, laptop — land in this
one repo). Heuristic agreed with the user: commits less than **60 min** apart belong
to the same work session; each session adds a **10 min** lead-in for work done before
its first commit. This is the preferred method — it needs no per-machine log syncing.

## Workflow preferences

- **Work in your own feature branch — never commit straight to `main`.** Branch off the
  latest `origin/main`, do the work there, push the branch and open a PR.
- **Do NOT merge into `main` yourself — leave the PR ready and let the owner merge it.**
  The owner often runs **several Claude conversations in parallel** against this repo, and
  auto-merging to `main` disrupts the other conversations' in-flight work. Don't merge even
  when it's mergeable and CI is green, and don't wait around for a "мержи" / "merge" reply —
  just leave the branch/PR ready and move on.
- Before starting and before pushing: `git fetch`; base your branch on `origin/main`; never
  `--force`, and never rewrite someone else's commits.
