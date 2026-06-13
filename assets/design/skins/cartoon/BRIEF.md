# Cartoon skin — design brief

> **For the design agent.** This folder is the single source for producing the
> **cartoon** visual skin of PlaneFlow: the style description, the reference
> images (`references/`), and the **asset checklist** of everything to draw.
> Read this top-to-bottom before drawing. Produce assets that drop into the
> existing sprite atlas without code changes (see *Integration*).

Chosen because the cartoon look best supports the planned **mini-animations**
(lively, bouncy, ambient motion) — see *Mini-animations* below.

---

## 1. The locked gameplay layout (must NOT change)

The skin changes how things look, never *where* they are. Honor this exactly
(same spec the neon/cozy skins use):

- **Strict top-down / bird's-eye.** No isometry, no 3/4 tilt. **Landscape ~16:9.**
- **Center = a large field** — the sacred drawing canvas. The HUD never overlaps it.
- **Planes arrive from the RIGHT** (wait in the air at the right edge).
- **Runways on the RIGHT**, horizontal strips.
- **Service bays line the BOTTOM, LEFT and TOP** edges (open ones show their
  service icon; locked ones show a padlock + a cost chip).
- The player **draws a route with a finger** — a line from a plane, finger cursor
  shown mid-draw, selected plane has a ring, waiting planes have a patience ring.
- **Slim HUD on the top edge only:** lives (hearts) · money (coin) · level + goal
  bar · timer · pause.
- **HARD RULE — no tiny mobile UI.** Big, bold, readable icons and HUD numbers;
  thumb-sized touch targets; minimal text.

`references/ref-04-layout-mockup.png` shows this layout; `ref-01..03` show the
target *art style* on top of it.

## 2. The cartoon style

Bright, cheerful **daytime** mobile-casual (think *Airport City / Township*):

- **Lush green field** as the central apron (mowed-grass texture, subtle patches),
  not a dark tarmac. Soft sky-blue **water** along the far edge with a sandy shore.
- **Glossy rounded panels** for service bays — saturated solid colors, soft inner
  highlight, **thick clean outline**, gentle drop shadow. Each bay reads as a cute
  little building/stall.
- **Saturated, friendly palette**; warm sunlight. Soft, rounded everything.
- **Chunky toy-like planes**, smooth bodies, big windows, clear livery per type.
- **Big bold icons** with one consistent outline weight; readable at a glance.
- **Decorative borders**: trees, bushes, hedges, little vehicles, flags around the
  field edges — they sell the "living airport" feel and host ambient animation.

Do: large touch targets · one consistent outline weight · soft shadows · readable
hierarchy. Don't: dense text · tiny tap targets · muddy/desaturated color · flat
no-shadow shapes · clashing outline weights.

## 3. Integration (how the art plugs in — no code rewrite needed)

The game renders from an SVG **sprite atlas** (`assets/sprites/planeflow-*.svg`),
where every fill/stroke is `var(--token, #fallbackhex)` so colors are re-themable
at runtime, with a **procedural fallback** when a sprite is missing. The engine
already has a **skin switch** (`SKIN = 'cozy' | 'neon'`, Settings → Skin). Adding
`'cartoon'` will follow the same pattern.

Two ways the cartoon art can ship — **prefer (B)** for the bays/planes/field
because cartoon *shapes* differ from cozy, and (A) for anything that only needs a
recolor:

- **(A) Recolor** — supply a cartoon **token palette** (the `*` values below) that
  re-tints the existing sprites/procedural shapes. Cheap, partial, good for HUD
  chips and icons.
- **(B) New cartoon sprites** — author cartoon **variants** of the field, bays and
  planes as new `<symbol>`s. Match the **viewBox, id naming and size** conventions
  in [`../../../sprites/README.md`](../../../sprites/README.md) so they slot into
  the atlas (e.g. a cartoon bay can be `bay-repair` in a cartoon sheet, or a new id
  the engine maps when `SKIN==='cartoon'`). Keep `var(--token,#hex)` recolor.

Deliver as **SVG `<symbol>`s** (vector, crisp at any DPR) following the existing
sheets, OR high-res PNG sprite sheets at the sizes listed in the sprite README.
Planes are authored **nose-up**, centered, 100×100 viewBox.

## 4. Mini-animations (why cartoon)

The cartoon background is meant to be **alive**. Animation is done on the **canvas**
(scale/fade/transform of static art), not baked into the SVG — so draw clean
"peak-pose" frames/atoms the engine can tween. Provide art for:

- **Existing service FX** (already wired): `fx-weld` (repair sparks), `fx-fuel`
  (droplets), `fx-boarding` (people walking to door), `fx-droplet` (de-ice).
  Redraw these in cartoon style.
- **Plane life**: idle bob/squash-stretch on landing & takeoff, prop/engine spin,
  little smoke puff (`fx-touchdown`, `fx-takeoff`).
- **Ambient (new, the fun part)**: swaying trees/bushes, shimmering water + slow
  waves, drifting clouds, a circling bird or two, a blinking control-tower light,
  a small service truck that drives along a bay, waving flags. These loop softly
  and never distract from the route-drawing.

For each animated element, deliver the **base sprite** plus any extra frames/atoms
(e.g. 2–3 cloud shapes, a tree in 1 pose + the engine sways it, a truck side view).
Mark loop length / suggested motion in the asset notes.

## 5. Cartoon token palette (starting point — refine against refs)

Re-tint these atlas tokens (names from `sprites/README.md`). Tune to `ref-01..03`:

```
field grass:  grass #6fbf4a · grass-dim #5aa83c · grass-tuft #8fd96a
water:        water #5fc7e8 · water-wave #8fe0f5 · water-wave2 #bff0fb · sand #e8d39a
panels/bays:  chip/purple-800 → #fff3d8 (cream panel) · outline → #3a2a17 (warm dark)
service:      repair/amber #ff8a1f · fuel/teal #1fb6d8 · board/rose #ff5ca0 · depart/gold #ffc62e
planes:       cream-100 #ffffff body · cream-outline #3a2a17 · windows #2f6fb0
hud/coin:     gold #ffce3a · life #ff4d5e · star #ffce3a
routes:       green #36d36b route + soft white nodes
```

(Keep a warm dark outline `#3a2a17` as the single outline color across the set.)

## 6. Asset checklist (what to draw)

Grouped by the atlas batches. ✅ = needed for the cartoon skin. Match ids/sizes in
[`../../../sprites/README.md`](../../../sprites/README.md).

### Field & world (`planeflow-field.svg`)
- [ ] `tile-grass` — seamless mowed-grass tile (subtle stripes/patches)
- [ ] `tile-water` — seamless cartoon water (gentle waves)
- [ ] `shore` — grass→sand→water seam tile
- [ ] `terminal` — cute cartoon terminal building (glossy roof, lit windows)
- [ ] `runway` — light cartoon runway strip + markings + edge lights
- [ ] `runway-threshold`, `runway-pointer`, `lamp`
- [ ] `bay-frame` / `bay-open` / `bay-locked` — glossy rounded stall, padlock + cost
- [ ] `bay-repair` / `bay-fuel` / `bay-board` — per-service colored stalls
- [ ] `bay-occupied`, `bay-progress`, `upgrade-pips`
- [ ] `route-line` / `route-line-selected` / `route-arrow`

### Aircraft & service icons (`planeflow-aircraft.svg`)
- [ ] `plane`, `plane-vip`, `plane-emergency`, `plane-medevac` — chunky cartoon, nose-up
- [ ] `ring-selected`, `ring-patience`, `ring-patience-low`
- [ ] `svc-repair`, `svc-fuel`, `svc-board`, `svc-depart` — big cartoon icon chips

### HUD (`planeflow-hud.svg`)
- [ ] `heart`, `heart-empty`, `heart-crack`
- [ ] `coin`, `star`, `star-empty`, `clock`, `pause`, `pause-btn`, `moon`, `zen-badge`, `check`
- [ ] goal progress bar styling + combo badge

### Effects & mini-animations (`planeflow-effects.svg`)
- [ ] `fx-weld`, `fx-fuel`, `fx-boarding`, `fx-droplet` (service)
- [ ] `fx-touchdown`, `fx-takeoff`, `fx-crash`, `fx-success`, `fx-error`, `fx-ripple`
- [ ] `fx-spark`, `fx-smoke`, `fx-dust`, `fx-board-dot`
- [ ] **Ambient (new):** tree, bush, cloud (×2–3), bird, control-tower light,
      service truck (side), flag — base art + motion notes

### Brand / menu (`planeflow-brand.svg`) — optional for a first pass
- [ ] `menu-bg` (sunny airport), `wordmark` styling, level-card thumbnail

## 7. Definition of done

- Every ✅ item drawn in the cartoon style, consistent outline weight & palette.
- Sizes/ids/viewBox match the sprite README so assets drop into the atlas.
- Colors via `var(--token,#hex)` (recolorable); planes nose-up & centered.
- Readability check: each silhouette reads in < 0.5 s; chips ≥ 44 px.
- Mini-animation elements delivered as clean peak-pose art + motion notes.
