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

The engine auto-loads **per-skin sprite sheets** and uses them when present — no
code changes needed to ship a skin's art:

1. Drop SVG sheets at `assets/sprites/<skin>/planeflow-{aircraft,field,hud,effects,brand}.svg`.
2. Prefix every `<symbol id>` with `<skin>-` (e.g. `neon-plane`, `neon-bay-fuel`).
   The atlas resolves `<skin>-<id>` ahead of the base `<id>` when that skin is
   active, overriding the procedural placeholder automatically.
3. The atlas (`SPRITES` in `index.html`) loads these on demand (`SPRITES.loadSkin`),
   flips `A.skinReady` / `refreshSpriteMode()` when ≥1 symbol arrives, and repaints
   live. Until then the skin renders procedurally (so it never looks broken).
4. **Bay panels** have a dedicated full-panel hook: `<skin>-bay-{repair,fuel,board,
   locked}` are blitted as the whole panel, with the engine overlaying the dynamic
   icon/label/cost/progress on top (don't bake those into the sprite).

Match ids / viewBox / sizes from [`../../sprites/README.md`](../../sprites/README.md)
and keep `var(--token,#hex)` colors so they stay recolorable.
