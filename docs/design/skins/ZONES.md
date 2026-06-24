# Aerovia — Zone Skin Specification

> You are a designer. Your task is to draw all the sprites described below
> and pack them into an archive following the structure in the "Archive structure" section exactly.
> Do not touch the repo. Just draw and pack.

---

## What to draw — by zone

### 1. Hangar (`hangar/`) — 5 sprites, 256 × 256 px each

Square hangar panel. Gates face **downward** (toward the apron).
The center of the panel must be **empty** — the engine places the plane there itself.
Leave a corner free (usually top-right) — the engine draws the upgrade chip there.

The engine draws on top: service icon, price tag, upgrade dots, progress ring, plane.
**Do not draw any of these in the PNG.**

| File | Service |
|------|---------|
| `bay-fuel.png` | Refueling |
| `bay-board.png` | Boarding |
| `bay-repair.png` | Repair |
| `bay-deice.png` | De-icing |
| `bay-locked.png` | Locked |

---

### 2. Apron (`apron/`) — 1 sprite, 512 × 512 px

Rectangular taxiing area. Center **empty** — planes taxi here and the player draws routes.

File: `apron.png`

---

### 3. Runway (`runway/`) — 1 sprite, 512 × 192 px

Horizontal runway strip. The engine stretches it horizontally.

File: `runway.png`

---

### 4. Plane (`plane/`) — 1 sprite, 256 × 256 px

Top-down view, **nose pointing up**, centered on the canvas.
The engine draws status rings and icons on top — do not include those.

File: `plane.png`

---

### 5. Arrival (`arrival/`) — 1 sprite, 512 × 512 px

Incoming-plane zone (apron equivalent for arrival routes). Center empty.

File: `arrival.png`

---

### 6. Background (`background/`) — 1 sprite, 1920 × 1080 px

Full field background. Drawn beneath all zones. No transparency.

File: `background.png`

---

## What to bake into the PNG — what not to

| Bake into PNG ✅ | Do NOT draw ❌ |
|-----------------|----------------|
| Floor / wall / surface material | Service icons |
| Gate shape, markings, decor | Hangar price tag |
| Visual effects (glow, shadows, gradients) | Upgrade dots |
| | Progress ring |
| | Plane inside the hangar |

---

## File format

| Zone | Canvas size | Transparency |
|------|-------------|--------------|
| Hangar (5 files) | 256 × 256 px | PNG-32 with alpha channel |
| Apron | 512 × 512 px | PNG-32 with alpha channel |
| Runway | 512 × 192 px | PNG-32 with alpha channel |
| Plane | 256 × 256 px | PNG-32 with alpha channel |
| Arrival | 512 × 512 px | PNG-32 with alpha channel |
| Background | 1920 × 1080 px | No transparency (RGB) |

Details must be legible at ~22 px tall (the minimum hangar size on screen) — verify by scaling down.

---

## Archive structure

Pack into exactly this structure. Replace `<name>` with a short lowercase ASCII slug for your skin
(e.g. `arctic`, `retro`, `day`). Folder and file names are fixed — follow them exactly.

```
skins/
  hangar/
    <name>/
      skin.json
      bay-fuel.png
      bay-board.png
      bay-repair.png
      bay-deice.png
      bay-locked.png
  apron/
    <name>/
      skin.json
      apron.png
  runway/
    <name>/
      skin.json
      runway.png
  plane/
    <name>/
      skin.json
      plane.png
  arrival/
    <name>/
      skin.json
      arrival.png
  background/
    <name>/
      skin.json
      background.png
```

---

## skin.json contents

Every zone folder must contain a `skin.json`. The format is the same for all zones.
`id` is a unique identifier: `<zone>-<name>`. `label` is the display name shown in the UI.

**`hangar/<name>/skin.json`:**
```json
{
  "id": "hangar-<name>",
  "label": "<Display name>",
  "states": {
    "fuel":   "bay-fuel.png",
    "board":  "bay-board.png",
    "repair": "bay-repair.png",
    "deice":  "bay-deice.png",
    "locked": "bay-locked.png"
  }
}
```

**`apron/<name>/skin.json`:**
```json
{
  "id": "apron-<name>",
  "label": "<Display name>",
  "states": { "default": "apron.png" }
}
```

**`runway/<name>/skin.json`:**
```json
{
  "id": "runway-<name>",
  "label": "<Display name>",
  "states": { "default": "runway.png" }
}
```

**`plane/<name>/skin.json`:**
```json
{
  "id": "plane-<name>",
  "label": "<Display name>",
  "states": { "default": "plane.png" }
}
```

**`arrival/<name>/skin.json`:**
```json
{
  "id": "arrival-<name>",
  "label": "<Display name>",
  "states": { "default": "arrival.png" }
}
```

**`background/<name>/skin.json`:**
```json
{
  "id": "background-<name>",
  "label": "<Display name>",
  "states": { "default": "background.png" }
}
```

---

## Pre-delivery checklist

- [ ] All 11 PNGs are drawn and placed at the correct paths
- [ ] All 6 `skin.json` files created with correct `id` and `label`
- [ ] Hangar panel centers are empty — no icons, price tags, or planes
- [ ] Plane nose points upward, centered in 256 × 256
- [ ] Details are legible at ~22 px (verify by scaling down)
- [ ] Archive unpacks into `assets/skins/` and works immediately
