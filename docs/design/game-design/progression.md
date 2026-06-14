# PlaneFlow — Progression

> Game-design reference. Player-facing rules: [`../FAQ.md`](../../FAQ.md). Level data lives
> in the `LEVELS` array in `index.html` (see [`../DEV.md`](../../DEV.md)); achievements are
> tracked in [`../achievements.md`](../../achievements.md).

---

## Levels

- The main menu has a **level select**. Locked levels show a padlock and unlock once you
  earn **at least 1 star** on the previous level.
- Each level has its own **goal**, shown in a "Shift Goals" window at the start (close
  with "Got it" or tap outside; reopen via "Goals" in Pause). The window follows a fixed
  layout (mirrors the icon-driven reference): **level number + name**, a one-line
  **challenge** plus a **tutorial hint**, then **objectives and the star ladder rendered
  as icons** (⏱ time, ✈ planes, 🔧 upgrades).
- Goal types vary:
  - accept as many aircraft as possible (`served`, no time);
  - accept the most aircraft **within a time limit** — `race`, planes shown as **∞**, a
    **countdown** runs at the top, the shift ends only on time;
  - make the most **box upgrades** within a time limit (`upgrades`).

The full ramp (slow difficulty curve) and the level-config schema live in
[`level-pattern.md`](level-pattern.md) — that's the template for new maps.

---

## Stars (0–3 per level) ⭐ — graduated thresholds

Each level defines **three thresholds** `stars: [s1, s2, s3]` on its primary metric. You
earn a star for each threshold you reach — the more you do, the more stars (as in the
reference screenshots):

| Stars | Requirement |
| --- | --- |
| ★ | reach `stars[0]` (the pass bar — unlocks the next level) |
| ★★ | reach `stars[1]` |
| ★★★ | reach `stars[2]` (the level's ceiling) |

- Some levels add a **secondary gate** `upg: [u1, u2, u3]`: to claim ★★/★★★ you must hit
  both the plane count **and** that many upgrades (e.g. L3 — shown as ✈ + 🔧).
- Menu and end-of-shift screens show your **best** stars.
- Levels are **replayable** to improve your star count.
- Progress is **saved on-device** and can be **reset** ("Reset progress").

---

## In-run progression (economy)

Within a shift, progression is driven by money (see
[`gameplay_loop.md`](gameplay_loop.md#money--economy)):

- earn on each serviced departure;
- **combo** multiplier up to ×2 for clean consecutive departures;
- **express bonus** ×1.5 for fast full-service cycles;
- spend to **open** locked boxes and **upgrade** open ones (+25% service speed per level).

The HUD tracks meta-scale counters — **Level**, XP bar, and **Planes / Gates / Runways**
capacity (style-guide panel 08).

---

## Survival mode (maps)

The **Survival** button (main menu) opens the **maps** screen (airport biomes). Each map is
an **endless run with lives** (`startBiome` sets `survival=true`): no "land N" target — you
play until your lives run out, and intensity ramps up the longer you last (a map's starting
`pace` climbs to max over `SURV_RAMP_SECS`, or a per-map `survRamp`). Instead of 3 stars each
map keeps a **personal best** (planes landed); the run score also feeds the global
leaderboard (see [`leaderboards.md`](leaderboards.md)). Maps are meant to differ by *survival
difficulty* — their own pace/ramp and, per biome, their own hazards (see [`events.md`](events.md)).

---

## Achievements

A separate medal/achievement system (46 items, from light to hardcore to secret) is
catalogued in [`../achievements.md`](../../achievements.md) and complements star-based
progression.

---

## Design intent

Stars give skill-expression and replay value without gating content harshly (1 star
unlocks the next level). Survival adds an endless, score-chasing track on the biome maps
for players who want flow and a personal best to beat.
