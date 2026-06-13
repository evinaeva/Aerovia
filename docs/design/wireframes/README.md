# PlaneFlow — UI wireframes / mockups

Rendered layout proposal for every screen + the screen-flow map. This is the **layout**
layer (where buttons go, sizing, composition), **not** a snapshot of the current
`index.html` — it redesigns the UI from the gameplay up.

Full write-up & rationale: [`../art-direction/wireframes.md`](../art-direction/wireframes.md).

## Regenerate

```sh
pip install cairosvg pillow   # once
python3 build.py              # writes *.svg, *.png, overview.png
```

`build.py` is the single source — palette, sizes, and every screen live there. Edit and
re-run to update all images.

## Files

| File | Screen |
| --- | --- |
| `00-flow.png` | Screen-flow map |
| `01-start.png` | Start / main menu |
| `02-levels.png` | Level select («flight map») |
| `03-hud.png` | In-game HUD (hero) |
| `04-aircraft.png` | Aircraft info / to-do |
| `05-pause.png` | Pause |
| `06-goals.png` | Shift goals |
| `07-over.png` | End of shift |
| `08-settings.png` | Settings |
| `09-medals.png` | Medals / achievements |
| `overview.png` | Contact sheet (9 screens) |
