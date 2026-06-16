# PlaneFlow — Game Design

Design-side reference for PlaneFlow. The authoritative player-facing rules (Russian) are
in [`../FAQ.md`](../../FAQ.md); balance numbers live in `src/game/04-config-levels.ts` (see
[`../DEV.md`](../../DEV.md)). These files summarize and structure the design for context.

| File | What it covers |
| --- | --- |
| [`gameplay_loop.md`](gameplay_loop.md) | The core loop, to-do list, controls, patience, lives, economy. |
| [`events.md`](events.md) | Surprises and weather events + event design rules. |
| [`airport_types.md`](airport_types.md) | Aircraft varieties and airport facilities (boxes/structures). |
| [`progression.md`](progression.md) | Levels, stars, in-run economy, Survival mode, achievements. |
| [`difficulty_curve.md`](difficulty_curve.md) | How challenge grows — the campaign spine, the "one new idea per level" curve, knobs & guarantees. |
| [`meta_progression.md`](meta_progression.md) | What persists & unlocks between shifts — the light meta (stars, achievements, mechanic/plane-type ladder). |
| [`ftue.md`](ftue.md) | First-time experience — the silent tutorial and the first-10-minutes arc, beat by beat. |
| [`level-pattern.md`](level-pattern.md) | Level-config schema + the slow difficulty ramp — the template for new maps. |
| [`economy.md`](economy.md) | The derived money model (`levelEconomy`) — payout & start cash from level difficulty. |

Visual treatment of all of the above lives in [`../art-direction/`](../art-direction/README.md).
