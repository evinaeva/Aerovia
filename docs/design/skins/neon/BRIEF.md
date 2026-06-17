# Neon look — design brief

> **For the design agent.** This folder is the single source for producing the
> **neon** look of PlaneFlow: the style description, reference images
> (`references/`), and the **asset checklist**. The engine seam is already built
> (see *Integration*) — drawn assets drop in with **no code changes**.
>
> **Where to get assets cheaply (free-first, all PNG):** see
> [`SOURCING.md`](SOURCING.md) — most icons/particles are free (Kenney CC0,
> game-icons CC-BY, exported as colored PNGs); only the ~5 glossy bay panels truly
> need generation.

**Status:** the look ships today as a **procedural placeholder** + a flat
code-drawn vector pass — **neither matches the target**. Compare
`references/current-procedural-placeholder.png` and the flat vector sheet vs the goal,
`references/ref-01-target-neon.png`. The goal is to **match `ref-01` closely** (its
glossy, rendered look) — see §0.5 for *how* (it must be image-generated, not
code-drawn).

---

## 0. Audience & art intent (read first)

**Who it's for:** **adults** who want a **comfortable, long** session (an hour without
eye-fatigue). Comfort comes from a **deep dark base + controlled contrast**, *not* from
making things flat or washed-out. The **UI elements themselves are richly rendered and
glossy — exactly like `ref-01`.**

**Target = match `ref-01` (the reference) closely.** That means:
- **Glossy, dimensional panels** — smooth gradients, a soft top sheen, a rounded
  **neon colored rim with real bloom/glow**, subtle inner shadow. Premium mobile-game
  finish, like the reference — *not* flat rectangles with a thin stroke.
- **Saturated neon accents on a deep dark field.** Rich, glowing — but sitting on a
  calm near-black background so the overall screen still reads restful (the dark base
  is what keeps it easy on the eyes, not desaturating the accents).
- **Big, polished icons** with their own shading/glow. **Crisp, readable.**

> Earlier this brief said "muted / pull saturation down". **That was wrong for what
> you want — ignore it.** Match the reference's vivid, glossy neon; keep it
> comfortable via the *dark background and spacing*, not by dulling the art.

---

## 0.5 How to PRODUCE the assets — **image-generation, NOT code-drawing**

The flat results so far happened because the assets were **drawn with code (vector
shapes)** — clean but inherently flat. **Vector/code cannot reproduce the reference's
rendered gloss.** To match `ref-01`, **every asset must be made with an image-generation
model** (Midjourney / SDXL / Flux / DALL·E / Nano-Banana / etc.) in **image-to-image**
mode, then exported as a transparent PNG.

**Per-asset workflow**
1. **image-to-image / "style reference"** using `references/ref-01-target-neon.png` as
   the look anchor (medium denoise so it keeps the reference's material & finish).
2. Generate **one isolated object**, centered, on a **flat magenta `#ff00ff`** (or
   transparent) background — no scene, no other objects, **no baked text**.
3. Upscale → **remove background** → **transparent PNG-32** at the §6 size.
4. Keep the **same panel material/rim treatment across all bays** (batch them / reuse a
   seed) so the set is consistent.

**Shared style anchor — prepend to every prompt:**
> `glossy dark neon game-UI asset, matching the attached reference: deep navy-black
> smooth gradient fill, soft top sheen, rounded glowing neon rim with bloom, premium
> mobile-game finish, crisp high detail, single centered object isolated on flat
> magenta background, no text, no scene — [ASSET]`

**Negative prompt (always):**
> `flat, dull, matte, low-contrast, sketch, hand-drawn, watermark, text, label,
> multiple objects, busy background, realistic photo`

**`[ASSET]` per file** (one PNG each; ids/sizes in §6):
| file | `[ASSET]` phrase |
| --- | --- |
| `bay-repair` | rounded rectangular service-bay panel, glowing **orange** neon rim, **empty inside** |
| `bay-fuel` | …glowing **teal/cyan** rim, empty inside |
| `bay-board` | …glowing **pink/magenta** rim, empty inside |
| `bay-deice` | …glowing **ice-blue** rim, empty inside |
| `bay-locked` | dim dark panel, faint **grey** rim, slightly desaturated (locked), empty |
| `plane` | top-down airliner, glossy white body, cyan neon outline + soft glow, **nose UP** |
| `plane-vip` / `-emergency` / `-medevac` | gold body / red accents / white with red cross |
| `svc-repair` / `-fuel` / `-board` / `-depart` | glossy neon **gear** (orange) / **droplet** (teal) / **person** (pink) / **up-plane** (gold) icon chip |
| `coin` / `heart` / `star` / `clock` / `check` / `moon` | glossy neon coin / heart / star / clock / check / moon |
| `pause-btn` / `zen-badge` | rounded glossy dark button with neon pause bars / neon moon |
| `fx-*` | neon particle burst / glowing ring, soft bloom, peak pose |

> **Bays are empty glossy panels** — do **not** generate an icon/label/cost inside them
> (the engine overlays those live). Planes **centered & nose-up**.

If your tool can't do transparent output directly, generate on flat magenta and key it
out. Generate at **≥ the §6 size** (bigger then downscale = crisper).

---

## 1. Gameplay layout — only the HUD & the plane-needs info bar are fixed

**Field-element placement is not a requirement.** Where the apron, the service bays and
the runways sit — and which edge faces what — is the implementation's call (responsive,
level-driven). The look changes appearance, never the few parts that ARE fixed:

- **Strict top-down**, no isometry. **Landscape ~16:9.**
- **Center = a large field** (the drawing canvas). HUD never overlaps it.
- **Finger-drawn route** from a plane; selected plane has a ring, waiting planes a
  patience ring.
- **Slim top HUD:** lives · money · level + goal bar · timer · pause.
- **Plane-needs info bar:** a tapped plane's service chain + patience, docked under the HUD.
- **HARD RULE — no tiny UI.** Big, bold, readable icons & numbers, thumb-sized.

`references/ref-02-layout-mockup.png` shows **one** arrangement (illustrative, not a
spec); `ref-01-target-neon.png` = the target art (what we're matching).

## 2. The neon look — glossy night air-traffic-control (match `ref-01`)

A polished dark control-room look — **rendered, glossy, glowing**, like the reference:

- **Deep dark navy/black field** with a **radar** (concentric rings + crosshair + slow
  sweep) and a subtle grid. *(Engine-drawn — see §4.)*
- **Glossy dimensional panels** for service bays — smooth gradient fill, a soft top
  sheen, a **rounded neon colored rim with real bloom/glow** per service (orange repair
  / cyan fuel / pink boarding / ice-blue de-ice), subtle inner shadow. Premium finish —
  *not* a flat rect with a thin stroke. The engine overlays the icon/label/cost.
- **Runways** as dark rounded strips with **colored neon edge lights**, dashed
  centerline, clear runway numbers.
- **Planes**: glossy light bodies with a **colored nose/livery**, neon outline + glow.
- **Route**: a glowing cyan line with a soft halo; finger cursor at the live end.
- **HUD**: dark translucent with neon-rendered value chips (heart · clock · coin ·
  goal · pause), big crisp numerals with subtle glow.

Consistent, **rich** neon: one glossy glow language, **saturated accents on a deep dark
base**, generous spacing, **large & readable**. Comfort comes from the dark base — not
from dulling the art.

## 3. Color palette (the neon tokens already in the engine)

The look recolors these atlas tokens (engine `NEON_TOKENS`); match/extend them:

```
bg/ink #070c1c · tarmac #0c1430 · tarmac-2 #0f1a3c · water #081024
accent/phosphor #3ad2ff (cyan) · text/cream-100 #dff4ff · muted #5f7bb0
repair/amber #ffb13b · fuel/teal #22e3c6 · board/rose #ff4f9d · deice/ice #5fd2ff
depart/gold #ffd23b · coin/gold #ffd23b · life #ff3b6b
```

Plus per-bay border accents seen in `ref-01` (orange/pink/green/cyan/purple).

> These are the engine's recolor tokens (used for procedural/HUD bits). For the drawn
> PNGs, **match the reference's vivid, glossy neon** — these hexes are a starting point,
> not a ceiling. Saturation/glow should read like `ref-01`, sitting on the deep dark base.

## 4. Format & integration — **deliver PNG** (the seam is built)

We use **raster PNG** sprites (not SVG) so the painterly glow/gloss/shadow is
**baked into the image** — reliable on Android (Chromium WebView) and iOS
(WKWebView), with no SVG-filter quirks to debug. The engine auto-loads the PNG art.

**Deliverable — one transparent PNG per asset + a manifest:**
```
assets/sprites/neon/<id>.png          # e.g. assets/sprites/neon/bay-repair.png
assets/sprites/neon/manifest.json     # ["plane","bay-repair","svc-fuel", …]
```

**Rules (the engine relies on these):**
1. **File name = the base id + `.png`** (no prefix): `plane.png`, `bay-repair.png`,
   `svc-fuel.png`, `coin.png`, … The `neon/` folder already namespaces the art.
2. **`manifest.json` lists every id you ship** (JSON array of strings). The engine
   loads it and draws `neon/<id>.png` for each listed id instead of the procedural
   placeholder — **no code changes, no reload** (repaints when ready).
3. **Bake everything into the PNG**: glow, gloss, gradients, soft shadow, neon border.
   No live filters/tokens. **PNG-32 with alpha** (transparent background).
4. **Author at ~3× on-screen size** for retina (engine scales down crisply). Center
   the content; **planes nose-up**. Target pixel sizes:

   | id | on-screen | author PNG |
   | --- | --- | --- |
   | `bay-repair/fuel/board/deice/locked` | ~96×72 | **320×240** |
   | `plane`, `plane-vip`, `plane-emergency`, `plane-medevac` | ~50 | **256×256** |
   | `svc-repair/fuel/board/depart` | ~45 | **160×160** |
   | `coin`, `heart`, `star`, `clock`, `check` | ~24 | **96×96** |
   | `pause-btn`, `zen-badge` | ~56 | **192×192** |
   | `fx-*` | ~56–80 | **256×256** |

5. **Bay panels** = the **whole glossy neon panel** (rounded box, colored neon border,
   baked glow, gloss). **Do NOT bake the service icon, label, cost, upgrade pips or
   progress ring** — the engine overlays those live. Panel canvas ≈ 320×240 (the bay
   aspect; transparent margins ok).
6. **Field stays engine-drawn** (the neon radar in §2) — you don't draw the field/
   terminal/water. Focus on bays, planes, icons, HUD chips and effects on top of it.
7. **Runways & HUD** are engine-drawn neon today; ship HUD PNG chips (`coin`, `heart`,
   `pause-btn`, …) and they're picked up — otherwise they recolor procedurally.

*(SVG `<symbol>` sheets with a `neon-` id prefix under `assets/sprites/neon/` are
still accepted as a fallback — resolution order is **PNG → SVG → procedural** — but
**PNG is the target format**.)*

## 5. Animations (keep them slow & soft — see §0)

Animation is canvas-side (the engine tweens static art): deliver clean **peak-pose**
art + a short motion note (loop length, easing). For neon, motion is **gentle and
slow** — nothing strobes or snaps.

- **Service FX:** `fx-weld` (soft sparks), `fx-fuel` (droplets), `fx-boarding`
  (figures step in), `fx-droplet` (de-ice) — muted neon, gentle.
- **Plane life:** `fx-touchdown` (soft puff), `fx-takeoff` (slow streak), subtle idle
  hover; engine spin if wanted.
- **Feedback:** `fx-crash`, `fx-success`, `fx-error`, `fx-ripple` — calm pulses, no
  harsh flashes.
- **Ambient (optional):** slow radar sweep + faint blips, a quiet breathing glow on
  active panels. Restful, never attention-grabbing.
- **UI micro-interactions:** soft button press (slight scale + glow), smooth fades
  between screens, gentle toast slide-in, `+N` money float, combo tick. All soft
  ease-in/out.

## 6. Asset checklist (what to draw) — each shipped as `assets/sprites/neon/<id>.png`

File names use the **base id** (no prefix); list every shipped id in `manifest.json`.

### Bays — full glossy neon panels (320×240)
- [ ] `bay-repair` · `bay-fuel` · `bay-board` · `bay-deice` — panel + colored neon
      border + baked glow/gloss (no baked icon/label/cost)
- [ ] `bay-locked` — dark panel + neon border (no baked padlock/cost)

### Aircraft & icons
- [ ] `plane`, `plane-vip`, `plane-emergency`, `plane-medevac` (256×256) — bright
      body, colored nose/livery, neon outline + baked glow, **nose-up, centered**
- [ ] `ring-selected`, `ring-patience`, `ring-patience-low` (256×256)
- [ ] `svc-repair`, `svc-fuel`, `svc-board`, `svc-depart` (160×160) — big neon icon
      chips (used above planes and as bay/HUD icons)

### HUD chips (96×96, except buttons 192×192)
- [ ] `heart`, `heart-empty`, `heart-crack`
- [ ] `coin`, `star`, `star-empty`, `clock`, `check`, `moon`
- [ ] `pause-btn`, `zen-badge`

### Effects / animations (256×256, peak-pose + motion note)
- [ ] `fx-weld`, `fx-fuel`, `fx-boarding`, `fx-droplet` (service)
- [ ] `fx-touchdown`, `fx-takeoff`, `fx-crash`, `fx-success`, `fx-error`, `fx-ripple`
- [ ] `fx-spark`, `fx-smoke`, `fx-dust`, `fx-board-dot`

### Menus & screens (DOM — themed via a CSS palette + a few backgrounds)
> Menus are HTML/CSS overlays, not canvas sprites. Deliver a **neon CSS palette**
> (surface/card/border/text/accent values) + the listed background/art bits. Every
> screen below needs a neon treatment:
- [ ] **Start / main menu** — background art/gradient, wordmark/logo, the action rail
- [ ] **Level select** — the «luggage-cart» route map: track, **level node** (locked /
      current / done states), star row, back
- [ ] **Shift goals** dialog (3 star tiers) · **Pause** (dimmed field + buttons) ·
      **End of shift** (stars + stat chips) · **Settings** (rows + toggles + segmented
      controls) · **Medals** grid · **Reset confirm**
- [ ] **Toasts** (life lost / level passed / +money) · **panels/cards** & dividers

### Buttons & controls (DOM — define neon states)
- [ ] Button styles: **primary**, **secondary/ghost**, **danger** — idle / hover /
      pressed / disabled
- [ ] **Toggle switch** (on/off), **segmented control** (language), **chips**
      (cost / star count), **progress bar** (goal), **combo badge**

### Menu icons (small, consistent set)
- [ ] `play`, `zen`/moon, `maps`, `medals`, `settings`/gear, `fullscreen`, `share`,
      `back`, `star`, `lock` — single-weight neon glyphs

### Brand / app
- [ ] `wordmark` + logo mark (neon) · `menu-bg` · **app icon** + splash (store/PWA)

## 7. Definition of done

- All ✅ items drawn in the neon style; one consistent baked glow/outline language.
- **PNG-32 + alpha**, base-id file names, listed in `manifest.json`, authored at the
  target sizes above. Planes nose-up & centered; bay panels carry **no** baked
  icon/label/cost/progress.
- Big & readable: silhouettes read in < 0.5 s; on-screen chips ≥ 44 px.
- Verify by dropping the PNGs + `manifest.json` into `assets/sprites/neon/`: art
  appears, no code changes.
