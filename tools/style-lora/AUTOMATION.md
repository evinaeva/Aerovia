# Autonomous generation loop — RETIRED

> **This workflow is retired.** It drove a local ComfyUI + SDXL LoRA loop (write/fix
> prompts → generate → QA → review → finalize → ship) to produce sprites for an
> *alternate* art look. The game now has a **single look (neon)** and that alternate
> look was removed, so there is nothing for this loop to generate against.

See [`README.md`](README.md) for context, and the neon look's brief/sourcing for how
art plugs into the engine today:

- [`../../docs/design/skins/neon/BRIEF.md`](../../docs/design/skins/neon/BRIEF.md)
- [`../../docs/design/skins/neon/SOURCING.md`](../../docs/design/skins/neon/SOURCING.md)

> GPU safety note (still relevant if you ever run heavy local generation on the home
> RTX 3060): clocks are locked automatically at Windows start via the scheduled task
> `GPU Clock Lock 3060` (`-lgc 210,1400`), so there's no reboot risk.
