# PlaneFlow — Color Palette

> Canonical color system. Parent: [`art_direction_v1.md`](art_direction_v1.md).
> Rule of thumb: **muted but warm, max 6–7 dominant colors, never oversaturated.**
>
> ⚠️ **Hex values below are approximated from the style-guide reference image** (panel
> 10) and the existing working palette in [`../assets.md`](../../assets.md). Treat them as
> a starting target to be confirmed against `index.html`, not as locked tokens. When a
> value is pulled from code, mark it ✅ confirmed.

---

## 1. Base / environment colors

The dark, calm foundation of the airfield (apron, buildings, ground at night).

| Token | Approx. hex | Use |
| --- | --- | --- |
| `base/navy-900` | `#1a1d2e` | Deepest background, night apron |
| `base/navy-800` | `#242842` | Apron / tarmac base |
| `base/purple-700` | `#3a3354` | Muted purple buildings, structures |
| `base/brown-700` | `#4a3f33` | Warm structural browns, roofs |
| `base/brown-600` | `#5e5142` | Secondary structure tone |

---

## 2. Accent colors (alerts + special aircraft + UI)

High-contrast, used sparingly, never for large fills. **These accents are NOT used to color
routes** — every route is one cyan phosphor line (see "Route rendering" below).

| Token | Meaning | Approx. hex |
| --- | --- | --- |
| `accent/green` | Confirm / OK / affordable | `#5dca7a` |
| `accent/amber` | Money / repair / active state | `#f2a93b` |
| `accent/red` | Danger / blocked / emergency | `#e0584f` |
| `accent/blue` | Cold / de-icing context | `#4ab4d6` |
| `accent/purple` | VIP / priority | `#9a6fd4` |

---

## 3. Neutrals

| Token | Approx. hex | Use |
| --- | --- | --- |
| `neutral/gray-500` | `#8a8c99` | Airport gray, inactive UI |
| `neutral/gray-400` | `#a8aab5` | Disabled text, secondary lines |
| `neutral/cream-200` | `#e8e0cf` | Light surfaces, aircraft bodies |
| `neutral/cream-100` | `#f4eede` | Brightest highlight / paper |

---

## 4. Lights / glows

Warm emissive tones for night lamps, taxiway glow, and window light.

| Token | Approx. hex | Use |
| --- | --- | --- |
| `light/amber-glow` | `#ffb84d` | Window light, runway/taxiway lamps |
| `light/amber-soft` | `#ffd089` | Soft warm spill |
| `light/purple-glow` | `#b58cf0` | VIP / special emissive |
| `light/purple-soft` | `#cdb0f7` | Ambient cool glow |

---

## Route rendering (as shipped)

> ✅ Confirmed against code: `src/game/09b-render-entities.ts` (`drawPlane`, `_rc = COL.phosphor`).

**Every route renders identically:** a single cyan phosphor (`#3ad2ff`) glowing solid line
with a directional arrowhead at the head. **Route color does NOT encode state** — there is no
green/amber/red/blue/purple/gray-by-state system, and no dashed "drawing" vs. solid
"confirmed" lifecycle. A valid route, a taxiing plane, a conflict, a de-icing trip, a VIP and
a holding plane all draw the same cyan line.

State and urgency are shown on the **plane**, not the route:

- airborne **patience ring** — teal → amber → red as time runs out;
- **special-plane markers** — VIP gold body, emergency red pulsing ring, medical rose cross.

> ⚠️ Earlier versions of this doc carried a "state → color" route table and a "drawing
> lifecycle" table. Both were **aspirational and never implemented**; they were removed
> because tools/agents kept treating them as real and "implementing" route coloring the game
> does not have. If state-coded routes are ever built, document them here **with a code
> reference**.

---

## Usage rules

- **Backgrounds = base + neutrals.** Accents are for alerts and special objects only (routes use cyan phosphor, not accents).
- **Never** put two saturated accents adjacent at full strength — it kills readability.
- Keep total on-screen dominant colors to **6–7**.
- Glows are additive and subtle; they hint warmth, they don't shout.
- Maintain enough contrast that UI states and alert colors stay distinguishable for
  color-blind players — rely on shape/icon as a secondary channel, not color alone.
