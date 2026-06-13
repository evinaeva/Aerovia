# PlaneFlow — Level Economy (derived, not hand-tuned)

> The model for **every** map's money. The live code is `levelEconomy()` in `index.html`
> plus the `ECON_*` / `SVC_*` knobs in the `K` object; this file explains **why** the
> formula is shaped the way it is. See also [`level-pattern.md`](level-pattern.md) (the
> level schema), [`progression.md`](progression.md) (stars), and
> [`gameplay_loop.md`](gameplay_loop.md#money--economy) (the in-run loop).

---

## The problem this fixes

Money lives **inside a shift** — it resets every level (there is no carry-over). The old
balance used a flat payout (`MONEY_SVC = 10`) against fixed prices (open a bay = 100,
upgrade = 80/160/320). On most maps you couldn't bank enough to open even one new bay
**even after completing every goal**: the income from the planes you're allowed to serve
simply didn't cover the apron you needed to serve them.

The fix is to stop hand-tuning money per level and instead **derive** the per-service
payout and the starting cash **from the level's own difficulty** — so the buy-side feels
the same, and stays *tight-but-doable*, on every present and future map.

---

## The formula

`levelEconomy(lv)` returns `{ startMoney, svcReward, flow, kitCost, openable }`. It ties two
sides together:

### (A) The "kit" — what a shift should be able to *buy*

What a skilled player should afford by the time they clear the **3★ ceiling**: open most of
the buyable apron and put a tier-1 speed upgrade on the bays they run.

```
openable   = Σ (slots − open)  over the 3 sides        // bays you can buy
expectOpen = round(openable × ECON_OPEN_FRAC)          // we expect to open ~this many
working    = (bays open at start) + expectOpen          // bays actually running
kitCost    = expectOpen × BAY_OPEN_COST                 // opening them
           + working   × BAY_UP_COST[0] × ECON_UP_FRAC  // + a few tier-1 upgrades
```

### (B) The "earn" — what a shift actually *banks* (raw pay)

Base cash over the shift, **excluding** combo/express:

```
avgNSvc  = 1 + TWO_SVC_CHANCE          // a plane carries 1 or 2 service tasks (avg ≈ 1.45)
flow     = served (untimed)  → target  // the shift ends exactly at `target` planes
         = race / upgrades   → round(time / ECON_FLOW_SECS)   // timed: ~1 paid plane / N s
baseEarn = svcReward × avgNSvc × flow
```

### Tie them together and solve for `svcReward`

```
startMoney + baseEarn  ≈  ECON_TIGHTNESS × kitCost
        ⇒  svcReward = clamp( round( (ECON_TIGHTNESS·kitCost − startMoney)
                                      / (avgNSvc · flow) ),  SVC_MIN, SVC_MAX )
```

`ECON_TIGHTNESS < 1` means **raw pay alone slightly under-funds the kit** — the gap is
closed by *skill*: the combo multiplier (up to ×2 for clean streaks) and the express bonus
(×1.5 for fast cycles). That's the "hard but fair, rewarding to master" feel: complete the
goals and you can afford to grow; play *cleanly* and you can afford the whole apron with
room to spare.

The `clamp` keeps small early maps from getting rich (cap `SVC_MAX`) and long maps from
going hungry (floor `SVC_MIN`). Because `flow` is in the denominator, **busier maps pay a
little less per plane** — total economy stays level across the campaign instead of
ballooning as plane counts rise.

---

## Current knobs (`K` object)

| Knob | Value | Meaning |
| --- | --- | --- |
| `SVC_MIN` / `SVC_MAX` | 10 / 22 | clamp on pay per service (VIP/urgent/medical add ×bonus) |
| `ECON_OPEN_FRAC` | 0.7 | share of buyable bays a shift is expected to open |
| `ECON_UP_FRAC` | 0.6 | share of running bays expected to take a tier-1 upgrade |
| `ECON_TIGHTNESS` | 0.9 | raw pay funds ~90% of the kit; the rest is combo/express |
| `ECON_FLOW_SECS` | 6 | timed maps: estimate one paid plane every N seconds |
| `TWO_SVC_CHANCE` | 0.45 | chance a plane has 2 tasks (shared by spawn **and** the model) |

Prices (`START_MONEY` 100, `BAY_OPEN_COST` 100, `BAY_UP_COST` 80/160/320) are the **shop** —
the same everywhere so the player learns them once. Only the **earn-side** is derived.

### Derived pay across the campaign (sanity check)

| L | flow | svcReward | base £/plane | baseEarn + start | kitCost |
| - | ---- | --------- | ------------ | ---------------- | ------- |
| 1 | 8  | 22 | 31.9 | 355 | 440 |
| 2 | 12 | 22 | 31.9 | 483 | 736 |
| 3 | 16 | 22 | 31.9 | 610 | 736 |
| 4 | 20 | 19 | 27.6 | 651 | 736 |
| 5 | 50 | 10 | 14.5 | 825 | 736 |
| 6 | 28 | 14 | 20.3 | 668 | 736 |
| 7 | 22 | 18 | 26.1 | 674 | 736 |
| 8 | 24 | 16 | 23.2 | 657 | 736 |
| 9 | 27 | 15 | 21.8 | 677 | 736 |
| 10 | 32 | 13 | 18.8 | 683 | 736 |

(L1–L3 sit at the `SVC_MAX` cap — small tutorial maps where you barely need the apron.
L5 is the race level: many planes, lowest per-plane pay, highest volume.)

---

## Invariants (locked by tests)

`validateLevels()` runs `levelEconomy()` for every map and fails the build if either:

1. `svcReward` falls outside `[SVC_MIN, SVC_MAX]`, or
2. `baseEarn = svcReward · avgNSvc · flow  <  BAY_OPEN_COST` — i.e. a shift wouldn't bank
   enough for even **one** new bay on raw pay. This is the original bug encoded as a guard,
   so no future map can regress into "can't afford a box."

`validateConfig()` range-checks the `ECON_*` / `SVC_*` knobs. See `tests/logic.test.mjs`
(section "Экономика уровня").

---

## Designing a new map's economy

You usually **don't** — it's derived. Just set the level's `stars`/`time`/`sides` per
[`level-pattern.md`](level-pattern.md) and the economy follows. To tighten or loosen a
single map, prefer the existing levers (`startMoney`, fewer open `slots`) over touching the
global knobs. If you turn a global knob, run `npm test` — the invariants above will tell
you immediately if any map became unwinnable on money.
