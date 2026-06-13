# Neon skin — design brief

> **For the design agent.** This folder is the single source for producing the
> **neon** visual skin of PlaneFlow: the style description, reference images
> (`references/`), and the **asset checklist**. The engine seam is already built
> (see *Integration*) — drawn assets drop in with **no code changes**.

**Status:** the neon skin ships today as a **procedural placeholder** (engine-drawn
radar field + glow). It does *not* match the target polish — see
`references/current-procedural-placeholder.png` vs `references/ref-01-target-neon.png`.
Your job is to draw the real neon art that replaces the placeholder.

---

## 0. Audience & art intent (read first — it sets the tone)

**Who it's for:** **adults** who want a **calm, low-stimulation** session — the kind
of player who can zone in for an hour and *not feel tired or over-stimulated*.
People used to **understated, restrained** interfaces (think a quiet night control
tower, lo-fi ambient, a tidy dashboard) — not flashy mobile candy.

**So the neon here is CALM, not arcade-loud.** Tune every choice toward easy-on-the-
eyes:
- **Muted / desaturated** neon, not blazing. Accents *glow softly*, they don't scream.
  Lower the contrast and saturation vs a typical neon game; no harsh pure-white bloom.
- **Dark, even background** with gentle depth; minimal, slow motion (the radar sweep
  is slow and faint). Nothing strobes, pulses hard, or demands attention.
- **Generous spacing, clean type, few colors.** Restful, "professional night shift"
  vibe. Readable without being bright.
- A player should be able to stare at this for an hour comfortably. If an element
  feels punchy or tiring, dial it back.

> The `ref-01` image is the right *layout/structure*, but treat its glow/saturation as
> an **upper bound** — our neon is a softer, more grown-up, more muted version of it.

---

## 1. The locked gameplay layout (must NOT change)

Same spec as every skin (the skin changes looks, never positions):

- **Strict top-down**, no isometry. **Landscape ~16:9.**
- **Center = a large field** (the drawing canvas). HUD never overlaps it.
- **Planes arrive from the RIGHT**; **runways on the RIGHT**, horizontal.
- **Service bays on the BOTTOM, LEFT, TOP** (open = icon + label + upgrade; locked
  = padlock + cost chip).
- **Finger-drawn route** from a plane; selected plane has a ring, waiting planes a
  patience ring.
- **Slim top HUD:** lives · money · level + goal bar · timer · pause.
- **HARD RULE — no tiny UI.** Big, bold, readable icons & numbers, thumb-sized.

`references/ref-02-layout-mockup.png` = the layout; `ref-01-target-neon.png` = the
target art (what we're matching).

## 2. The neon style — calm night air-traffic-control

A quiet, **muted** dark control-room look (see §0 — calm beats flashy):

- **Dark, even navy/slate field** with a faint **radar** (concentric rings +
  crosshair + a slow, low-opacity sweep) and a subtle grid. *(Engine-drawn — see §4.)*
- **Rounded panels** for service bays — dark fill, a **soft neon colored edge** per
  service (muted amber repair / dusty teal fuel / soft rose boarding / pale cyan
  de-ice), a **gentle glow** (not bloom), a clear **large icon**, a **label** and a
  **cost chip**. Glossy but understated — matte-glass, not wet-shiny.
- **Runways** as dark rounded strips with **dim colored edge lights**, dashed
  centerline, clear runway numbers. Lights breathe slowly, never blink hard.
- **Planes**: clean light bodies with a **calm colored nose/livery**, thin neon
  outline, faint glow.
- **Route**: a soft cyan line with a *gentle* halo; finger cursor at the live end.
- **HUD**: dark translucent with neon-outlined value groups (heart · clock · coin ·
  goal · pause), big readable numerals — but low-key, not bright.

Consistent, **restrained** neon: one soft glow language, **muted accents on dark,
moderate contrast**, generous spacing, **large & readable**. The earlier in-engine
version was too small and plain; the fix is *bigger and richer*, **not louder**.

## 3. Color palette (the neon tokens already in the engine)

The skin recolors these atlas tokens (engine `NEON_TOKENS`); match/extend them:

```
bg/ink #070c1c · tarmac #0c1430 · tarmac-2 #0f1a3c · water #081024
accent/phosphor #3ad2ff (cyan) · text/cream-100 #dff4ff · muted #5f7bb0
repair/amber #ffb13b · fuel/teal #22e3c6 · board/rose #ff4f9d · deice/ice #5fd2ff
depart/gold #ffd23b · coin/gold #ffd23b · life #ff3b6b
```

Plus per-bay border accents seen in `ref-01` (orange/pink/green/cyan/purple).

> **Treat these as the *brightest* you'd go.** Per §0, the drawn art should lean
> **more muted/desaturated** — softer, dustier versions of these accents — so an hour
> of play stays comfortable. The vivid values above are mainly for procedural/HUD
> bits; in your PNGs, pull saturation and bloom *down*.

## 4. Format & integration — **deliver PNG** (the seam is built)

We use **raster PNG** sprites (not SVG) so the painterly glow/gloss/shadow is
**baked into the image** — reliable on Android (Chromium WebView) and iOS
(WKWebView), with no SVG-filter quirks to debug. The engine has a skin switch
(`SKIN = 'cozy' | 'neon'`, Settings → Skin / `?skin=neon`) and auto-loads PNG art.

**Deliverable — one transparent PNG per asset + a manifest:**
```
assets/sprites/neon/<id>.png          # e.g. assets/sprites/neon/bay-repair.png
assets/sprites/neon/manifest.json     # ["plane","bay-repair","svc-fuel", …]
```

**Rules (the engine relies on these):**
1. **File name = the base id + `.png`** (no prefix): `plane.png`, `bay-repair.png`,
   `svc-fuel.png`, `coin.png`, … The `neon/` folder already namespaces the skin.
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
still accepted as a fallback — resolution order is **PNG → skin-SVG → base →
procedural** — but **PNG is the target format**.)*

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
- [ ] **Toggle switch** (on/off), **segmented control** (language, skin), **chips**
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
- Verify by dropping the PNGs + `manifest.json` into `assets/sprites/neon/` and
  switching Settings → Skin → Neon (or `?skin=neon`): art appears, no code changes.
