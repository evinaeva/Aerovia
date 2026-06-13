#!/usr/bin/env python3
"""
Aerovia style-LoRA dataset prep.

Reads dataset/manifest.json, then for each listed sprite:
  - trims transparent margins to the alpha bounding box,
  - composites the RGBA sprite onto a flat neutral background (kills the
    transparency so SDXL/Kohya can train on RGB; LayerDiffuse restores the
    alpha later at GENERATION time, not here),
  - pads to a centered square and resizes to --size (default 1024),
  - writes <name>.png + <name>.txt (caption) into the Kohya concept folder
    dataset/train/<repeats>_aerovia/.

Run on the RunPod pod (Python+Pillow already there) or locally once Pillow is
installed:  pip install pillow

Windows (local):  py scripts\\prepare_dataset.py
Linux  (pod):     python3 scripts/prepare_dataset.py
"""
import argparse
import json
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent                       # tools/style-lora/
REPO = ROOT.parent.parent                # repo root


def load_manifest(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def caption_for(item: dict, trigger: str, suffix: str) -> str:
    parts = [trigger, item["subject"], item["view"], suffix]
    return ", ".join(p.strip() for p in parts if p and p.strip())


def process_one(src: Path, size: int, bg: tuple[int, int, int], margin: float) -> Image.Image:
    img = Image.open(src).convert("RGBA")
    # Trim to the alpha bounding box so framing is consistent regardless of
    # the original canvas padding.
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    w, h = img.size
    side = int(round(max(w, h) * (1.0 + margin)))
    canvas = Image.new("RGBA", (side, side), bg + (255,))
    canvas.paste(img, ((side - w) // 2, (side - h) // 2), img)  # alpha-composite
    canvas = canvas.convert("RGB").resize((size, size), Image.LANCZOS)
    return canvas


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sprites", type=Path,
                    default=REPO / "assets" / "sprites" / "cartoon",
                    help="source folder with the cartoon PNG sprites")
    ap.add_argument("--manifest", type=Path, default=ROOT / "dataset" / "manifest.json")
    ap.add_argument("--out", type=Path, default=ROOT / "dataset" / "train",
                    help="Kohya dataset root; concept folder is created inside")
    ap.add_argument("--repeats", type=int, default=10,
                    help="Kohya repeats; folder is named <repeats>_aerovia")
    ap.add_argument("--size", type=int, default=1024)
    ap.add_argument("--bg", default="240,240,242",
                    help="flat background RGB the sprite is composited onto")
    ap.add_argument("--margin", type=float, default=0.12,
                    help="extra padding around the object (fraction of its long side)")
    args = ap.parse_args()

    man = load_manifest(args.manifest)
    trigger, suffix = man["trigger"], man["style_suffix"]
    bg = tuple(int(x) for x in args.bg.split(","))

    concept = args.out / f"{args.repeats}_aerovia"
    concept.mkdir(parents=True, exist_ok=True)

    n_ok, n_missing = 0, []
    for item in man["items"]:
        src = args.sprites / item["file"]
        if not src.exists():
            n_missing.append(item["file"])
            continue
        out_img = concept / item["file"]
        process_one(src, args.size, bg, args.margin).save(out_img)
        (concept / (src.stem + ".txt")).write_text(
            caption_for(item, trigger, suffix), encoding="utf-8")
        n_ok += 1

    print(f"[ok] wrote {n_ok} image+caption pairs to {concept}")
    print(f"[info] trigger token: {trigger}")
    print(f"[info] background: {bg}  size: {args.size}  repeats: {args.repeats}")
    steps_per_epoch = n_ok * args.repeats
    print(f"[info] {steps_per_epoch} steps/epoch at batch 1 "
          f"(~{steps_per_epoch * 8 // 2} steps over 8 epochs at batch 2)")
    if n_missing:
        print(f"[WARN] {len(n_missing)} sprites not found: {n_missing}")


if __name__ == "__main__":
    main()
