#!/usr/bin/env python3
"""
Turn approved generated sprites into game-ready PNGs and drop them into a skin
folder so the engine picks them up.

For each PNG in --src whose stem is a known asset id (from comfy/prompts.json):
  - crop to the alpha bounding box (+ small margin),
  - resize so the long side = the asset's author size (from prompts.json),
  - save as assets/sprites/<skin>/<id>.png,
  - add the id to assets/sprites/<skin>/manifest.json.

The engine loads assets/sprites/<skin>/<id>.png for SKIN=<skin> (see src/game/02-sprites.ts).
Default --skin is 'cartoon-ai' (a NEW, non-destructive folder; register it in the
SKINS array to view via ?skin=cartoon-ai). Use --skin cartoon to overwrite the
existing cartoon skin (destructive — only for reviewed, approved assets).

    python finalize_assets.py --src output/gen --skin cartoon-ai [--ids plane,tree]
"""
import argparse
import json
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent                       # tools/style-lora/
REPO = ROOT.parent.parent                # repo root
PROMPTS = ROOT / "comfy" / "prompts.json"
MARGIN = 0.06


def size_map() -> dict:
    return {it["name"]: int(it.get("size", 256))
            for it in json.loads(PROMPTS.read_text(encoding="utf-8"))}


def finalize_one(src: Path, target_long: int) -> Image.Image:
    im = Image.open(src).convert("RGBA")
    bbox = im.getalpha().getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    scale = target_long / max(w, h)
    out = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, default=ROOT / "output" / "gen")
    ap.add_argument("--skin", default="cartoon-ai")
    ap.add_argument("--ids", help="comma-separated subset; default = all known ids present")
    args = ap.parse_args()

    sizes = size_map()
    wanted = set(args.ids.split(",")) if args.ids else None
    skin_dir = REPO / "assets" / "sprites" / args.skin
    skin_dir.mkdir(parents=True, exist_ok=True)

    done = []
    for src in sorted(args.src.glob("*.png")):
        stem = src.stem
        if stem not in sizes:
            continue
        if wanted and stem not in wanted:
            continue
        finalize_one(src, sizes[stem]).save(skin_dir / f"{stem}.png")
        done.append(stem)
        print(f"[ok] {stem}.png  ({sizes[stem]}px)")

    # merge manifest
    man = skin_dir / "manifest.json"
    existing = json.loads(man.read_text(encoding="utf-8")) if man.exists() else []
    merged = existing + [i for i in done if i not in existing]
    man.write_text(json.dumps(merged, indent=0), encoding="utf-8")

    print(f"\n[done] {len(done)} assets -> {skin_dir}")
    print(f"manifest now lists {len(merged)} ids")
    if args.skin != "cartoon":
        print(f"NOTE: register '{args.skin}' in the SKINS array in src/game/ (see CLAUDE.md) to "
              f"view it (?skin={args.skin}).")


if __name__ == "__main__":
    main()
