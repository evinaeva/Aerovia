# Neon look — asset sourcing (free-first, all PNG)

Companion to [`BRIEF.md`](BRIEF.md). Where to get each asset **cheaply** without local
GPU generation. **Everything ships as PNG** (one format — matches the engine's
`assets/sprites/neon/<id>.png` + `manifest.json` pipeline; see BRIEF §4).

## Format rule (resolves the SVG-vs-PNG question)

- PNG was chosen for the **effects** (glow / gloss / gradients) — SVG filters don't
  render through the canvas blit and are unreliable on iOS WebKit.
- Flat icons have **no filters**, so SVG would *work* too — but to keep **one format**,
  we export everything to **PNG**.
- **Color is baked at export time** (PNG can't be token-recolored at runtime). For
  icons from game-icons.net, pick the per-service neon color in the site's export
  panel (amber / teal / rose / ice / gold …) and download a **transparent PNG**.
- The engine still resolves **PNG → SVG (`neon-<id>`) → procedural**, so SVG icons
  remain a valid fallback if we ever want runtime recolor.

## Sources & licenses

| Source | Best for | License | Notes |
|---|---|---|---|
| **game-icons.net** | service/HUD/menu icons | **CC-BY 3.0** | exports PNG with chosen color + transparent bg; **needs attribution** |
| **Kenney.nl** | UI, particles/FX, top-down vehicles | **CC0** | already PNG; no attribution required |
| **OpenGameArt.org** | extras | mixed (filter **CC0**) | check per-asset license |
| **itch.io** (free + CC0 + neon tags) | neon UI bits | **per-pack** | verify each pack's license before shipping |

> **Publishing note:** Kenney (CC0) needs nothing. game-icons (CC-BY) needs one
> attribution line — add a **Credits** entry (Settings or About). Avoid NC / unclear
> itch licenses if the game is monetized.

## Per-asset plan (ids from BRIEF §6)

### Free from catalogs → export to PNG
| id(s) | Source | Export action |
|---|---|---|
| `svc-repair` (gear) | game-icons | color = amber `#ffb13b`, transparent, 160px |
| `svc-fuel` (droplet) | game-icons | color = teal `#22e3c6` |
| `svc-board` (person) | game-icons | color = rose `#ff4f9d` |
| `svc-depart` (plane) | game-icons | color = gold `#ffd23b` |
| `heart`, `heart-empty`, `heart-crack` | game-icons (`heart`, `broken-heart`) | color = life `#ff3b6b` |
| `coin`, `star`, `star-empty`, `clock`, `check`, `moon` | game-icons / Kenney UI | gold / cyan as fits |
| `pause-btn`, `zen-badge` | game-icons (`pause`, `moon`) on a chip | bake the rounded neon chip behind the glyph |
| menu icons: `play`, `maps`, `medals`, `settings`, `fullscreen`, `share`, `back`, `lock` | game-icons | per-service/neutral neon color |
| `fx-*` (spark/smoke/dust/ripple/etc.) | **Kenney Particle Pack** (CC0) | recolor to neon on export |

### Engine-procedural → skip (no asset needed)
| `ring-selected`, `ring-patience`, `ring-patience-low` | engine already draws these |

### Needs generation (no matching free pack)
| id(s) | Why | How |
|---|---|---|
| `bay-repair`, `bay-fuel`, `bay-board`, `bay-deice`, `bay-locked` | glossy neon panels matching `ref-01` don't exist pre-made | generate (BRIEF §0.5 prompts) — ~5 images |
| `plane`, `plane-vip`, `plane-emergency`, `plane-medevac` | optional: catalog top-down planes work as silhouettes; generate only if you want the glossy neon body | recolor a CC0 top-down plane **or** generate (4) |
| `menu-bg`, app icon, splash | optional / brand | generate or simple gradient |

**Net generation needed:** **only the 5 bay panels** are mandatory; planes + menu-bg
are optional. Everything else (~40 icons/particles) is **free**.

## Workflow

1. Export the free icons/particles as **transparent PNGs** at the BRIEF §6 sizes, with
   the neon color baked in; drop them in `assets/sprites/neon/`.
2. Generate the 5 bay panels (and optionally planes) per BRIEF §0.5 (Cowork + an
   image-gen connector / OpenRouter image MCP, or any hosted generator).
3. Write `assets/sprites/neon/manifest.json` listing every shipped id.
4. Open the game — the PNG pipeline picks it all up, no code changes.
5. Add a **Credits** attribution line for game-icons (CC-BY).
