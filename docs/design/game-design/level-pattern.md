# PlaneFlow — Level Pattern (intensity-based ramp)

> The template for **every** campaign map. Level data lives in the `LEVELS` array in
> `src/game/04-config-levels.ts`; this file explains the **schema**. The *shape* of the difficulty curve and
> the design rationale live in [`difficulty_curve.md`](difficulty_curve.md). See also
> [`progression.md`](progression.md) (stars) and [`../../FAQ.md`](../../FAQ.md) (player rules).

The goal card shows: **level number + name → a one-line challenge → a tutorial hint →
objectives and the star ladder as icons** (⏱ time · ✈ planes · 🔧 upgrades). The window is
built by `goalRowsHTML()` and reads from config + the `level.t/d/h.<n>` strings.

---

## Objective schema

```js
{ pace : 0.34,                        // REQUIRED 0..1 — intensity (arrival rate + concurrency).
                                      //   The MAIN difficulty axis. Must NOT decrease across the
                                      //   campaign. See difficulty_curve.md.
  objective: {
    metric : 'served' | 'upgrades',   // what we count (planes accepted / upgrades made)
    stars  : [s1, s2, s3],            // graduated thresholds for 1★/2★/3★, ascending.
                                      //   s1 = pass bar (unlocks next), s3 = ceiling = target.
    time   : 300,                     // optional: time limit in seconds (countdown at top)
    race   : true,                    // optional: "serve as many as you can" — planes show ∞,
                                      //   shift ends ONLY on time. Needs time. (Supported; not
                                      //   used in the current campaign.)
    upg    : [u1, u2, u3],            // optional (metric:'served'): extra UPGRADE gate per star.
  },
  sides   : { top:{type,slots,open}, left:{…}, bottom:{…} },  // service bays per side
  runways : 3,
  startMoney : 90,                    // optional, default K.START_MONEY (0) — a tightening lever
  events  : { vip, emergency, rush, medical, … },  // special flights — only from L5 (see below)
  combo   : false,                    // optional, default true — disable the combo money bonus
  express : false,                    // optional, default true — disable the express money bonus
}
```

Naming is data-driven: `level.t.<n>` (name), `level.d.<n>` (challenge), `level.h.<n>` (hint).
`validateLevels()` enforces every rule below and the test suite locks it in.

---

## Difficulty rises through INTENSITY (`pace`), not volume

The challenge axis is **how little the player rests between actions**, not how long the shift
runs. The `pace` field (0..1) drives:

- **arrival rate** — base spawn interval from `K.PACE_IVL_SLOW` (~4.6 s at pace 0) to
  `K.PACE_IVL_FAST` (~2.4 s at pace 1), plus a mild within-shift speed-up;
- **concurrency** — planes allowed in the air at once, from `K.PACE_CAP_LOW` (4) to
  `K.PACE_CAP_HIGH` (10).

`pace` must be **non-decreasing** across the campaign (validator). Plane counts (`stars`) grow
only gently — they set shift length and the 3★ ceiling, not the core pressure.

**Air patience is fixed at `K.AIR_BASE` = 30 s for every level** (specials shorten it by a
fixed multiplier). It is NOT a per-level knob — see
[`difficulty_curve.md`](difficulty_curve.md#воздушное-терпение--фиксированное-не-растёт-со-сложностью).

---

## Clusters: introduce → consolidate (not one new idea every level)

New mechanics arrive in **clusters**: introduce one or two (one per level), then a
**consolidation level** that uses them all together — no new toy, just tighter. This keeps the
mechanic set memorable. Specials debut **only from L5** (`CALM_LEVELS = 4`).

| L | Name | pace | new idea / role | metric | stars | events |
| - | --- | --- | --- | --- | --- | --- |
| 1 | Airport Control | 0.00 | land · service · take off | served | 6 / 7 / 8 | — |
| 2 | Open a Bay | 0.12 | open a bay (economy) | served | 8 / 10 / 12 | — |
| 3 | Upgrades | 0.22 | upgrade (🔧 `upg` gate) | served | 10 / 12 / 14 | — |
| 4 | Full House | 0.34 | **consolidation** of the block | served | 12 / 15 / 18 | — |
| 5 | Special Guest | 0.44 | VIP | served | 14 / 16 / 18 | `vip` |
| 6 | Mayday | 0.54 | low-fuel (land first) | served | 14 / 16 / 18 | `emergency` |
| 7 | Priority Board | 0.64 | **consolidation** vip + emergency | served | 16 / 19 / 22 | `vip emergency` |
| 8 | Rush Hour | 0.74 | rush waves | served | 18 / 21 / 24 | `vip rush` |
| 9 | Medevac | 0.86 | medical (priority) | served | 18 / 21 / 24 | `vip medical` |
| 10 | Dispatcher's Exam | 1.00 | **capstone** — all at once | served | 22 / 26 / 30 | `vip emergency rush medical` |

Notes:
- **L3** carries the only `upg` gate — it *teaches* upgrades, so ★★/★★★ need both planes **and**
  upgrades (✈ + 🔧).
- The per-service payout and start cash are **derived from the level** (`levelEconomy()`), not
  hand-tuned — see [`economy.md`](economy.md). You set `pace`/`stars`/`sides`; money follows.

---

## How to design a new map

1. **Think in clusters, not "new toy every level."** Introduce 1–2 mechanics one per level, then
   a **consolidation** level using them together. Cap a big block with a capstone that combines
   everything. Write the role as `level.d.<n>` / `level.h.<n>`.
2. **Set `pace`** — continue upward from the previous map (step ~0.08–0.12); never decrease it.
   This is your main difficulty dial.
3. **Set `stars: [s1, s2, s3]`** ascending, growing the count *gently*; keep `s1` reachable and
   the spread modest (3★ a stretch, not "mega-hard").
4. **One new event per map, only from L5.** Tighten resources point-wise (`startMoney`, fewer
   open `slots`) instead of spiking counts.
5. **Never touch air patience** — it's the fixed `K.AIR_BASE` constant.
6. Run `npm test` — `validateLevels()` checks ascending stars, `target=s3`, **`pace` present /
   in [0,1] / non-decreasing**, the **no-events-before-L5** boundary, `race` needing `time`, the
   `upg` rules, and the economy invariants.
