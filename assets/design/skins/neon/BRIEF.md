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

## 2. The neon style (match `ref-01`)

Dark arcade **air-traffic-control** look:

- **Dark navy/black field** with a faint **radar** (concentric rings + crosshair +
  slow sweep) and a subtle grid. *(The engine already draws this field — see §4.)*
- **Big glossy rounded panels** for service bays — dark fill, a **bright neon
  colored border** per service (orange repair / pink boarding / green / cyan fuel /
  purple VIP), soft outer **glow/bloom**, a **large icon**, a **label**
  (REPAIR / FUEL / BOARDING / …) and a **cost chip**.
- **Runways** as dark rounded strips with **colored neon edge lights** (pink / teal /
  green / magenta), dashed centerline, big runway numbers.
- **Planes**: bright bodies with **colored nose/livery**, neon outline, subtle glow.
- **Route**: a glowing cyan/white line with bloom; finger cursor at the live end.
- **HUD**: dark translucent with neon-outlined value groups (heart · clock · coin ·
  target/goal · pause), big bold numerals.

Consistent neon look: one outline/glow language, saturated accents on dark, high
contrast, **everything large and readable**. The earlier in-engine version was too
small and too plain — fix that.

## 3. Color palette (the neon tokens already in the engine)

The skin recolors these atlas tokens (engine `NEON_TOKENS`); match/extend them:

```
bg/ink #070c1c · tarmac #0c1430 · tarmac-2 #0f1a3c · water #081024
accent/phosphor #3ad2ff (cyan) · text/cream-100 #dff4ff · muted #5f7bb0
repair/amber #ffb13b · fuel/teal #22e3c6 · board/rose #ff4f9d · deice/ice #5fd2ff
depart/gold #ffd23b · coin/gold #ffd23b · life #ff3b6b
```

Plus per-bay border accents seen in `ref-01` (orange/pink/green/cyan/purple).

## 4. Integration — the seam is already built

The engine has a **skin switch** (`SKIN = 'cozy' | 'neon'`, Settings → Skin /
`?skin=neon`). For neon it currently renders **procedurally**. To swap in real art:

**Drop SVG sprite sheets here:**
```
assets/sprites/neon/planeflow-aircraft.svg
assets/sprites/neon/planeflow-field.svg
assets/sprites/neon/planeflow-hud.svg
assets/sprites/neon/planeflow-effects.svg
assets/sprites/neon/planeflow-brand.svg   (optional, menu/brand)
```

**Rules (the engine relies on these):**
1. **Prefix every `<symbol id>` with `neon-`** — e.g. `neon-plane`, `neon-svc-fuel`,
   `neon-bay-repair`, `neon-coin`. The atlas resolves `neon-<id>` ahead of the base
   `<id>` when the neon skin is active, so your art overrides the placeholder
   automatically; nothing else needs prefixing.
2. **Same ids / viewBox / sizes** as the base sheets — see
   [`../../../sprites/README.md`](../../../sprites/README.md). Use `var(--token,#hex)`
   for colors so they stay recolorable.
3. As soon as ≥1 neon symbol loads, the engine flips that skin from procedural to
   sprite-driven (`A.skinReady`) and repaints — no reload, no code edit.
4. **Bay panels** use a new full-panel hook: author `neon-bay-repair`,
   `neon-bay-fuel`, `neon-bay-board`, `neon-bay-locked` as the **whole glossy
   panel** (rounded neon-bordered box + glow). **Do NOT bake the service icon, label,
   cost, upgrade pips or progress ring** — the engine overlays those on top (so they
   stay dynamic). Panel size = the bay box (~88–100 px square-ish).
5. **The field stays engine-drawn** (the neon radar in §2) — you do **not** need to
   draw the field/terminal/grass/water. Focus art on bays, planes, icons, HUD chips
   and effects that sit on the radar. (If later we want a drawn field, add
   `neon-tile-*` / `neon-terminal` and they'll be picked up too.)
6. **Runways & HUD** are currently engine-drawn neon; recolor only. (Optional future
   hooks for `neon-runway` / HUD chips can be added if you want full control.)

## 5. Mini-animations

Animation is canvas-side (the engine tweens static art). Redraw the service/feedback
FX in neon: `fx-weld`, `fx-fuel`, `fx-boarding`, `fx-droplet`, `fx-touchdown`,
`fx-takeoff`, `fx-crash`, `fx-success`, `fx-error`, `fx-ripple` — bright neon
particles/rings with glow. Optional ambient: radar blips, scanning glints.

## 6. Asset checklist (what to draw) — all ids get the `neon-` prefix

### Bays — full glossy neon panels (`planeflow-field.svg`)
- [ ] `neon-bay-repair` · `neon-bay-fuel` · `neon-bay-board` — panel + colored neon
      border + glow (no baked icon/label/cost)
- [ ] `neon-bay-locked` — dark panel + neon border (no baked padlock/cost)

### Aircraft & icons (`planeflow-aircraft.svg`)
- [ ] `neon-plane`, `neon-plane-vip`, `neon-plane-emergency`, `neon-plane-medevac`
      — bright body, colored nose/livery, neon outline + glow, nose-up
- [ ] `neon-ring-selected`, `neon-ring-patience`, `neon-ring-patience-low`
- [ ] `neon-svc-repair`, `neon-svc-fuel`, `neon-svc-board`, `neon-svc-depart`
      — big neon icon chips (used both above planes and as bay/HUD icons)

### HUD (`planeflow-hud.svg`)
- [ ] `neon-heart`, `neon-heart-empty`, `neon-heart-crack`
- [ ] `neon-coin`, `neon-star`, `neon-star-empty`, `neon-clock`, `neon-pause`,
      `neon-pause-btn`, `neon-moon`, `neon-zen-badge`, `neon-check`

### Effects (`planeflow-effects.svg`)
- [ ] neon versions of `fx-weld/fuel/boarding/droplet/touchdown/takeoff/crash/
      success/error/ripple/spark/smoke/dust/board-dot`

### Optional (later)
- [ ] `neon-tile-*`, `neon-terminal`, `neon-runway`, `neon-menu-bg`

## 7. Definition of done

- All ✅ items drawn in the neon style; one consistent glow/outline language.
- `neon-`-prefixed ids, sizes/viewBox per the sprite README, `var(--token,#hex)`.
- Bay panels carry **no** baked icon/label/cost/progress; planes nose-up & centered.
- Big & readable: silhouettes read in < 0.5 s; chips ≥ 44 px.
- Verify by dropping the sheets into `assets/sprites/neon/` and switching
  Settings → Skin → Neon (or `?skin=neon`): art appears with no code changes.
