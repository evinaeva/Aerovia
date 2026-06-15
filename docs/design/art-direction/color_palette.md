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

## 2. Accent colors (route + alert + special aircraft)

High-contrast, used sparingly, never for large fills.

| Token | Meaning | Approx. hex |
| --- | --- | --- |
| `accent/green` | Valid route / confirmed / OK | `#5dca7a` |
| `accent/amber` | Taxiing / active / money | `#f2a93b` |
| `accent/red` | Conflict / blocked / danger | `#e0584f` |
| `accent/blue` | De-icing route / cold | `#4ab4d6` |
| `accent/purple` | VIP / priority | `#9a6fd4` |

---

## 3. Neutrals

| Token | Approx. hex | Use |
| --- | --- | --- |
| `neutral/gray-500` | `#8a8c99` | Airport gray, inactive UI, hold/waiting routes |
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

## Route color system (canonical)

This table is authoritative for routing visuals and must match
[`art_direction_v1.md`](art_direction_v1.md) and [`object_library.md`](object_library.md).

| State | Color token | Line treatment |
| --- | --- | --- |
| Valid route | `accent/green` | solid, glowing |
| Taxiing | `accent/amber` | solid, animated flow |
| Conflict / Blocked | `accent/red` | solid + warning |
| De-icing | `accent/blue` | solid |
| VIP / Priority | `accent/purple` | solid, emphasized |
| Hold / Waiting | `neutral/gray-500` | dashed |

### Route *states* (drawing lifecycle)

| State | Visual |
| --- | --- |
| Drawing | dashed line with leading dot |
| Confirmed | solid green |
| Active (moving) | amber with directional arrow |
| Conflict | red with directional arrow + cross icon |
| Holding | dashed gray |

---

## Usage rules

- **Backgrounds = base + neutrals.** Accents are for routes, alerts, and special objects only.
- **Never** put two saturated accents adjacent at full strength — it kills readability.
- Keep total on-screen dominant colors to **6–7**.
- Glows are additive and subtle; they hint warmth, they don't shout.
- Maintain enough contrast that every route color is distinguishable for color-blind
  players — rely on line treatment (dash/arrow/icon) as a secondary channel, not color alone.
