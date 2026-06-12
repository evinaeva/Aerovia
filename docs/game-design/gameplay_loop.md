# PlaneFlow — Gameplay Loop

> Game-design reference. The authoritative player-facing rules (in Russian) are in
> [`../FAQ.md`](../FAQ.md); balance numbers live in the `K` object and `LEVELS` array in
> `index.html` (see [`../DEV.md`](../DEV.md)). This file summarizes the loop for design
> and AI context. Visual treatment of these mechanics is in
> [`../art-direction/`](../art-direction/art_direction_v1.md).

---

## Player role

You are an airport dispatcher. Aircraft arrive; you decide where they go, using a
**finger** (or mouse). Land them, route them through service boxes in the right order,
and send them back to the sky.

---

## Core loop

```
Aircraft arrives (waits in the air, right side)
        │
        ▼
Land it  ──►  draw a route from the aircraft to a RUNWAY
        │
        ▼
Service it ──► draw routes to the SERVICE BOXES its to-do list requires, in order
        │        (repair → fuel → boarding, etc.; order is strict)
        ▼
Depart it ──► once all tasks are done, route it to a runway → it takes off
        │
        ▼
Earn money  ──►  spend on opening / upgrading boxes  ──►  reach the level goal
```

Each serviced departure pays **money**. Hit the level's target → level cleared, next one unlocks.

---

## The to-do list

Every aircraft carries an ordered list of tasks shown as icons above it. Usually 1–2
tasks, always ending in **departure**:

| Icon | Task | Color |
| --- | --- | --- |
| ⚙️ | Repair | orange |
| 💧 | Fuel | teal |
| 🧍 | Boarding (people) | rose/pink |
| ✈️ | Departure (always last) | — |

Tasks run **strictly in order** — the next can't start until the current one is done.
Tap an aircraft to see its full task queue (top-left).

---

## Controls

1. **Land:** drag from the aircraft to a runway. It follows the drawn line, lands, and
   stops at the runway end.
2. **To a box:** drag from a parked aircraft to a box of the needed color. It drives in;
   service starts automatically.
3. **Next task:** when a task finishes, drag to the next box. When all are done, drag to
   a runway → takeoff → money.
4. **Wait:** if the needed box is busy, park the aircraft anywhere free and wait.

Helpful: tap a moving aircraft to **stop** it; tap again to resume along the same line.
Lines can cross safely (air and ground).

---

## Patience (don't anger the planes)

A ring around each aircraft is its **patience**.

- **In the air**, if patience runs out → it **crashes** → you **lose a life**.
- **On the ground**, patience resets (longer). If you're too slow servicing, it still
  departs but pays **half**.

---

## Lives & end of shift

Start with **3 lives**. You lose a life when:

- an aircraft isn't landed in time (air timeout), or
- two aircraft **collide** (same box, same runway, or meeting at one point on the field).

Collisions also **deduct money** (balance can go negative). Out of lives → **shift over**.
A loss log with causes is available in Pause → Settings.

---

## Money & economy

- Money is earned **on departure** of a serviced aircraft.
- **Combo:** consecutive clean departures (no penalties/crashes) raise a money multiplier
  (up to ×2). Any crash or overdue resets it.
- **Express bonus:** finishing all tasks and departing *fast* pays ×1.5.
- Spend money to **open** locked boxes (padlock) or **upgrade** open ones
  (faster service, +25% per level). Cost shows yellow if affordable, gray if not.

See [`progression.md`](progression.md) for levels, stars, and Zen mode. Aircraft
varieties and surprise events are in [`airport_types.md`](airport_types.md) and
[`events.md`](events.md).
