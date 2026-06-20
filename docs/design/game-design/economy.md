# PlaneFlow — Level Economy (derived, not hand-tuned)

> The model for **every** map's money. The live code is `levelEconomy()` in `src/game/04-config-levels.ts`
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

`levelEconomy(lv)` returns `{ startMoney, svcReward, flow, kitCost, openable, difficulty,
generosity, skillMult, effects }`. It ties four things together — the **kit** to buy (A),
the level's **difficulty** → generosity (B), the realistic **skill multiplier** from the
effects that are on (C), then solves for the per-service pay:

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

### (B) Difficulty — the level's pressure score → generosity

Genre note: time-management games (Diner Dash et al.) tune challenge from a **weighted
composite** of arrival density, request variety, special/hard customers and patience/time
limits — and treat *chaining* bonuses as skill upside layered on a base that must stand on
its own. We mirror that. `levelDifficulty(lv)` is a pure function of the config, in
`~[0, ECON_DIFF_CAP]`:

```
eventScore = Σ EVENT_DIFF[k]  for active specials   // vip .5, rush 1, medical 1, emer/fog/wind .8
dens       = levelPace(lv)                          // INTENSITY (0..1): arrival rate + concurrency
timeScore  = race ? 1 : (time ? 0.5 : 0)            // clock pressure
envScore   = (weather?1:0) + (deice?1:0)            // hostile environment
difficulty = (W_EVENT·eventScore + W_TIME·timeScore + W_DENS·dens + W_ENV·envScore) / DIFF_NORM
difficulty = difficulty / calm                       // a "calm" world (bonus maps) is easier
```

> **`dens` is now the level's `pace`, not its volume.** Difficulty is keyed to *intensity*
> (how little the player rests between actions), not the total plane count — see
> [`difficulty_curve.md`](difficulty_curve.md). `ECON_FLOW_REF` is no longer used by the
> difficulty score (kept as a range-checked knob); `levelFlow()` below still drives payout.

Harder maps are paid **more generously**, because chaos eats income (penalties, broken
streaks, crashes that deduct cash):

```
generosity = ECON_GEN_BASE + ECON_GEN_DIFF × difficulty      // ECON_GEN_BASE ≥ 1
```

`ECON_GEN_BASE ≥ 1` is the **3★ guarantee**: even an easy tutorial map funds the full
expected kit, so money never blocks the third star.

### (C) Skill multiplier — only from the effects that are *on*

`levelEffects(lv)` reads per-level flags `combo` / `express` (both **default on**; a level
opts out with `combo:false` / `express:false`). The model only counts the bonus income a
mechanic can realistically add **when it's enabled**:

```
comboReach  = min(flow, COMBO_MAX) / COMBO_MAX                    // short maps can't build a streak
comboHead   = combo?   (COMBO_STEP·COMBO_MAX)·comboReach·(1−ECON_CHAOS·difficulty)·ECON_COMBO_REAL : 0
expressHead = express? (EXPRESS_BONUS−1)·ECON_EXPRESS_SHARE·(1−ECON_CHAOS·difficulty)             : 0
skillMult   = 1 + comboHead + expressHead
```

So combo/express are worth **less on chaotic maps** (streaks break) and on **short maps**
(no time to build), and **nothing when switched off** — which is how they're introduced
gradually. The same flags gate the live payout in `depart()`, so turning a flag off on an
early level *automatically* raises that level's base pay (see below).

### Tie it together and solve for `svcReward`

A competent player's **realized** income should cover the kit (with the difficulty cushion):

```
startMoney + svcReward·avgNSvc·flow·skillMult  =  kitCost · generosity
  ⇒  svcReward = clamp( round( (kitCost·generosity − startMoney) / (avgNSvc·flow·skillMult) ),
                        SVC_MIN, SVC_MAX )

avgNSvc = 1 + TWO_SVC_CHANCE          // a plane carries 1 or 2 tasks (avg ≈ 1.45)
flow    = served (untimed) → target  // shift ends exactly at `target`
        = race / upgrades  → round(time / ECON_FLOW_SECS)   // timed: ~1 paid plane / N s
```

A player who actually chains combos/express lands near `kitCost·generosity`; a sloppy
player banks less (raw `baseEarn = svcReward·avgNSvc·flow`) — *hard but fair*. Because both
`flow` and `skillMult` sit in the denominator, **busier maps and effect-rich maps pay a
little less per plane**, keeping the economy level across the campaign. The `clamp` stops
tiny maps getting rich (`SVC_MAX`) and starving long ones (`SVC_MIN`).

---

## Current knobs (`K` object)

| Knob | Value | Meaning |
| --- | --- | --- |
| `SVC_MIN` / `SVC_MAX` | 10 / 32 | clamp on pay per service (VIP/urgent/medical add ×bonus) |
| `ECON_OPEN_FRAC` / `ECON_UP_FRAC` | 0.7 / 0.6 | kit: share of bays opened / upgraded |
| `ECON_GEN_BASE` / `ECON_GEN_DIFF` | 1.0 / 0.35 | generosity floor (≥1 ⇒ 3★ never money-blocked) + difficulty bonus |
| `ECON_COMBO_REAL` / `ECON_EXPRESS_SHARE` | 0.5 / 0.35 | realistic combo reach / express share |
| `ECON_CHAOS` | 0.5 | how much difficulty cuts combo/express |
| `ECON_W_EVENT/TIME/DENS/ENV` | .25/.5/.5/.3 | difficulty weights |
| `ECON_DIFF_NORM` / `ECON_FLOW_REF` / `ECON_DIFF_CAP` | 2 / 32 / 1.2 | difficulty normalisation, flow reference, cap |
| `ECON_KIT_FLOOR` | 0.8 | min share of the kit a competent player must afford |
| `ECON_FLOW_SECS` | 6 | timed maps: estimate one paid plane every N seconds |
| `TWO_SVC_CHANCE` | 0.45 | chance a plane has 2 tasks (shared by spawn **and** the model) |

Prices (`START_MONEY` 0, `BAY_OPEN_COST` 100, `BAY_UP_COST` 80/160/320) are the **shop** —
the same everywhere so the player learns them once. Only the **earn-side** is derived.

### Derived economy across the campaign (sanity check)

All maps currently run with combo + express **on**. `realized` = a clean player's income
(must clear `ECON_KIT_FLOOR × kit`).

| L | diff | generosity | skillMult | svcReward | baseEarn+start | realized | kit |
| - | ---- | ---------- | --------- | --------- | -------------- | -------- | --- |
| 1 | 0.00 | 1.00 | 1.57 | 19 | 320 | 447 | 440 |
| 2 | 0.03 | 1.01 | 1.66 | 22 | 483 | 737 | 736 |
| 3 | 0.06 | 1.02 | 1.66 | 19 | 486 | 739 | 736 |
| 4 | 0.09 | 1.03 | 1.65 | 15 | 492 | 745 | 736 |
| 5 | 0.17 | 1.06 | 1.62 | 16 | 518 | 775 | 736 |
| 6 | 0.24 | 1.08 | 1.60 | 17 | 544 | 808 | 736 |
| 7 | 0.32 | 1.11 | 1.57 | 15 | 569 | 839 | 736 |
| 8 | 0.37 | 1.13 | 1.55 | 14 | 587 | 855 | 736 |
| 9 | 0.40 | 1.14 | 1.54 | 14 | 587 | 850 | 736 |
| 10 | 0.66 | 1.23 | 1.45 | 13 | 645 | 901 | 736 |

Difficulty now rises with **`pace`** (intensity) plus event stacks; L10 (max pace + all
specials) carries the most → highest generosity. When
combo/express are later disabled on the early maps, their `skillMult` drops to 1 and the
solver raises `svcReward` to keep the kit affordable on raw pay alone — e.g. L1 jumps 19→26.

---

## Invariants (locked by tests)

`validateLevels()` runs `levelEconomy()` for every map and fails the build if any of:

1. `svcReward` falls outside `[SVC_MIN, SVC_MAX]`;
2. `baseEarn = svcReward · avgNSvc · flow  <  BAY_OPEN_COST` — a shift wouldn't bank enough
   for even **one** new bay on raw pay (the original bug, encoded as a guard);
3. `realized = startMoney + baseEarn · skillMult  <  ECON_KIT_FLOOR · kitCost` — a competent
   player couldn't afford the bulk of the expected build-out (so money would gate 3★).

`validateConfig()` range-checks the `ECON_*` / `SVC_*` knobs (incl. `ECON_GEN_BASE ≥ 1`).
See `tests/logic.test.mjs` (section "Экономика уровня").

---

## Designing a new map's economy

You usually **don't** — it's derived. Just set the level's `stars`/`time`/`sides` per
[`level-pattern.md`](level-pattern.md) and the economy follows. To tighten or loosen a
single map, prefer the existing levers (`startMoney`, fewer open `slots`) over touching the
global knobs. If you turn a global knob, run `npm test` — the invariants above will tell
you immediately if any map became unwinnable on money.
