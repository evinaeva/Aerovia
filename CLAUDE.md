# Project notes for Claude

## Visual look — single `neon` skin

The game has **one look, `neon`** (dark night-radar with glow). There is no skin
selection anymore — the old multi-skin system (`cozy`/`neon`/`cartoon`, the
`SKIN_DEFS` registry and the "logic is the parent over skins" rule) has been removed.

In code (`index.html`): the neon palette (`NEON_TOKENS`) is applied on top of the
base `PALETTE`; the field is drawn by `drawNeonField`; sprites come from
`assets/sprites/neon/` with the base `assets/sprites/planeflow-*.svg` as fallback,
and `ATLAS` is just a flag for "sprite atlas loaded yet?". Keep gameplay logic,
mechanics and geometry independent of the look (as before) — there's simply nothing
to fork against now.

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
