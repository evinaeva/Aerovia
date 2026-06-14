# Skins

Visual skins for PlaneFlow. The game ships a runtime **skin switch**
(`SKIN = 'cozy' | 'neon' | 'cartoon'`, in `index.html`; selectable in **Settings → Skin**,
or via `?skin=<name>` / `localStorage.pf_skin`). Each skin only changes how the
game *looks* — never the gameplay layout (top-down, planes/runways right, bays on
bottom/left/top, finger-drawn routes, slim top HUD, no tiny UI).

> ## ⛓️ Architecture rule — logic is the parent, skins only supply look & sound
>
> **Anything that is NOT visual appearance or audio content lives ABOVE skins and is
> identical for every skin, biome and map.** Logic, mechanics, calculations,
> trajectory, bay-entry, patience, money, stars, events, and *when* a sound fires —
> all skin-agnostic, never forked per skin. A skin (and a biome/map) changes **only
> its content**: colors, draw scale, art atlas, optional scene/HUD renderers, icons,
> animation content, and sound *content* (what an event sounds like). The difference
> between skins is **only** the content of animation, sound and icons/colors.
>
> **In code:** every per-skin difference is *declared* in the **`SKIN_DEFS`** registry
> in `index.html` (`tokens`, `scale`, `atlas`, `glow`, `field`/`hud`, `sounds`,
> `label`). Adding a skin/biome/map = add a registry entry (+ a line in `SKINS` + an
> i18n label key) — **never** add `if (SKIN === '…')` branches in logic/mechanics.
> `skinDef()` feeds `SZ`/`NEON`/sprite-mode/scene-dispatch/sound-content from the
> registry; `validateSkins()` fails the config check if a skin is added outside it.
> Full statement: `CLAUDE.md` and `docs/DEV.md` → «Главный принцип архитектуры».

| Skin | Status | Where |
| --- | --- | --- |
| **cozy** | shipped (default) | cozy sprite atlas — `assets/sprites/` |
| **neon** | shipped — **drawn PNG atlas** (55 ids + menu/brand art) | `assets/sprites/neon/` · brief: [`neon/BRIEF.md`](neon/BRIEF.md) |
| **cartoon** | shipped — **drawn PNG atlas** (71 ids: terrain, props, menus, brand) | `assets/sprites/cartoon/` · brief: [`cartoon/BRIEF.md`](cartoon/BRIEF.md) |

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
