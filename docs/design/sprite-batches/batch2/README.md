# PlaneFlow — design assets · Batch 2 (field)

Field & infrastructure assets from the Claude Design "planeflow-design" skill.
Cozy / stylized-flat, inline-SVG `<symbol>` sprite sheet (crisp at any DPI).

## Files
- `planeflow-field.svg` — the sprite sheet (game-ready). Hidden `<svg>` of
  `<symbol>` defs plus two reusable filters (`pf-shadow`, `pf-glow`).
- `field-preview.html` — the design tool's own interactive preview (fetches
  the sheet next to it).
- `preview.png` — static render (note: soft shadow/glow filters don't show in
  this raster render, but do in a browser).

## Symbol IDs
**Environment** (`viewBox 0 0 64 64`, full-bleed tiles)
- `tile-tarmac` · `tile-grass` · `tile-water` · `shore`
- `terminal` (`160×112`) — building with lit windows + jet bridge

**Runway**
- `runway` (`120×340`) — strip, centreline, threshold piano keys, edge lamps, "07"
- `runway-threshold` (`120×72`) · `runway-pointer` (`64×64`) · `lamp` (`16×16`)

**Service bays** (`viewBox 0 0 100 100`, composable)
- `bay-frame` (empty) · `bay-open` · `bay-locked`
- `bay-repair` (amber) · `bay-fuel` · `bay-board` (rose)
- `bay-occupied` · `bay-progress` (ring) · `upgrade-pips` (`72×24`)

**Route**
- `route-line` · `route-line-selected` · `route-arrow` (`fill:currentColor`)

## Notes / to reconcile
- No `bay-depart` by design: "departure" is the takeoff action (guide to a
  runway), not a service bay. Bays are repair / fuel / board only.
- **Fuel colour mismatch:** `bay-fuel` here is blue (`#4ab4d6` / `--blue`),
  but the live game and batch-1 `svc-fuel` use teal (`#4ecdc4` / `--teal`).
  Align to teal before wiring in, so the HUD icon and the bay match.
- Filters use `feDropShadow` / `feGaussianBlur` — fine in browsers; if these
  ever need to be rasterised for a sprite atlas, flatten them first.
