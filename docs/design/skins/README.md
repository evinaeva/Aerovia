# Skins

Visual skins for PlaneFlow. The game ships a runtime **skin switch**
(`SKIN = 'cozy' | 'neon'`, in `index.html`; selectable in **Settings → Skin**,
or via `?skin=<name>` / `localStorage.pf_skin`). Each skin only changes how the
game *looks* — never the gameplay layout (top-down, planes/runways right, bays on
bottom/left/top, finger-drawn routes, slim top HUD, no tiny UI).

| Skin | Status | Where |
| --- | --- | --- |
| **cozy** | shipped (default) | cozy sprite atlas — `assets/sprites/` |
| **neon** | shipped as a **procedural placeholder**; art brief to replace it | [`neon/BRIEF.md`](neon/BRIEF.md) |
| **cartoon** | **art brief — not yet drawn** | [`cartoon/BRIEF.md`](cartoon/BRIEF.md) |

Each `<skin>/` folder is a **self-contained design brief** (style spec, references,
engine integration, mini-animation plans, full asset checklist). Hand the folder to
the design agent.

## How drawn art plugs in (the backend seam)

The engine auto-loads **per-skin art** and uses it when present — no code changes to
ship a skin. **PNG is the target format** (effects baked into the image → reliable on
Android/iOS, nothing to debug). Resolution order per id is **PNG → skin-SVG → base
cozy → procedural**.

**PNG (preferred):**
1. Drop one transparent PNG per asset at `assets/sprites/<skin>/<id>.png` (base id, no
   prefix — e.g. `neon/bay-repair.png`, `neon/plane.png`).
2. List every shipped id in `assets/sprites/<skin>/manifest.json` (a JSON array of
   strings). The engine loads the manifest (`SPRITES.loadSkin`), flips `A.skinReady` /
   `refreshSpriteMode()`, and draws `<skin>/<id>.png` for each listed id — live, no
   reload. Author at ~3× on-screen size; bake glow/gloss/shadow in.

**SVG (fallback):** sheets at `assets/sprites/<skin>/planeflow-*.svg` with every
`<symbol id>` prefixed `<skin>-` (e.g. `neon-plane`). Colors via `var(--token,#hex)`.
Note: the canvas blit strips SVG filters, so live glow/blur won't render — prefer PNG
for effects.

**Bay panels** have a dedicated full-panel hook: `bay-{repair,fuel,board,deice,locked}`
is blitted as the whole panel, with the engine overlaying the dynamic
icon/label/cost/progress on top (don't bake those into the asset).

Match ids / sizes from [`../../sprites/README.md`](../../../assets/sprites/README.md) and each
skin's `BRIEF.md`.
