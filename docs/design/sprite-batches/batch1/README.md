# PlaneFlow — design assets · Batch 1 (cozy)

Cozy / stylized-flat, top-down vector assets. Delivered as an inline-SVG
`<symbol>` sprite sheet so they stay crisp at any DPI (important for mobile).

Colours are taken from the PlaneFlow design-system tokens (`tokens/colors.css`).

## Files
- `planeflow-batch1.svg` — the sprite sheet (game-ready). Hidden `<svg>` with
  `<symbol>` defs; drops into `index.html` once and renders at `width:0`.
- `preview.png` — reference render of everything in this batch.
- `build.py` — source that generates the sheet + preview (re-run to tweak).

## Symbol IDs
**Planes** (`viewBox 0 0 64 64`)
- `plane-normal` — cream body
- `plane-vip` — gold body + purple priority stripe
- `plane-selected` — normal + green selection ring
- `plane-patience` — normal + amber/red depleting timer ring
- `plane-emergency` — normal + red pulse ring + red beacon (critical fuel)
- `plane-medevac` — normal + red-cross roundel + red beacon

**Service icons** (`viewBox 0 0 24 24`, colours from tokens)
- `svc-repair` (amber) · `svc-fuel` (teal) · `svc-board` (rose) · `svc-depart` (gold)

## Using in Canvas
Rasterise each symbol once into an `Image`, then `drawImage`:

```js
const sprites = {};
function loadSprite(id, px){
  const sym = document.getElementById(id);            // <symbol> from the sheet
  const vb  = sym.getAttribute('viewBox');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" `
            + `width="${px}" height="${px}">${sym.innerHTML}</svg>`;
  const img = new Image();
  img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  sprites[id] = img;
}
// ctx.drawImage(sprites['plane-vip'], x - 32, y - 32, 64, 64);
```
