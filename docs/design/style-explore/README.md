# Style exploration — directions on one reference layout

Visual styles rendered over a single **reference** gameplay layout, to
pick an art direction. Regenerate with `python3 build.py` (needs `cairosvg` + `pillow`).

> The layout below was kept identical across the renders only so the styles compare
> fairly. It is **not** a game requirement: field-element placement (apron, bays,
> runways) is no longer prescribed — see [neon BRIEF](../skins/neon/BRIEF.md). Only the
> HUD and the plane-needs info bar are fixed.

## Reference layout used for these renders (not a requirement)

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

## The styles

| # | Style | Direction |
|---|-------|-----------|
| 1 | Extreme flat minimalism | 3 flat colors, no gradients/glow, diagrammatic |
| 2 | Clean modern mobile | soft gradients, rounded, glossy, premium casual |
| 3 | Neon air-traffic control | dark field, glowing routes, futuristic HUD |
| 5 | Tilt-shift miniature diorama | soft light, tactile materials, strictly top-down |
| 6 | Blueprint schematic | thin linework, grid, monospace HUD |
| 7 | Ornate art-deco | gold filigree, emerald & navy, geometric frames |
| 8 | Baroque maximalist | gilded ornate frames, jewel tones, lavish |

`style-N.png/.svg` are the individual mockups.

## The shipped look (neon — wired into the game)

Style **#3 (neon)** is the game's single look, implemented on the actual canvas in
`index.html` — not a static mockup. It applies a neon palette (`NEON_TOKENS`) + extra
glow: dark radar field (rings + sweep), glowing bay borders, neon runway frames, a
bloomed finger-route, and a dark neon HUD.

`neon-ingame.png` is a real in-game screenshot (Zen mode). `shot.mjs` is the Playwright
capture helper used to grab it
(`PW_CHROME=/path/to/chrome node shot.mjs "http://localhost:8123/index.html" out.png`).
