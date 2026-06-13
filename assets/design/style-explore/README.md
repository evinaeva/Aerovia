# Style exploration — 8 directions on ONE locked layout

Eight visual styles rendered over a single, **non-negotiable** gameplay layout, to
pick an art direction. Regenerate with `python3 build.py` (needs `cairosvg` + `pillow`).

## Locked layout (must NOT change between styles)

- Strict **top-down / bird's-eye**, no isometry. **Landscape ~16:9**.
- Center = a large **empty field** (the sacred drawing canvas); the HUD never overlaps it.
- Planes **arrive from the RIGHT** (wait in the air at the right edge).
- **Runways on the RIGHT**, horizontal strips.
- **Service bays line the BOTTOM, LEFT and TOP** edges (some open with icons:
  repair / fuel / boarding; some **locked** with a padlock + cost chip).
- The player **draws a route with a finger** — glowing line from a plane, finger cursor
  shown mid-draw, selected plane has a ring.
- **Slim HUD on the top edge only**: lives · money · level+goal bar · timer · pause.
- **Hard rule:** no tiny mobile UI — big, bold, readable icons & numbers.

## The 8 styles

| # | Style | Direction |
|---|-------|-----------|
| 1 | Extreme flat minimalism | 3 flat colors, no gradients/glow, diagrammatic |
| 2 | Clean modern mobile | soft gradients, rounded, glossy, premium casual |
| 3 | Neon air-traffic control | dark field, glowing routes, futuristic HUD |
| 4 | Bright playful cartoon | saturated, chunky outlines, toy-like |
| 5 | Tilt-shift miniature diorama | soft light, tactile materials, strictly top-down |
| 6 | Blueprint schematic | thin linework, grid, monospace HUD |
| 7 | Ornate art-deco | gold filigree, emerald & navy, geometric frames |
| 8 | Baroque maximalist | gilded ornate frames, jewel tones, lavish |

`styles-overview.png` is a 2×4 contact sheet of all eight; `style-N.png/.svg` are the
individual mockups. These are **art-direction exploration only** — not wired into
`index.html`.
