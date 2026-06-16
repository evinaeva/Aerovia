# Art integration plan (`src/game/`)

History of how the drawn art got wired into the live game's canvas renderer +
palette. Big diff in the renderer + palette; done on a branch, behind a flag, verified
with `node --test` and a static frame render before merge.

## Strategy
- **Feature flag** near the render setup. Every sprite draw goes through
  `PFSprites.blitC/blit`, which returns `false` until the image is decoded — callers
  then fall back to the procedural draw. So the game never renders blank during load,
  and the flag can be flipped off instantly.
- **Keep state-driven feedback procedural**, layer the art under it: patience ring,
  selection ring, runway occupied/closed colours, bay progress ring + level pips,
  route path. These are dynamic and already good; we only swap the *base art* +
  *palette*, not the logic.
- Embed both `<symbol>` sheets once as a hidden block at the top of `<body>`
  (`planeflow-batch1.svg` + `planeflow-field.svg`), then `PFSprites.preload(...)`.

## Coordinate / orientation notes
- `planeShape` (`src/game/09-render.ts`) draws nose along **+x**; the plane **sprites**
  point **up (−y)**. So when drawing a sprite for a plane at angle `pl.ang`:
  `rot = pl.ang + Math.PI/2`.
- Current body is drawn at `scale(ui*0.5)` over a ~53-unit silhouette
  (≈ 26·ui across). Start the sprite at **size ≈ 42·ui** and tune against the
  patience ring radius (`16·ui`) and the need-icon offset (`y-28·ui`).
- `ui` is the global UI scale; pass CSS px to `PFSprites` (it handles DPR).

## Swap map (function → symbols)
| Renderer (line) | Now | Sprite |
|---|---|---|
| `drawPlaneBodyAt` (1748) | `planeShape` | `plane-vip` if `vip` · `plane-medevac` if `medical` · else `plane-normal`. Keep procedural shadow off (sprite has its own). |
| plane rings/selection (2052–2075) | procedural | **keep** (patience/selected/emergency). Do **not** use `plane-selected/patience/emergency` sprites — would double the rings. |
| `drawIcon` (1731) | proc icons | `svc-repair/fuel/board/depart`. Used over planes (2080) and in bays. |
| `drawBay` (1951) | proc stall | base from `bay-frame/open/locked/repair/fuel/board`; **keep** procedural progress ring, level pips, price chip, and gate orientation (`dirOut`). Trickiest — bay sprites are square & orientation-agnostic, so likely keep proc walls and only swap icon + tint at first. |
| `drawRunways` (1816) | proc | **keep procedural** (dynamic w/h + occupied/closed colours). Restyle to the palette; the `runway` sprite is fixed-size/orientation so it's reference-only. Use `lamp` colour + threshold styling cues. |
| `drawField` (1763) | proc | recolour to the palette; use `terminal` sprite for the building. Tiles (`tile-*`) are reference for colours; field stays a single region. |
| route line (2034) | phosphor dash | green; cap with `route-arrow` at the path end, `route-node`-style dot at the selected target. |
| HUD / screens / effects | proc | **batch 3** (lives ♥, coin ₿, star, pause, toasts, floats, menus). Wire when assets land. |

## Palette swap (`:root` / `COL`)
Key tokens: `--bg/page → #16131f`, tarmac `#242842` / `#1a1d2e`, water `#1c3a42`,
text/paper `#f4eede`, reduce `--phosphor` glow usage. Accents
(green/amber/rose/gold/teal/purple/life) already align with the tokens.
**Fuel = teal `#4ecdc4`** everywhere (reconcile the batch-2 blue `bay-fuel`).

## Verification before merge
1. `node --test tests/*.test.mjs` — logic safety net stays green.
2. Static frame render (same pipeline as the mock) for a visual check in chat.
3. Interactive check is on the user (no browser in this environment).

## Status — DONE (v0.21)
- [x] Sprite atlas + feature flag + procedural fallback.
- [x] Planes (`drawPlaneBodyAt`) → plane/vip/emergency/medevac sprites.
- [x] Aircraft layer: need chip (`svc-*`), selection ring, green route.
- [x] Palette `:root` → env colours + `--phosphor` recolour.
- [x] Field: terminal sprite; bays recoloured (geometry stays procedural).
- [x] HUD: hearts (`heart`/`heart-empty`) + coin sprites.
- [x] Effects: crash → `fx-crash`, near-miss → `fx-ripple`.
- [x] Main menu background → `menu-bg` sprite (cover-fit).
- [x] App icon + Android adaptive shipped under `assets/icon/`.

## Polish pass — DONE (v0.21, second slice)
- [x] Bay icons -> `svc-*` sprites (idle / busy / locked) + chain card icons.
- [x] Live service animation over a busy bay (`fx-weld/fuel/boarding/droplet`).
- [x] Route arrowhead (`route-arrow`, tinted via currentColor support).
- [x] HUD `clock` + `pause-btn` sprites; toast icons (`check`/`heart-crack`).
- [x] New effect triggers: touchdown / takeoff / service-done (`pulseFx`).
- [x] Wordmark lockup on the start screen; primary button green per spec.
- [x] Favicon / apple-touch-icon / theme-color; leftover radar colours purged.

## Third slice — DONE (v0.21)
- [x] Tile-based field: `SPRITES.pattern` (DPR-aware CanvasPattern) — tarmac
  slabs, water tile, grass strip + sandy shoreline with surf foam.
- [x] Level-select cards per the batch-5 spec: mini board thumbnail, display
  number, sprite star row, best result, padlock overlay for locked shifts.

Kept procedural by design (dynamic state): patience ring, runway strip
(size + occupied/closed feedback), bay gate orientation + progress/pips.
Remaining: winter art set (snow/plow have no sprites yet, `weather` is
opt-in and off in the campaign), PWA packaging, store screenshots.
