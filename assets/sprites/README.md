# PlaneFlow — Sprite assets

Cozy / stylized-flat, top-down vector art. Every piece is an inline
`<symbol>` in a spritesheet `.svg`. Colors, radii and shadows come from
`tokens/*.css` (embedded as literal hex in each sheet, with a token map in the
file header). **Readability First** — silhouettes read in < 0.5 s; interactive
chips are ≥ 44 px.

## Spritesheets
| File | Batch | Contents | Preview |
| --- | --- | --- | --- |
| `planeflow-aircraft.svg` | 1 | aircraft + states + service icons | `aircraft-preview.html` |
| `planeflow-field.svg` | 2 | terrain, terminal, runway, bays, routes | `field-preview.html` |
| `planeflow-hud.svg` | 3 | lives, coin, stars, pause, Zen, toast/float icons | `hud-preview.html` |

## How to use in the game

### A. DOM overlay (HUD, menus) — simplest
Inject the sheet once, then reference any symbol with `<use>`:
```html
<!-- once, at boot -->
<div hidden id="sprites"></div>
<script>
  fetch('assets/sprites/planeflow-hud.svg').then(r=>r.text())
    .then(t => document.getElementById('sprites').innerHTML = t);
</script>
<!-- anywhere -->
<svg width="24" height="24" viewBox="0 0 24 24"><use href="#heart"></use></svg>
```

### B. Canvas (the game board) — pre-rasterize per DPR
`<use>` can't be drawn to canvas directly, and external refs won't resolve from
an `Image`. So at load, wrap each symbol's markup in a standalone SVG string
(keep the `<defs>` filters), encode as a data-URL, and bake it into an
offscreen canvas at device-pixel size. Then `drawImage` that cache each frame:
```js
function bakeSprite(svgString, cssW, cssH, dpr = devicePixelRatio) {
  return new Promise((res) => {
    const url = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgString);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = cssW * dpr; c.height = cssH * dpr;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      res(c);
    };
    img.src = url;
  });
}
// draw: ctx.drawImage(cache, x - cssW/2, y - cssH/2, cssW, cssH);
// rotate a plane: translate to (x,y), rotate(heading), drawImage centered.
```
Re-bake on DPR change or when an asset needs a larger on-screen size (vector =
crisp at any density). Planes are authored nose-up; rotate around center.

---

## Batch 1 — `planeflow-aircraft.svg`
Planes share one 100×100 viewBox, centered, **nose up**. State rings overlay at
the same center (`<use href="#plane">` then `<use href="#ring-selected">`).

| id | size (px) | colors / tokens |
| --- | --- | --- |
| `plane` | 36–48 | body `cream-200` #e8e0cf, outline #b9b0a0, windows `gray-600` |
| `plane-vip` | 36–48 | body `gold` #f4cf5e, outline #caa53a |
| `plane-emergency` | 36–48 | body cream, outline `red` #e0584f, SOS dot red |
| `plane-medevac` | 36–48 | body `cream-100` #f4eede, outline `rose` #ef798a, cross `red` |
| `ring-selected` | match plane | dashed `gold` #f4cf5e + glow |
| `ring-patience` | match plane | track `gray-600`, arc `green` #5dca7a |
| `ring-patience-low` | match plane | track `gray-600`, arc `red` #e0584f + glow |
| `svc-repair` | 28–40 | chip `purple-800`, border+icon `amber` #f2a93b |
| `svc-fuel` | 28–40 | chip `purple-800`, border+icon `teal` #4ecdc4 |
| `svc-board` | 28–40 | chip `purple-800`, border+icon `rose` #ef798a |
| `svc-depart` | 28–40 | chip `purple-800`, border+icon `gold` #f4cf5e |

## Batch 2 — `planeflow-field.svg`
| id | size (px) | colors / tokens |
| --- | --- | --- |
| `tile-tarmac` | 64 (tile) | fill `navy-800` #242842, grooves `navy-900` |
| `tile-grass` | 64 (tile) | fill #38482f, tufts #2e3b27 / #46583b |
| `tile-water` | 64 (tile) | fill `radar`-free #1c3a42, waves #2a525c |
| `shore` | 64 (tile) | grass + water + sand #6b5c44 + cream foam |
| `terminal` | 120–180 w | roof `purple-700` #3a3354, windows `amber-glow` #ffb84d |
| `runway` | 90 w × 255 h | strip `navy-900`, markings `cream-200`, lights `amber-glow` |
| `runway-threshold` | 110 w | strip `navy-900`, piano keys `cream-200` |
| `runway-pointer` | 56–64 | chip `purple-800`, chevron `cream-200` |
| `lamp` | 12–16 | `amber-glow` #ffb84d + glow |
| `bay-frame` | 88–100 | pad `purple-800`, border `gray-600`, marks cream |
| `bay-open` | 88–100 | border `green` #5dca7a + entrance arrow |
| `bay-locked` | 88–100 | dim #1f1b2c, dashed `gray-600`, padlock gray |
| `bay-repair` | 88–100 | border+wrench `amber` #f2a93b |
| `bay-fuel` | 88–100 | border+droplet `blue` #4ab4d6 |
| `bay-board` | 88–100 | border+people `rose` #ef798a |
| `bay-occupied` | 88–100 | border gray, plane `cream-200`, busy dot `amber-glow` |
| `bay-progress` | 88–100 | track `gray-600`, arc `amber` #f2a93b |
| `upgrade-pips` | 60–72 w | lit `gold` #f4cf5e, unlit `gray-600` |
| `route-line` | along path | `green` #5dca7a, nodes cream-100 |
| `route-line-selected` | along path | `green`/#7fe098 + glow, leading dot |
| `route-arrow` | 14–24 | `fill: currentColor` — tint to the route color |

Route stroke widths: 7 (normal) / 9 (selected) at 100-unit scale; halo
underlay at .18–.3 opacity. Tiles are seamless — repeat as a pattern.

## Batch 3 — `planeflow-hud.svg`
| id | size (px) | colors / tokens |
| --- | --- | --- |
| `heart` | 18–24 | `life` #ef5365 + white glint |
| `heart-empty` | 18–24 | outline `gray-600` (spent life) |
| `coin` | 22–32 | `gold` #f4cf5e, rim #caa53a, ₿ ink #5e4a16 |
| `star` | 18–28 | `gold` #f4cf5e + glow |
| `star-empty` | 18–28 | outline `gray-600` |
| `clock` | 18–24 | `cream-200` #e8e0cf stroke |
| `pause` | 24 | bars `cream-100` #f4eede |
| `pause-btn` | **56** | chip `purple-800` + border, bars `cream-100` — ≥44 px |
| `moon` | 18–24 | `blue` #4ab4d6 |
| `zen-badge` | **56** | chip `purple-800`, border+moon `blue` #4ab4d6 + glow |
| `heart-crack` | 18–24 | `red` #e0584f (life-lost toast) |
| `check` | 18–24 | `green` #5dca7a (level-passed toast) |

**Toast** — one shared style: rounded `--surface-card` card, `--shadow-card`,
38 px icon chip tinted to tone (`red` life / `green` level / `gold` money),
title `cream-100` + muted message. See `hud-preview.html`.

**Floats** (canvas-drawn text, `--font-display` bold):
| text | token | glow |
| --- | --- | --- |
| `+N ₿` | `gold` #f4cf5e | `--text-glow-gold` |
| `×N combo` | `amber-glow` #ffb84d | `--text-glow-amber` |
| `on time!` | `green` #5dca7a | `--glow-green` |
| `phew!` | `cream-200`, muted | none |

---

### Pending batches
- **Batch 4 — effects:** crash, landing touch + smoke, takeoff lift, per-type
  service anims (fuel / sparks / boarding), success / error highlight — as
  canvas-ready frames / particles.
- **Batch 5 — brand & screens:** PlaneFlow wordmark, main-menu background,
  level card (preview / lock / best / stars), unified button style, plus the
  512×512 app icon and Android adaptive (bg + foreground) — those as raster.
