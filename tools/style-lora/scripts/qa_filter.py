#!/usr/bin/env python3
"""
Auto-QA for generated sprites. Flags the failure modes we hit by hand:
  - dirty alpha / halo  (too many semi-transparent pixels — the gem haze)
  - multiple objects    (>1 big connected blob — the 3-coin pile / sprite sheets)
  - blank / over-full    (almost no object, or no transparent background)
  - missing alpha
Writes output/gen/qa_report.json + a printed table. With --apply, moves failures
to output/gen/_rejected/ so only clean sprites remain for finalize.

Run with ComfyUI's bundled python (has Pillow) or any python+pillow:
    python qa_filter.py [--dir <gen dir>] [--apply]
"""
import argparse
import json
import shutil
from collections import deque
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DEFAULT_DIR = ROOT / "output" / "gen"
N = 128  # alpha is downscaled to N x N for fast analysis


def connected_components(mask: bytearray, min_area: int) -> list[int]:
    seen = bytearray(N * N)
    areas = []
    for start in range(N * N):
        if mask[start] and not seen[start]:
            q = deque([start])
            seen[start] = 1
            area = 0
            while q:
                p = q.popleft()
                area += 1
                x, y = p % N, p // N
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < N and 0 <= ny < N:
                        q2 = ny * N + nx
                        if mask[q2] and not seen[q2]:
                            seen[q2] = 1
                            q.append(q2)
            if area >= min_area:
                areas.append(area)
    return sorted(areas, reverse=True)


def qa_one(path: Path) -> dict:
    im = Image.open(path)
    if im.mode != "RGBA":
        return {"file": path.name, "issues": ["no-alpha"], "pass": False}
    px = list(im.getchannel("A").resize((N, N)).getdata())
    total = len(px)
    transparent = sum(1 for v in px if v <= 16)
    semi = sum(1 for v in px if 16 < v < 240)
    bg = 100.0 * transparent / total
    semi_pct = 100.0 * semi / total
    comps = connected_components(bytearray(1 if v > 40 else 0 for v in px),
                                 min_area=int(0.005 * total))

    issues = []
    if bg < 15:
        issues.append(f"bg-too-full({bg:.0f}%)")
    if bg > 96:
        issues.append(f"near-blank({bg:.0f}%)")
    if semi_pct > 10:
        issues.append(f"dirty-alpha/halo({semi_pct:.0f}%)")
    if len(comps) > 1:
        issues.append(f"multi-object({len(comps)})")
    return {"file": path.name, "bg": round(bg, 1), "semi": round(semi_pct, 1),
            "comps": len(comps), "issues": issues, "pass": not issues}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", type=Path, default=DEFAULT_DIR)
    ap.add_argument("--apply", action="store_true",
                    help="move failing sprites to _rejected/")
    args = ap.parse_args()

    rejected = args.dir / "_rejected"
    files = sorted(p for p in args.dir.glob("*.png"))
    report = [qa_one(p) for p in files]

    print(f"{'file':32} {'bg%':>5} {'semi%':>6} {'comp':>4}  verdict")
    for r in report:
        v = "OK" if r["pass"] else "FAIL: " + ", ".join(r["issues"])
        print(f"{r['file']:32} {r.get('bg',''):>5} {r.get('semi',''):>6} "
              f"{r.get('comps',''):>4}  {v}")
        if args.apply and not r["pass"]:
            rejected.mkdir(exist_ok=True)
            shutil.move(str(args.dir / r["file"]), str(rejected / r["file"]))

    (args.dir / "qa_report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8")
    n_pass = sum(1 for r in report if r["pass"])
    print(f"\n{n_pass}/{len(report)} passed."
          + (f" {len(report)-n_pass} moved to {rejected}" if args.apply else
             " (run with --apply to quarantine failures)"))


if __name__ == "__main__":
    main()
