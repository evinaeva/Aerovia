# Aerovia — Zone Skin Brief

Top-down air traffic controller. Dark neon theme (night radar look).

---

## MANDATORY: Scaling contract

> **Read this first. Every size requirement flows from here.**

One reference unit drives all geometry:

```
PLANE_LEN = 31 × PLANE_SCALE × ui
ui = clamp(0.7, min(W/1100, H/620), 1.5)   // screen scale factor
```

The engine stretches ONE sprite into whatever rectangle the zone occupies.
**Design in proportions to PLANE_LEN, not in absolute pixels.**

| ui | context | plane length | hangar side | runway width |
|----|---------|-------------|-------------|--------------|
| 0.7 | phone (min) | ≈ 22 px | ≈ 39 px | ≈ 27 px |
| 1.0 | medium screen | 31 px | 56 px | 38 px |
| 1.5 | large screen (max) | ≈ 46 px | ≈ 84 px | ≈ 57 px |

Rules that must hold at every size:
- Silhouette readable at **ui 0.7** (plane ≈ 22 px on screen).
- No fine text, no thin details, no baked perspective that breaks on resize.
- Borders/frames must stretch uniformly (9-slice mindset).

---

## Source PNG sizes

| sprite | engine proportion | draw at |
|--------|------------------|---------|
| hangar panel (`bay-*`) | 1.8 × PLANE_LEN square | **256 × 256** |
| runway strip (tile horizontally) | width = 1.23 × PLANE_LEN | height **192 px** |
| plane (`plane*`) | = PLANE_LEN | **256 × 256**, nose up, centred |
| service icon (`svc-*`) | ≈ PLANE_LEN | **160 × 160** |

---

## 1. Hangar

Square panel. Side = **1.8 × PLANE_LEN**. Gates face the apron (open side toward the field):
- top-row hangars → gates face **down**
- bottom-row hangars → gates face **up**

Hangars sit edge-to-edge in a continuous strip along the apron border.

### States — one sprite per state, per service type

| sprite id | description |
|-----------|-------------|
| `bay-locked` | dark panel, muted border; engine draws lock icon + price on top |
| `bay-fuel` | open, empty — teal accent |
| `bay-board` | open, empty — rose accent |
| `bay-repair` | open, empty — amber accent |
| `bay-deice` | open, empty — ice accent *(only if making winter content)* |

The engine draws **over every panel**: service icon, price tag, upgrade pips, progress ring, parked plane.  
**Do not bake any of these into the sprite.**

Leave the centre area clean for the parked plane and a corner area free for the upgrade chip.

---

## 2. Runway

Horizontal strip, right of the apron. Width (height on screen) = **1.23 × PLANE_LEN**.  
Up to 5 runways stacked vertically. Design one neutral/monochrome sprite — the engine applies per-runway colour tints.

Tile horizontally: draw end caps + a seamless centre section.

### States

| sprite id | description |
|-----------|-------------|
| `runway-open` | bright neon border, lights on |
| `runway-closed` | dimmed border, red **✕** cross, red fill |

---

## 3. Apron

Rectangular floor zone, ≈ 60 % of screen width. Keep the centre **empty** — planes taxi across it and the player draws routes here.

Design: floor material + border/lights only. No large central decorations.

---

## 4. Plane

Top-down airliner, **nose pointing up**, centred in a 256 × 256 PNG.  
The engine scales the same sprite: ×1.6 in the sky (far), ×1.35 on the ground/runway.

| sprite id | livery |
|-----------|--------|
| `plane` | standard — light body, neon outline + glow |
| `plane-vip` | gold body |
| `plane-emergency` | warm light body, red accents |
| `plane-medevac` | white body, red cross on fuselage |

Engine draws on top: selection/patience rings, service icon. Do not bake them.

---

## What to bake vs. what to leave for the engine

| Bake into PNG ✅ | Leave for the engine ❌ |
|-----------------|------------------------|
| Glow, neon border, gloss | Service icon |
| Gradients, soft shadow | Price tag |
| Floor texture, wall material | Upgrade pips |
| Gate shape, runway markings | Progress ring |
| | Parked plane inside hangar |

---

## Delivery

- Format: **transparent PNG-32**, filenames = base id (`bay-fuel.png`, `plane.png`, …)
- Sizes from the table above.
- Group by zone in one archive; owner tests in the workbench (`tuning.html` → Skins tab).
- Multiple variants of one zone are fine — owner picks in the workbench.

## Definition of done

- [ ] All states from §1–§4 delivered.
- [ ] Silhouette reads at ui 0.7 (plane ≈ 22 px) without breaking.
- [ ] Proportions correct: hangar ≈ 1.8 × PLANE_LEN, runway width ≈ 1.23 × PLANE_LEN.
- [ ] Hangar panels empty — no baked icons, prices, pips, or plane inside.
- [ ] Plane sprites: nose up, centred, 256 × 256.
- [ ] No pixel-locked details that fall apart when the engine stretches the sprite.
