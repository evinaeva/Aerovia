# PlaneFlow — Object Library

> Catalogue of every drawable game object and its visual intent. Mirrors the style-guide
> reference panels. Parent: [`art_direction_v1.md`](art_direction_v1.md). Production
> status of assets is tracked separately in [`../assets.md`](../../assets.md).

General rule for all objects: **clean silhouette, slightly oversized for readability,
soft shading, recognizable in < 0.5 s.**

---

## Aircraft types

Reference: style-guide panel 03. Aircraft are gameplay objects first — oversized
silhouettes, clear nose direction.

| Type | Read / silhouette cue | Gameplay note |
| --- | --- | --- |
| Passenger | standard airliner, neutral white body | the workhorse / default flow |
| Cargo | bulkier fuselage, distinct livery | heavier / slower handling |
| Medical | white body + red cross accent | priority, patient transfer event |
| VIP Jet | sleek, golden/light accent | VIP priority routing (purple route) |
| Military | gray, angular silhouette | special handling |
| Private Jet | small, sleek business jet | small + fast |
| Emergency aircraft | strong alert accent | top-priority interrupt |

Each aircraft needs readable states: selected, patience running low, in-service, in-conflict.

---

## Service vehicles

Reference: style-guide panel 04. Cute, visually distinct, tiny moving life on the apron.

| Vehicle | Role |
| --- | --- |
| Pushback | moves aircraft off the gate |
| Fuel Truck | refueling |
| Baggage Cart | baggage handling |
| Catering Truck | catering |
| De-icing Truck | sprays aircraft (blue route context) |
| Snowplow | clears snow from runway/taxiway |
| Maintenance | repairs damage |
| Ambulance | medical flight support |
| Fire Truck | emergencies |
| Limo | VIP arrival (red carpet) |
| Security Car | security / escort |

Vehicles should be cute, color-coded to their function, and clearly smaller than aircraft.

---

## Buildings & structures

Reference: style-guide panel 05. Semi-simplified, slightly exaggerated, readable at a glance.

| Structure | Notes |
| --- | --- |
| Terminal | central hub, warm window light at night |
| Control Tower | tall landmark silhouette |
| Hangar | wide rounded roof, aircraft shelter |
| Fuel Station | service node |
| De-icing Pad | cold/blue context zone |

Other ground objects to support (from `art_direction_v1.md`): runway, taxiway, gates,
service roads, repair area.

---

## Routes & paths

Reference: style-guide panel 02. The visual centerpiece — see full color spec in
[`color_palette.md`](color_palette.md).

- Thick, glowing, high-contrast lines that always stay visible.
- Color encodes meaning: green valid · amber taxiing · red conflict · blue de-icing ·
  purple VIP · dashed gray hold.
- Secondary channel (dash pattern, directional arrow, cross icon) backs up color so the
  state reads even without color.

---

## Environment variations

Reference: style-guide panel 06. Same airport, different mood/time/weather skins —
readable first, atmospheric second.

- Summer Night
- Rainy Night (reflective surfaces)
- Snowy Night (snow accumulation)
- Foggy Morning (reduced visibility mood)

Time-of-day spectrum (panel 12): Day · Sunset · Evening · Night, with warm lamp glow
growing as it gets darker.

---

## Event objects

Reference: style-guide panel 07. See gameplay detail in
[`../game-design/events.md`](../game-design/events.md).

| Event | Visual object | Player response |
| --- | --- | --- |
| Tree Fell | log blocking runway | clear the block |
| Beavers | beavers chewing trees | deal with critters |
| Snowfall | snow + snowplow | call snowplow |
| Medical Flight | ambulance + medical aircraft | patient transfer |
| VIP Arrival | limo + red carpet | priority routing |
| Strong Wind | windsock straining | accept delays |

---

## UI icons

See [`ui_rules.md`](ui_rules.md) → "Icon style". Core set: plane, list, staff, gear,
cart, star, calendar.
