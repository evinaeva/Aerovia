# Skins

Visual skins for PlaneFlow. The game ships a runtime **skin switch**
(`SKIN = 'cozy' | 'neon'`, in `index.html`; selectable in **Settings → Skin**,
or via `?skin=<name>` / `localStorage.pf_skin`). Each skin only changes how the
game *looks* — never the gameplay layout (top-down, planes/runways right, bays on
bottom/left/top, finger-drawn routes, slim top HUD, no tiny UI).

| Skin | Status | Where |
| --- | --- | --- |
| **cozy** | shipped (default) | cozy sprite atlas — `assets/sprites/` |
| **neon** | shipped (procedural) | `index.html` (`NEON` branches + `NEON_TOKENS`) |
| **cartoon** | **art brief — not yet drawn** | [`cartoon/BRIEF.md`](cartoon/BRIEF.md) |

## cartoon/

A complete **design brief** for the cartoon skin: style description, reference
images (`cartoon/references/`), engine integration, mini-animation plans, and the
full **asset checklist** of everything to draw. Hand this folder to the design
agent — it's self-contained.
