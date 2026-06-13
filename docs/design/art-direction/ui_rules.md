# PlaneFlow — UI Rules

> How the interface looks and behaves. Parent: [`art_direction_v1.md`](art_direction_v1.md).
> Style of UI **objects/icons** is also catalogued in [`object_library.md`](object_library.md).

---

## Principles

Minimal but warm. The UI should feel calm and friendly, never busy or clinical.

- rounded corners
- soft shadows
- subtle glow
- high readability
- icon-first, minimal text
- large touch areas (mobile, landscape, thumb-reachable)

**No tiny mobile UI.** If a target is too small for a thumb, it's wrong.

---

## Layout overview (top HUD)

Reference: style-guide panel 08 ("UI Overview").

Top bar, left → right:

- **Lives** — heart icons (e.g. ♥♥♥)
- **Timer** — `02:45`
- **Money** — coin icon + amount (e.g. `12 450`)
- **Stars / goals** — star icon + `3 / 8`
- **Pause** — button, top-right or top-left

Primary action bar (icon-first buttons): **Build · Vehicles · Staff · Events · Shop · Settings**.

Progress strip: **Level 12**, XP bar `850 / 1200`, plus capacity counters —
`24/30 Planes`, `8/10 Gates`, `5/8 Runways`.

---

## Panels

Reference: style-guide panel 09 ("UI Panels Examples"). Panels are rounded cards with
soft shadow and a clear title.

### Event popup
- Bold event title + icon (e.g. **SNOWFALL** ❄)
- One-line effect description (e.g. "Runway efficiency −30%")
- Suggested action (e.g. "Call snowplow")
- Cost/CTA chip (e.g. `2 500`)

### Route info
- Aircraft id + destination (e.g. `A320 → Gate A3`)
- Distance (e.g. `420 m`)
- Estimated time (e.g. `01:12`)
- Big confirm button: **GO**

### Aircraft info
- Aircraft type (e.g. `B738`)
- Passengers `156 / 189`
- Fuel `74%`
- Condition `92%`
- Use horizontal bars with accent colors, label on the left.

### Build menu
- Grid of buildable items with icon + name + cost chip
  (e.g. Gate `3 000`, Fuel Station `4 000`, De-icing Pad `6 000`).

---

## Buttons & chips

- Rounded rectangles or squircles; generous padding.
- Icon centered; optional short label below.
- Money/cost shown as a coin chip with amber accent.
- Primary CTA (GO, confirm) uses `accent/green`; cancel/blocked uses `accent/red`.
- Pressed state = subtle scale-down + soft glow; never harsh flashes.

---

## Icon style

Reference: style-guide panel 11 ("Icon Style"). Icons are simple, rounded, single-weight
silhouettes on rounded square backgrounds.

Core set: plane, list/menu, staff/people, gear (settings), cart (shop), star (goals),
calendar (events/schedule).

Rules:

- One consistent stroke/fill weight across the whole set.
- Readable at small sizes; no fine internal detail.
- Match the warm palette; icons sit on `base/purple-700`-style chips.

---

## Motion & feedback

- Transitions are smooth and soft (ease in/out), short, and non-chaotic.
- Satisfying micro-feedback on success (gentle pop, +money float, soft glow).
- Errors are clear but calm — no aggressive flashing, no screen shake spam.
- Toasts for life lost / level passed / +money (see [`../assets.md`](../../assets.md)).

---

## Do / Don't (UI)

✅ Do: large touch targets · icon-first · rounded warm cards · clear hierarchy ·
one CTA per panel.

❌ Don't: dense text · tiny tap targets · sharp clinical edges · stacked modal clutter ·
saturated full-screen color washes. (More in [`dos_and_donts.md`](dos_and_donts.md).)
