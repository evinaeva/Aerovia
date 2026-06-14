# PlaneFlow — Events & Surprises

> Game-design reference. Player-facing rules: [`../FAQ.md`](../../FAQ.md). Visual treatment
> of events: [`../art-direction/object_library.md`](../art-direction/object_library.md)
> (panel 07 of the style guide) and weather notes in
> [`../art-direction/art_direction_v1.md`](../art-direction/art_direction_v1.md#weather-events).

Events exist to break the player's plan and force live re-routing — the heart of the
flow state. They should raise tension *briefly* without becoming stressful or unreadable.

---

## Implemented surprises (from FAQ)

| Event | Effect on gameplay | Status |
| --- | --- | --- |
| **Rush hour** ("час пик") | a wave of aircraft arrives at once | active |
| **Wind change** ("смена ветра") | one runway closes (marked ✕) — route to other runways | **muted on all levels** (code kept) |
| **Fog** ("туман") | taxiing slows down | **muted on all levels** (code kept) |

Rush hour is the only surprise the player currently faces. **Wind change and fog are
disabled on every campaign level** (their mechanics are kept in code and can be turned
back on); the player no longer sees runway closures or slowed taxiing.

---

## Style-guide event catalogue

The art style guide (panel 07) defines the visual + narrative event set. Some are
shipped, others are design targets for the "small stories everywhere" pillar.

| Event | Object on field | Player response | Status |
| --- | --- | --- | --- |
| **Snowfall** | snow accumulation + snowplow | call snowplow; runway efficiency −30% until cleared | weather target |
| **Strong Wind** | windsock straining | accept delays / runway closure | coded, muted on all levels |
| **Fog** | low-visibility mood | slower taxiing | coded, muted on all levels |
| **Tree Fell** | log blocking a runway | clear the block before using the runway | design target |
| **Beavers** | beavers chewing trees | deal with the critters | design target |
| **Medical Flight** | ambulance + medical aircraft | priority patient transfer (fast cycle) | aircraft type shipped |
| **VIP Arrival** | limo + red carpet | priority routing for VIP jet | aircraft type shipped |

> When adding a new event, capture: trigger, gameplay effect, player counter-action,
> visual object(s), and the service vehicle it summons (see
> [`../art-direction/object_library.md`](../art-direction/object_library.md)).

---

## Event design rules

1. **Readable first, atmospheric second.** The player must instantly see *what changed*
   and *what to do*.
2. **One clear counter-action.** Each event should map to an obvious response (call a
   plow, re-route, accept a delay).
3. **Calm, not punishing.** Tension is short; no aggressive flashing or screen shake.
   See [`../art-direction/dos_and_donts.md`](../art-direction/dos_and_donts.md).
4. **Tell a small story.** The event object adds life to the world, not just a debuff.
5. **Surface cost/CTA in the event popup** (see
   [`../art-direction/ui_rules.md`](../art-direction/ui_rules.md#event-popup)).

---

## Weather × time of day

Weather skins layer onto the time-of-day spectrum (Day · Sunset · Evening · Night) and
the environment variations (Summer Night, Rainy Night, Snowy Night, Foggy Morning).
Weather always stays readable — atmosphere never beats clarity.

---

## Survival mode — per-map difficulty & events

The biome maps are played as **Survival** (see [`progression.md`](progression.md)): endless
runs with lives, where intensity ramps up over time. This is the natural home for the
"different events on different maps" idea — each map expresses a distinct *survival difficulty*:

- **Pace / ramp** — a map's starting `level.pace` and `level.survRamp` set how fast the sky
  fills up. Harder maps start busier and/or ramp faster (to max over `SURV_RAMP_SECS`).
- **Per-biome hazards** — each biome brings its own field events: 🌲 Forest already ships
  falling trees, beavers, deer and birds (tap the hazard → the right crew rolls out).
  Arctic/tropical/desert/mountain/megacity get their own (de-icing, sandstorms, gulls, …) as they ship.
- **Specials always on** — VIP / emergency / medical aircraft are enabled on every survival
  map (`levelEvents()`), plus the rush-hour wave.

Design target: tune each map so its difficulty curve and event mix feel distinct, giving
players a reason to chase a personal best (and a leaderboard rank) on every airport.
