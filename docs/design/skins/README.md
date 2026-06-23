# Look (neon)

The game's single visual look — **neon** (glossy night air-traffic-control). The main
screen (`#startScreen`) and the in-game field share one DOM/canvas. This folder is the
**design brief + assets** for that look:

- [`ZONES.md`](ZONES.md) — **скиновые зоны (актуальный бриф):** точные размеры,
  состояния и масштабирование каждой зоны (ангар / ВПП / апрон / прилёт / самолёт /
  декор-фон). Это файл, который дают дизайн-агенту. Зоны примеряются в воркбенче
  (`tuning.html`, вкладка «Скины»); набор скинов лежит в [`assets/skins/`](../../../assets/skins/).
- [`neon/BRIEF.md`](neon/BRIEF.md) — ⚠️ **УСТАРЕЛ, не использовать** (числа/состав не
  соответствуют текущему коду; оставлен только как история). Актуальный бриф — `ZONES.md`.
- [`neon/SOURCING.md`](neon/SOURCING.md) — where to get each asset cheaply (free-first).
- [`neon/handoff/`](neon/handoff/) — hi-fi HUD/field reference + changelog.

Art lives at `assets/sprites/neon/` (drawn PNG atlas — 55 ids + menu/brand art).

> **History:** the game used to ship a runtime skin switch with multiple looks. That
> abstraction is retired — there is now one look (neon), so there's no skin picker,
> no `?skin=` URL param, and no per-look forking in the code.

## How drawn art plugs in (the backend seam)

The engine auto-loads the art and uses it when present — no code changes to ship new
assets. **PNG is the target format** (effects baked into the image → reliable on
Android/iOS, nothing to debug). Resolution order per id is **PNG → SVG → procedural**.

**PNG (preferred):**
1. Drop one transparent PNG per asset at `assets/sprites/neon/<id>.png` (base id, no
   prefix — e.g. `neon/bay-repair.png`, `neon/plane.png`).
2. List every shipped id in `assets/sprites/neon/manifest.json` (a JSON array of
   strings). The engine loads the manifest, flips its sprite-ready state, and draws
   `neon/<id>.png` for each listed id — live, no reload. Author at ~3× on-screen size;
   bake glow/gloss/shadow in.

**SVG (fallback):** sheets at `assets/sprites/neon/planeflow-*.svg` with every
`<symbol id>` prefixed `neon-` (e.g. `neon-plane`). Colors via `var(--token,#hex)`.
Note: the canvas blit strips SVG filters, so live glow/blur won't render — prefer PNG
for effects.

**Bay panels** have a dedicated full-panel hook: `bay-{repair,fuel,board,deice,locked}`
is blitted as the whole panel, with the engine overlaying the dynamic
icon/label/cost/progress on top (don't bake those into the asset).

Match ids / sizes from [`../../sprites/README.md`](../../../assets/sprites/README.md) and
[`neon/BRIEF.md`](neon/BRIEF.md).
