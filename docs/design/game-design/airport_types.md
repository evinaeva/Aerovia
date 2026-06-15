# PlaneFlow — Aircraft & Airport Types

> Game-design reference. Player-facing rules: [`../FAQ.md`](../../FAQ.md). Visual treatment:
> [`../art-direction/object_library.md`](../art-direction/object_library.md).
>
> Title note: "types" here covers both the **aircraft varieties** the player handles and
> the **airport facilities** (boxes / structures) they route through.

---

## Aircraft varieties

Each variety changes the moment-to-moment decision: who to land first, who pays more.

| Variety | Look | Patience | Payout | Cycle |
| --- | --- | --- | --- | --- |
| **Normal** | white body | standard | base (×1) | full task list |
| **VIP** | golden | impatient (½ of normal) | ×2 | full task list, priority feel |
| **Low fuel / emergency** | red pulse | very low in air — **land first** | ×1.5 | full task list |
| **Medical** | white + red cross, pink pulse | impatient, priority | bonus | **fast cycle** — lands, drops patient at the boarding box, departs |

Style-guide aircraft set (panel 03) also illustrates **Cargo**, **Military**, and
**Private Jet** silhouettes for visual variety and future expansion — see
[`../art-direction/object_library.md`](../art-direction/object_library.md#aircraft-types).

### Aircraft states to render

selected · patience-low (pulse) · in-service · in-conflict. All must read while moving
(see [`../art-direction/visual_pillars.md`](../art-direction/visual_pillars.md)).

---

## Airport facilities (boxes & structures)

Aircraft are routed through **service boxes**, each color-coded to a task:

| Box | Task | Color |
| --- | --- | --- |
| Repair | ⚙️ repair | orange |
| Fuel | 💧 fuel | teal |
| Boarding | 🧍 people / patient | rose |
| Runway | ✈️ land / take off | — |

Box mechanics:

- **Locked** (padlock) → opens for money if affordable.
- **Open** → upgradeable (faster service, **+25% per level**).
- **Busy** → can't accept another aircraft; park and wait.
- Cost shows **yellow** if affordable, **gray** if not.

Supporting structures (visual + facility): Terminal, Control Tower, Hangar, Fuel Station,
De-icing Pad — catalogued in
[`../art-direction/object_library.md`](../art-direction/object_library.md#buildings--structures).

---

## Capacity dimensions

The HUD tracks airport scale (style-guide panel 08): **Planes**, **Gates**, **Runways**
(e.g. 24/30, 8/10, 5/8). These caps grow with [progression](progression.md) and feed the
build/upgrade economy.

---

## Design intent

The mix of varieties + facility constraints is what creates the puzzle: limited boxes,
varying patience, and payout incentives push the player to sequence routes cleverly while
staying in calm flow. Adding a new variety should change *sequencing decisions*, not just
add a cosmetic variant.
