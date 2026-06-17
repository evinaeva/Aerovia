# PlaneFlow — Visual Art Direction v1.0

> Top-level art bible for PlaneFlow. This is the single source of truth for the
> *visual* decisions. Detailed breakdowns live in the sibling files:
> [`visual_pillars.md`](visual_pillars.md) ·
> [`color_palette.md`](color_palette.md) ·
> [`ui_rules.md`](ui_rules.md) ·
> [`object_library.md`](object_library.md) ·
> [`dos_and_donts.md`](dos_and_donts.md) ·
> [`references/`](references/).
>
> Gameplay rules (for players) live in [`../FAQ.md`](../../FAQ.md). The project brief
> is in [`../tower_project_brief.md`](../../tower_project_brief.md).

---

## Project Overview

- **Game name:** PlaneFlow
- **Genre:** Calm, warm airport flow management game
- **Platform:** Mobile (landscape only)

**Core fantasy:**
The player enters a satisfying cognitive flow state by routing airplanes, managing
airport operations, reacting to small events, and maintaining smooth airport traffic.

The game should feel:

- mentally engaging
- visually relaxing
- warm and inviting
- highly readable
- satisfying
- low stress but high focus

This is **NOT** a realistic airport simulator.
This is **NOT** a hardcore ATC simulator.
This **IS** a stylized, emotionally pleasant, highly readable airport flow game.

---

## Art Style Decision

**Chosen style: Stylized Flat (Top-Down).**

Visual direction:

- top-down view
- stylized flat rendering
- warm atmosphere
- warm lighting
- simplified geometry
- soft shading
- visually rich but uncluttered
- highly readable gameplay

Think: **Mini Metro readability** + **warm management game atmosphere** + **mobile-first clarity**.

> **Note on the reference image.** The style-guide reference in
> [`references/`](references/) is rendered with a light isometric tilt for presentation
> appeal. The *shipping camera is top-down* (see [Camera](#camera)). Use the reference for
> mood, palette, silhouettes, and the object inventory — not for camera angle.

---

## Core Visual Pillars

Full detail in [`visual_pillars.md`](visual_pillars.md). Summary:

1. **Readability first** — gameplay clarity always wins over realism.
2. **Warm atmosphere** — the airport feels alive and emotionally pleasant.
3. **Cognitive flow** — supports a calm, "brain occupied" focus state.
4. **Stylized, not realistic** — simplified shapes, clean silhouettes, soft warmth.

---

## Camera

**Top-down only.** Not isometric. Not angled perspective.

Reason: the player draws airplane routes with a finger. Top-down maximizes route
readability, finger precision, airport awareness, and gameplay speed.

---

## World Style

Semi-simplified airports. Not realistic scale. Elements are slightly exaggerated so
the layout reads at a glance.

Core ground objects: runway, taxiway, terminal, gates, hangars, control tower, service
roads, fuel stations, de-icing area, repair area. See [`object_library.md`](object_library.md).

---

## Aircraft Style

Aircraft are **gameplay objects first**.

Requirements:

- oversized silhouettes
- readable nose direction
- soft stylization
- recognizable categories

Types: passenger, cargo, medical flight, VIP jet, military, private jet, emergency aircraft.
Visual readability > realism.

---

## Route Drawing System

This is the visual centerpiece. Requirements:

- thick route lines
- glowing outline
- high contrast
- animated movement
- the route must always remain visible

Color (as shipped): **all routes render as one cyan phosphor (`#3ad2ff`) glowing line** with a
directional arrowhead — route color does **not** encode state. Confirmed against
`src/game/09b-render-entities.ts`; see the full note in [`color_palette.md`](color_palette.md).
(An earlier per-state color table here was aspirational and never implemented.)

---

## Lighting

Soft and warm. Avoid hard realism.

- **Day:** soft warm sunlight.
- **Night:** warm airport lamps, glowing taxiways, subtle ambient lighting.
- **Weather:** readable first, atmospheric second.

Time-of-day spectrum: Day → Sunset → Evening → Night.

---

## Weather Events

Weather changes gameplay (see [`../game-design/events.md`](../game-design/events.md)):

- **Snow** — accumulation, de-icing required, snowplow activity.
- **Wind** — fallen trees, delayed routing.
- **Rain** — reflective surfaces, slightly slower taxiing.

---

## Color Palette

Muted but warm. Avoid oversaturation. Maximum **6–7 dominant colors**.

Primary: dark navy, muted purple, warm amber, soft yellow, airport gray.
Accents: route lines, event alerts, special aircraft.

Full swatches and hex values in [`color_palette.md`](color_palette.md).

---

## UI Style

Minimal but warm. Rounded corners, soft shadows, subtle glow, high readability.
Large touch areas, minimal text, icon-first. No tiny mobile UI.

Full rules in [`ui_rules.md`](ui_rules.md).

---

## Performance Rules

Mobile-first. Avoid heavy particles, expensive effects, and clutter. Must run smoothly
on mid-range phones.

---

## Do Not Do

See [`dos_and_donts.md`](dos_and_donts.md). In short, avoid:

- photorealistic airports
- realistic scale
- overly detailed environments
- tiny unreadable planes
- cluttered UI
- excessive visual effects
- dark unreadable scenes
- aggressive colors
- stressful UX

---

## Target Player Feeling

> "I'll just play for 10 minutes."
>
> *(45 minutes later)*
>
> "I'm still routing planes."
