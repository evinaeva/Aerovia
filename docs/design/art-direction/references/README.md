# Art-Direction References

Visual references that ground PlaneFlow's [art direction](../art_direction_v1.md).

---

## `planeflow_style_guide_v1.png` — master style guide

The single-image style guide approved 2026-06-12. Expected filename in this folder:

```
references/planeflow_style_guide_v1.png
```

> ⚠️ **Image binary pending.** This reference was supplied as a chat attachment and the
> binary could not be written from that session. Drop the original PNG into this folder
> under the name above (or update the link here if you use a different name). The
> detailed description below is faithful enough to brief from in the meantime.

### What the style guide contains (panel by panel)

| # | Panel | Contents |
| --- | --- | --- |
| — | Header | "PLANEFLOW — Stylized Flat Airport Management Game · Art Style Guide" + a sample airport scene at night with routed aircraft, glowing taxiways, warm windows. |
| 02 | Route Colors | The reference image proposes per-state route colors + a drawing lifecycle. **Not implemented in the game** — all routes draw as one cyan glow line; see [`../color_palette.md`](../color_palette.md). |
| 03 | Aircraft Types | Passenger, Cargo, Medical, VIP Jet, Military, Private Jet. |
| 04 | Service Vehicles | Pushback, Fuel Truck, Baggage Cart, Catering Truck, De-icing Truck, Snowplow, Maintenance, Ambulance, Fire Truck, Limo, Security Car. |
| 05 | Buildings & Structures | Terminal, Control Tower, Hangar, Fuel Station, De-icing Pad. |
| 06 | Environment Variations | Summer Night, Rainy Night, Snowy Night, Foggy Morning. |
| 07 | Events Examples | Tree Fell (block on runway), Beavers (chewing trees), Snowfall (call snowplow), Medical Flight (patient transfer), VIP Arrival (red carpet), Strong Wind (delays planes). |
| 08 | UI Overview | Lives, timer 02:45, money 12 450, stars 3/8, pause; Build/Vehicles/Staff/Events/Shop/Settings; Level 12, 850/1200; 24/30 Planes, 8/10 Gates, 5/8 Runways. |
| 09 | UI Panels | Event popup (Snowfall, −30%, 2 500), Route info (A320 → Gate A3, 420 m, 01:12, GO), Aircraft info (B738, 156/189 pax, fuel 74%, condition 92%), Build menu (Gate 3 000, Fuel Station 4 000, De-icing Pad 6 000). |
| 10 | Color Palette | Base, Accent, Neutral, and Light swatches — see [`../color_palette.md`](../color_palette.md). |
| 11 | Icon Style | plane, list, staff, gear, cart, star, calendar. |
| 12 | Lighting & Time of Day | Day · Sunset · Evening · Night strip. |
| 13 | Visual Notes | Highly readable · Clear silhouettes · Warm and inviting · Soft shadows · Satisfying animations · Simple shapes · Calm, not stressful · Cute and alive world · Small stories everywhere · Gameplay clarity first. |

### How to use it

- **Mood, palette, silhouettes, object inventory:** authoritative.
- **Camera angle:** NOT authoritative. The guide uses a light isometric tilt for
  presentation; the shipping game is **top-down** (see
  [`../art_direction_v1.md`](../art_direction_v1.md#camera)).

---

## Adding more references

Drop additional reference images here and add a short row above describing each one
(source, what it informs, any caveats). Keep this folder for *inputs/inspiration*;
shipped assets and their production status live in [`../../assets.md`](../../../assets.md).
