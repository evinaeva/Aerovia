# Project notes for Claude

## Architecture rule — logic is the parent, skins only supply look & sound

**Anything that is NOT visual appearance or audio content lives ABOVE skins and is
identical for every skin, biome and map.** Shared logic, mechanics, calculations,
trajectory, bay-entry, patience, money, stars, events, sounds (i.e. *when* a sound
plays) — all of it is skin-agnostic and must never be forked per skin. A skin (and,
by extension, a biome/map) changes **only its content**: palette/colors, draw scale,
which art atlas backs it, optional bespoke scene/HUD renderers, icons, animation
content, and the sound *content* (what a given event sounds like).

The difference between skins is **only** the content of animation, the content of
sound, and the content of icons/colors — never the rules.

Why: so you never have to re-edit trajectory or bay-entry logic on every map and every
skin, and so future skins/biomes/maps inherit the same behavior for free.

How it's enforced in code (`index.html`):
- **`SKIN_DEFS`** is the single registry where each skin *declares* its content
  (`tokens`, `scale`, `atlas`, `glow`, `field`/`hud` renderers, `sounds`, `label`).
  Adding a skin/biome/map = add an entry there (+ a line in `SKINS` + an i18n label
  key). **Never** add `if (SKIN === '…')` branches in logic/mechanics/calculations.
- Derived knobs read the registry, not the skin name: `SZ` → `skinDef().scale`,
  `NEON` → `skinDef().glow`, sprite mode → `skinDef().atlas`, scene/HUD dispatch →
  `skinDef().field/.hud`, sound content → `skinDef().sounds`.
- `validateSkins()` (in `validateGame()`) fails the config check if a skin is added
  outside the registry — tests catch violations.

When making **any** change, ask: "is this appearance/sound *content*, or is it
logic?" If it's logic, put it above skins (shared) so all skins/biomes/maps get it.

## Tracking development time

If the user asks how many hours went into the project (e.g. "посчитай мои часы",
"how long have I spent", "сколько времени на разработку"), run the committed script
**`tools/devtime-git.ps1`** and report its output — don't reinvent the calculation.

```powershell
pwsh tools/devtime-git.ps1                       # all-time, per-day + total
pwsh tools/devtime-git.ps1 -Author 'exzhe'       # only the user's commits
pwsh tools/devtime-git.ps1 -GapMinutes 90 -LeadInMinutes 15   # tune the heuristic
```

It estimates time purely from **git history** (the single source of truth, since
commits from all of the user's machines — home PC, work PC, laptop — land in this
one repo). Heuristic agreed with the user: commits less than **60 min** apart belong
to the same work session; each session adds a **10 min** lead-in for work done before
its first commit. This is the preferred method — it needs no per-machine log syncing.

## Workflow preferences

- **Work in your own feature branch — never commit straight to `main`.** Branch off the
  latest `origin/main`, do the work there, push the branch and open a PR.
- **Do NOT merge into `main` yourself — leave the PR ready and let the owner merge it.**
  The owner often runs **several Claude conversations in parallel** against this repo, and
  auto-merging to `main` disrupts the other conversations' in-flight work. Don't merge even
  when it's mergeable and CI is green, and don't wait around for a "мержи" / "merge" reply —
  just leave the branch/PR ready and move on.
- Before starting and before pushing: `git fetch`; base your branch on `origin/main`; never
  `--force`, and never rewrite someone else's commits.
