# Cozy reskin — integration plan (index.html)

Goal: move the live game from the shipped **night-radar** look to the **cozy /
stylized-flat** design (batches 1–2, and 3 when ready). Big diff in the canvas
renderer + palette. Done on a branch, behind a flag, verified with `node --test`
and a static frame render before merge.

See `cozy-frame-mock.png` for the target look composed from existing batches.

## Strategy
- **Feature flag** `const COZY = true;` near the render setup. Every sprite draw
  goes through `PFSprites.blitC/blit`, which returns `false` until the image is
  decoded — callers then fall back to the current procedural draw. So the game
  never renders blank during load, and the flag can be flipped off instantly.
- **Keep state-driven feedback procedural**, layer cozy art under it:
  patience ring, selection ring, runway occupied/closed colours, bay progress
  ring + level pips, route path. These are dynamic and already good; we only
  swap the *base art* + *palette*, not the logic.
- Embed both `<symbol>` sheets once as a hidden block at the top of `<body>`
  (`planeflow-batch1.svg` + `planeflow-field.svg`), then `PFSprites.preload(...)`.

## Coordinate / orientation notes
- `planeShape` (index.html:1739) draws nose along **+x**; the plane **sprites**
  point **up (−y)**. So when drawing a sprite for a plane at angle `pl.ang`:
  `rot = pl.ang + Math.PI/2`.
- Current body is drawn at `scale(ui*0.5)` over a ~53-unit silhouette
  (≈ 26·ui across). Start the sprite at **size ≈ 42·ui** and tune against the
  patience ring radius (`16·ui`) and the need-icon offset (`y-28·ui`).
- `ui` is the global UI scale; pass CSS px to `PFSprites` (it handles DPR).

## Swap map (function → symbols)
| Renderer (line) | Now | Cozy |
|---|---|---|
| `drawPlaneBodyAt` (1748) | `planeShape` | `plane-vip` if `vip` · `plane-medevac` if `medical` · else `plane-normal`. Keep procedural shadow off (sprite has its own). |
| plane rings/selection (2052–2075) | procedural | **keep** (patience/selected/emergency). Do **not** use `plane-selected/patience/emergency` sprites — would double the rings. |
| `drawIcon` (1731) | proc icons | `svc-repair/fuel/board/depart`. Used over planes (2080) and in bays. |
| `drawBay` (1951) | proc stall | base from `bay-frame/open/locked/repair/fuel/board`; **keep** procedural progress ring, level pips, price chip, and gate orientation (`dirOut`). Trickiest — bay sprites are square & orientation-agnostic, so likely keep proc walls and only swap icon + tint at first. |
| `drawRunways` (1816) | proc | **keep procedural** (dynamic w/h + occupied/closed colours). Restyle to cozy palette; the `runway` sprite is fixed-size/orientation so it's reference-only. Use `lamp` colour + threshold styling cues. |
| `drawField` (1763) | proc | recolour to cozy palette; use `terminal` sprite for the building; cozy water. Tiles (`tile-*`) are reference for colours; field stays a single region. |
| route line (2034) | phosphor dash | cozy green; cap with `route-arrow` at the path end, `route-node`-style dot at the selected target. |
| HUD / screens / effects | proc | **batch 3** (lives ♥, coin ₿, star, pause, toasts, floats, menus). Wire when assets land. |

## Palette swap (`:root` / `COL`)
Move the dark base from radar to cozy. Key tokens:
`--bg/page → #16131f`, tarmac `#242842` / `#1a1d2e`, water `#1c3a42`,
text/paper `#f4eede`, reduce `--phosphor` glow usage. Accents
(green/amber/rose/gold/teal/purple/life) already align with the tokens.
**Fuel = teal `#4ecdc4`** everywhere (reconcile the batch-2 blue `bay-fuel`).

## Verification before merge
1. `node --test tests/*.test.mjs` — logic safety net stays green.
2. Static frame render (same pipeline as the mock) for a visual check in chat.
3. Interactive check is on the user (no browser in this environment).
