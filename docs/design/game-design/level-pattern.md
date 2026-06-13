# PlaneFlow — Level Pattern (slow difficulty ramp)

> The template for **every** campaign map. Level data lives in the `LEVELS` array in
> `index.html`; this file explains the **schema** and the **difficulty curve** so new maps
> stay consistent. See also [`progression.md`](progression.md) (stars) and
> [`../../FAQ.md`](../../FAQ.md) (player rules).

The shape is modelled on the icon-driven reference goal cards: **level number + name → a
one-line challenge → a tutorial hint → objectives and the star ladder as icons**
(⏱ time · ✈ planes · 🔧 upgrades). The goal window is built by `goalRowsHTML()` and reads
everything below from config + the `level.t/d/h.<n>` strings.

---

## Objective schema

```js
{ objective: {
    metric : 'served' | 'upgrades',  // what we count (planes accepted / upgrades made)
    stars  : [s1, s2, s3],           // graduated thresholds for 1★ / 2★ / 3★, ascending.
                                     //   s1 = pass bar (unlocks next level), s3 = ceiling.
                                     //   target is auto-derived = s3 (see normObjective()).
    time   : 300,                    // optional: time limit in seconds (countdown at top)
    race   : true,                   // optional: "serve as many as you can" — planes show ∞,
                                     //   no spawn cap, the shift ends ONLY on time. Needs time.
    upg    : [u1, u2, u3],           // optional (metric:'served' only): extra UPGRADE gate per
                                     //   star — ★★/★★★ need both the count AND the upgrades.
  },
  sides   : { top:{type,slots,open}, left:{…}, bottom:{…} },  // service bays per side
  runways : 3,
  startMoney : 90,                   // optional, default K.START_MONEY (100)
  events  : { vip, rush, medical, … },  // special flights / dynamics — see "Event ramp"
}
```

Naming is data-driven, not stored in config: `level.t.<n>` (name), `level.d.<n>`
(challenge line), `level.h.<n>` (tutorial hint). Missing `d`/`h` fall back to the plain
objective sentence. The config validator (`validateLevels()`) enforces all the rules below
and the test suite locks them in.

---

## The curve: one new idea per level

Difficulty rises **one concept at a time**. Each level introduces a single mechanic on top
of the previous, with the plane count creeping up. The first six levels are the
**tutorial block** — clean mechanics, **no special events** — then events ramp in.

### Tutorial block (L1–L6) — clean mechanics

| L | Name | New idea (challenge) | metric | stars | extra |
| - | --- | --- | --- | --- | --- |
| 1 | Airport Control | Land & service planes | served | 6 / 7 / 8 | — |
| 2 | Expanding | Open a second service bay | served | 8 / 10 / 12 | — |
| 3 | Upgrades | Upgrade bays (cuts service time) | served | 12 / 14 / 16 | `upg` 0 / 2 / 4 |
| 4 | Full House | Spend money to grow the apron | served | 16 / 18 / 20 | — |
| 5 | Race the Clock | Serve as many as you can vs a timer | served | 16 / 18 / 20 | `time` 300, `race` |
| 6 | First Wave | Hold a steady flow under a bigger load | served | 20 / 24 / 28 | — |

Pattern notes:
- **Counts grow gently** (~+2–4 between the 1★ bars), and the **star spread per level** is
  small (1–4) so 1★ is reachable and 3★ is a stretch.
- **L3** is the only one with the `upg` gate — it *teaches* upgrades, so higher stars
  require actually upgrading (✈ + 🔧, exactly like the reference card).
- **L5** is the only `race` level — the timer is the pressure, planes are "∞".
- Money is **left at the default** (no per-level `startMoney` in the tutorial block); the
  economy lessons (L3 upgrade, L4 open new bays) work on the standard PlaneFlow scale
  (`START_MONEY` 100, bay open/upgrade 100/80…).

### Event ramp (L7–L10) — specials on top of solid mechanics

Special flights debut **only after** the tutorial block (validator: nothing in L1–L6).

| L | Name | Debuts | metric | stars | events |
| - | --- | --- | --- | --- | --- |
| 7 | Special Guest | **VIP** | served | 18 / 20 / 22 | `vip` |
| 8 | Rush Hour | **rush** (peak waves) | served | 20 / 22 / 24 | `vip rush` |
| 9 | Tune-Up Crunch | upgrades under pressure | upgrades | 5 / 6 / 7 | `vip rush` (`time` 160) |
| 10 | Dispatcher's Exam | **medical** (capstone: all at once) | served | 24 / 28 / 32 | `vip rush medical` |

---

## How to design a new map

1. **Pick the one new idea** the map teaches (or the one knob it turns up). Write it as the
   `level.d.<n>` challenge and `level.h.<n>` hint.
2. **Set `stars: [s1, s2, s3]`** ascending. Keep `s1` reachable (the pass bar) and the
   spread modest. Continue the count from the previous map — don't jump.
3. Choose the **flavour**: plain `served`, `race` + `time` (timed sprint, planes ∞), or
   `upgrades`. Add an `upg` gate only when the map is *about* upgrading.
4. **Tighten resources** sparingly via `startMoney` / fewer open `slots` instead of raw
   count spikes.
5. Introduce at most **one new event** per map, and only past the tutorial block.
6. Run `npm test` — `validateLevels()` checks ascending stars, the `target=s3` invariant,
   `race` needing `time`, the `upg` rules, and the "no events in L1–L6" boundary.
