# PlaneFlow — Neon Gameplay · Handoff for an AI front-end developer

This package is a **hi-fi design reference** for the in-game HUD/field of PlaneFlow's
**neon** skin (glossy night air-traffic-control). It is built with React 18 + inline
JSX/Babel and renders a single fixed 1600×900 "game frame" scaled to fit the viewport.
Your job is to re-implement this as production code (engine UI / web / game canvas),
matching the visuals and the documented behaviour exactly.

## Files
- `Neon Gameplay.html` — entry point. Loads React/Babel, the two JSX modules, defines all
  CSS, the viewport-fit scaler, the top toolbar (pickers) and the bottom reference panels.
- `neon-gameplay/neon-field.jsx` — the **field art** layer: design tokens, neon line-icons,
  the bounded `Apron`, the `Runway`, the `Plane` sprite, the drawn `Route`, `UpgradeDots`,
  and `LongHangar` (the service-bay structure with 5 render styles).
- `neon-gameplay/neon-hud.jsx` — the **HUD** layer: top bar (`TopHUD`), the active-plane
  info `PlaneCard` (3 variants), `GameWindow` (assembles everything), and the two reference
  galleries `StatesGallery` (box states) and `PlaneStates` (bort states).

Open `Neon Gameplay.html` in a browser to interact. The top pickers (Hangar style, Info
variant) and the bottom tabs (Boxes / Borts / Tokens) are **reference tooling only** — they
are NOT part of the shipped game UI. Ship the **Sawtooth** hangar + **Bar** info by default
unless told otherwise.

## Design tokens (drop into the engine's SKIN_DEFS / neon)
Palette (`N` in neon-field.jsx):
- ink `#070c1c` · tarmac `#0c1430` · water `#081024` · core `#16245e`
- paper `#dff4ff` · body `#bcd6f0` · muted `#5f7bb0`
- phosphor `#3ad2ff` (accent/routes/radar) · amber `#ffb13b` · teal `#22e3c6`
- rose `#ff4f9d` · ice `#5fd2ff` · gold `#ffd23b` · purple `#b98cff`
- green `#5de08a` (primary/upgrade-bought) · life `#ff3b6b` (lives) · locked `#5f7bb0`

Skin params: glow = strong (baked bloom, see `rgba(key,a)` helper) · author scale ×3 ·
PNG sprite-atlas · neon single-weight line icons · fonts Fredoka (numerals/titles) +
Nunito (labels). Panel radius ~12–16, board = the dark navy apron. These deliberately rhyme
with the menu design-system (`--m-*`): same board, rounding, cyan glow, primary green.

## Service types (colour + shape both carry meaning — colour-blind safe)
Only **three** services: `fuel` (teal), `repair` (amber), `board`=passengers (rose).
Never recolour these arbitrarily; the icon shape is the primary signifier, colour is secondary.

## Layout (the locked field — positions are intentional)
- **Apron**: a bounded play surface (`APRON = {x:56,y:168,w:992,h:658}`). Planes are confined
  inside its neon border. Top edge sits **below** the HUD band; the right side opens onto the runways.
- **Two long hangars** line the top and bottom edges, **flush** with the apron border, each
  with **5 one-plane stalls** separated by thick walls. Top hangar opens DOWN, bottom opens UP
  (mirrored): the **open wall always faces the apron interior** and the parked plane noses
  toward its exit.
- **3 runways** on the right, **vertically symmetric** (equal top/bottom margins), bridging the
  apron edge into the **SKY**; a gap is always kept between runway start and the hangar wall.
- **Camera punch-hole** is a left-edge safe-area (background only — never place UI there).

## Service bay (stall) states — see the "Boxes" tab
A stall renders top-down. Service badge sits in the **back-wall corner** (top-left for the top
row, bottom-left for the bottom row), opaque, large. Upgrade capacity is shown as **dots in a
rounded plaque centred on the wall**: **green = bought, hollow = available** (same for every
service), **min 1 / max 4** dots. The upgrade affordance is a `↑` chip in the opposite corner.
States to implement:
1. Locked · can't afford (lock + price, dim, no "open" affordance)
2. Locked · affordable (green glow, can open)
3. Open · empty
4. Open · with plane (top-down plane inside)
5. Open · upgrade not affordable (`↑` chip muted)
6. Open · upgrade affordable (`↑` chip green/glowing)
7. Upgrade dots: none bought
8. Upgrade dots: partially bought (green dots glow)
9. **All upgrades bought → the buy `↑` icon disappears** (only green dots remain)

Lock + price are drawn on an **opaque panel** so the hangar never shows through them.

## Bort (plane) states — see the "Borts" tab
A plane shows **at most ONE icon at a time = its current need**, and that icon **slightly
overlaps** the sprite (sits on its nose), not floating away. No patience timers on the sprite.
When fully serviced, the need icon is replaced by the **takeoff** icon. While a plane is parked
inside a bay, it shows **no** need icon. Plane scale: in-hangar == on-apron (ground); airborne
planes (sky arrivals, the plane being vectored in) are **larger**.

## HUD
Top bar: lives (hearts) · credits (coin+number) · goal (+number) on the LEFT; **match
duration as a bare number** + pause on the RIGHT (pause inset off the rounded corner). No
caption text, no clock icons — icons + numbers only.
Active-plane **info bar** ("Bar" variant): docked **under the top HUD**, its left edge aligned
with the apron's left edge; shows the ordered service needs + the patience countdown (number
only). It appears on tap of a plane.

## Hangar render styles (5 options, pick one to ship — default Sawtooth)
Sawtooth (zig-zag roof) · Gantry (overhead rails, staff rooms between stalls) · Quonset (ribbed
arch) · Pier (terminal mullions + jet-bridge stubs) · Container (colour-coded service headers).
All use thick inter-stall walls and a floor stand-marking (lead-in line + stop bar) — **no
turn-around circles**.

## Motion (slow & soft)
Gentle plane bob, soft pulsing lights/beacons, animated dashed route flow, finger cursor on the
drawn route. Respect `prefers-reduced-motion` (everything must read as a static end-state).

## Re-implementation notes
- Keep the fixed 1600×900 canvas + transform:scale letterbox approach, or map the documented
  coordinates to your engine's layout system 1:1.
- Sprites here are CSS/SVG placeholders; swap for the real PNG sprite-atlas at author ×3.
- The pickers/tabs and `Spec`/`StatesGallery`/`PlaneStates` are **reference only** — do not ship.
- Everything is data-driven: bays take `{service, locked, affordable, plane, price, dotsTotal,
  dotsFilled, edge}`; wire these to real game state.
