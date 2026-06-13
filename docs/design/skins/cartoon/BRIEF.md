# Cartoon skin — design brief

> **For the design agent.** This folder is the single source for producing the
> **cartoon** visual skin of PlaneFlow: the style description, the reference
> images (`references/`), and the **asset checklist** of everything to draw.
> Read this top-to-bottom before drawing. Produce assets that drop into the
> existing sprite atlas without code changes (see *Integration*).

Chosen because the cartoon look best supports the planned **mini-animations**
(lively, bouncy, ambient motion) — see *Mini-animations* below.

---

## 0. Audience & art intent (read first) — plus an honest genre caveat

**Intended vibe:** bright, friendly, playful — the lively counterpart to the calm
adult **neon** skin. Saturated, bouncy, "living airport" energy; lots of small
ambient motion. This is the **mass-casual / younger & family-friendly** look.

**Honest market note (worth weighing before investing):** the framing was
"cartoon = for teens" — but realistically **teens are not the core of this genre.**
Route-drawing / airport-manager / time-management games (Flight Control, Airport
City, Township-likes, Sky Patrol) skew to a **broad adult casual** audience (often
25–55, strong female share) who play to relax. Teens lean toward social/competitive/
action titles (Roblox, shooters, sports, battle-royale), not finger-routing tycoon-
lite. So:
- Don't narrowly target "teen" aesthetics; aim for **bright, approachable, all-ages
  casual** — appeals to younger players *and* the genre's real adult-casual base.
- Think of the two skins as a **mood A/B**, not strict age buckets: **neon = calm,
  understated, grown-up**; **cartoon = bright, cheerful, broadly casual.**

(If we later learn the actual player base skews very adult, the cartoon skin still
earns its place as the "bright/cozy" option — just don't over-index on "teen".)

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

## 3. Format & integration — **deliver PNG** (the seam is built)

We use **raster PNG** sprites so the painted gloss, soft shadows and lush textures
are **baked into the image** — reliable on Android (Chromium WebView) and iOS
(WKWebView), nothing to debug. The engine auto-loads per-skin PNG art.

**Deliverable — one transparent PNG per asset + a manifest:**
```
assets/sprites/cartoon/<id>.png        # e.g. assets/sprites/cartoon/bay-repair.png
assets/sprites/cartoon/manifest.json   # ["plane","bay-repair","tile-grass", …]
```

**Rules (the engine relies on these):**
1. **File name = the base id + `.png`** (no prefix): `plane.png`, `bay-repair.png`,
   `tile-grass.png`, `coin.png`, … The `cartoon/` folder namespaces the skin.
2. **`manifest.json` lists every id you ship** (JSON array). The engine draws
   `cartoon/<id>.png` for each listed id; resolution order is **PNG → skin-SVG →
   base cozy → procedural**, live, with no code changes / reload.
3. **Bake everything into the PNG**: gradients, gloss, soft drop shadow, outline.
   **PNG-32 + alpha** (transparent background). No live filters.
4. **Author at ~3× on-screen size**; center content; **planes nose-up**. Sizes:

   | id | on-screen | author PNG |
   | --- | --- | --- |
   | `bay-*` panels | ~96×72 | **320×240** |
   | `plane*` | ~50 | **256×256** |
   | `svc-*` icons | ~45 | **160×160** |
   | `tile-grass/water`, `shore` | seamless tile | **256×256 seamless** |
   | `terminal` | building | **512×384** |
   | `runway` | strip | **480×140** |
   | HUD chips (`coin`,`heart`,…) | ~24 | **96×96** |
   | `pause-btn`,`zen-badge` | ~56 | **192×192** |
   | `fx-*`, ambient (tree/cloud/truck/…) | ~56–96 | **256×256** |

5. **Bay panels** = the **whole glossy stall/building**; **don't bake the icon,
   label, cost, pips or progress** — the engine overlays those live.
6. **Tiles** (`tile-grass`, `tile-water`, `shore`) must be **seamlessly tileable**
   (the engine repeats them as a pattern).

**Engine notes (small, tracked — not your concern to code):**
- The PNG seam (`assets/sprites/<skin>/` + manifest) already exists and works for any
  skin name. Enabling **cartoon** in the UI is a tiny step: add it to the
  Settings → Skin switch + a cartoon token palette for any procedural bits. We'll do
  that when your assets land.
- Unlike neon (engine-drawn radar field), cartoon wants a **drawn field**. Bays /
  planes / icons / HUD / effects drop in cleanly via PNG; the **apron/field framing**
  has a couple of baked cozy colors, so a **minor engine tweak** is needed to make the
  whole field read cartoon once `tile-grass/water` + `terminal` PNGs exist. Tracked —
  just deliver the tiles and we wire it.

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

## 6. Asset checklist (what to draw) — each shipped as `assets/sprites/cartoon/<id>.png`

File names use the **base id** (no prefix); list every shipped id in `manifest.json`.

### Field & world
- [ ] `tile-grass` — **seamless** mowed-grass tile (subtle stripes/patches)
- [ ] `tile-water` — **seamless** cartoon water (gentle waves)
- [ ] `shore` — grass→sand→water seam tile
- [ ] `terminal` — cute cartoon terminal building (glossy roof, lit windows)
- [ ] `runway` (+ optional `runway-threshold`, `runway-pointer`, `lamp`)

### Bays — full glossy stalls (320×240, no baked icon/label/cost)
- [ ] `bay-repair` · `bay-fuel` · `bay-board` · `bay-deice` — per-service colored stalls
- [ ] `bay-locked` — locked stall (no baked padlock/cost)

### Aircraft & service icons
- [ ] `plane`, `plane-vip`, `plane-emergency`, `plane-medevac` — chunky cartoon, **nose-up**
- [ ] `ring-selected`, `ring-patience`, `ring-patience-low`
- [ ] `svc-repair`, `svc-fuel`, `svc-board`, `svc-depart` — big cartoon icon chips

### HUD chips
- [ ] `heart`, `heart-empty`, `heart-crack`
- [ ] `coin`, `star`, `star-empty`, `clock`, `check`, `moon`
- [ ] `pause-btn`, `zen-badge`

### Effects & mini-animations
- [ ] `fx-weld`, `fx-fuel`, `fx-boarding`, `fx-droplet` (service)
- [ ] `fx-touchdown`, `fx-takeoff`, `fx-crash`, `fx-success`, `fx-error`, `fx-ripple`
- [ ] `fx-spark`, `fx-smoke`, `fx-dust`, `fx-board-dot`
- [ ] **Ambient (new):** tree, bush, cloud (×2–3), bird, control-tower light,
      service truck (side), flag — base PNG + motion notes (engine tweens them)

### Menus & screens (DOM — themed via a CSS palette + a few backgrounds)
> Menus are HTML/CSS overlays, not canvas sprites. Deliver a **cartoon CSS palette**
> (surface/card/border/text/accent) + the background/art bits. Each screen needs a
> cartoon treatment:
- [ ] **Start / main menu** — sunny background art, wordmark/logo, action rail
- [ ] **Level select** — the «luggage-cart» route map: track, **level node** (locked /
      current / done), star row, back
- [ ] **Shift goals** dialog · **Pause** (dimmed field + buttons) · **End of shift**
      (stars + stat chips) · **Settings** (rows + toggles + segmented controls) ·
      **Medals** grid · **Reset confirm**
- [ ] **Toasts** (life lost / level passed / +money) · **panels/cards** & dividers

### Buttons & controls (DOM — define cartoon states)
- [ ] Button styles: **primary**, **secondary/ghost**, **danger** — idle / hover /
      pressed / disabled (chunky, rounded, soft shadow)
- [ ] **Toggle switch**, **segmented control** (language, skin), **chips**
      (cost / stars), **progress bar** (goal), **combo badge**

### Menu icons (consistent chunky set)
- [ ] `play`, `zen`/moon, `maps`, `medals`, `settings`/gear, `fullscreen`, `share`,
      `back`, `star`, `lock`

### Brand / app
- [ ] `wordmark` + logo mark · `menu-bg` (sunny airport) · level-card thumbnail ·
      **app icon** + splash (store/PWA)

## 7. Definition of done

- Every ✅ item drawn in the cartoon style, consistent outline weight & palette.
- **PNG-32 + alpha**, base-id file names, listed in `manifest.json`, authored at the
  §3 sizes. Tiles seamless; planes nose-up & centered; bay panels carry **no** baked
  icon/label/cost/progress.
- Readability: each silhouette reads in < 0.5 s; on-screen chips ≥ 44 px.
- Mini-animation elements delivered as clean peak-pose PNGs + motion notes.
- Verify by dropping the PNGs + `manifest.json` into `assets/sprites/cartoon/` and
  selecting the cartoon skin (we enable it in Settings when assets land).
