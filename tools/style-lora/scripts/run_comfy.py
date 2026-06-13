#!/usr/bin/env python3
"""
Drive ComfyUI's HTTP API (localhost) to generate one transparent sprite and
report whether the alpha channel is real. No GUI / proxy / tunnel needed.

    cd /workspace/Aerovia
    python3 tools/style-lora/scripts/run_comfy.py \
        --prompt "aerovia_cartoon, a yellow fuel tanker truck, side three-quarter view" \
        --name truck

Loads comfy/workflow_api.json, swaps the positive prompt / seed / filename,
POSTs to /prompt, waits for the result, pulls the PNG via /view, saves it to
output/gen/, and prints size + % transparent pixels (proof the RGBA worked).
"""
import argparse
import json
import random
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

HOST = "127.0.0.1:8188"
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent                       # tools/style-lora/
WF = ROOT / "comfy" / "workflow_api.json"
OUT = ROOT / "output" / "gen"

STYLE = ("single warm-dark outline, glossy cartoon, soft cel shading, "
         "saturated daytime palette, simple background")


def _get(path: str) -> bytes:
    return urllib.request.urlopen(f"http://{HOST}{path}", timeout=60).read()


def queue(wf: dict) -> str:
    data = json.dumps({"prompt": wf}).encode()
    req = urllib.request.Request(f"http://{HOST}/prompt", data=data,
                                 headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=60).read())["prompt_id"]


def wait(pid: str, timeout: int = 600) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        hist = json.loads(_get(f"/history/{pid}") or b"{}")
        if pid in hist:
            entry = hist[pid]
            if entry.get("outputs"):
                return entry["outputs"]
            status = entry.get("status", {})
            if status.get("status_str") == "error" or status.get("completed") is False:
                msgs = json.dumps(status.get("messages", []))[:800]
                raise SystemExit(f"ComfyUI execution error:\n{msgs}")
        time.sleep(2)
    raise SystemExit("timed out waiting for ComfyUI")


def view(img: dict) -> bytes:
    q = urllib.parse.urlencode({"filename": img["filename"],
                                "subfolder": img.get("subfolder", ""),
                                "type": img.get("type", "output")})
    return _get(f"/view?{q}")


def alpha_report(path: Path) -> str:
    im = Image.open(path)
    if im.mode != "RGBA":
        return f"mode={im.mode} (NO ALPHA!)"
    a = im.getchannel("A")
    lo, hi = a.getextrema()
    transparent = sum(1 for p in a.getdata() if p < 16)
    pct = 100.0 * transparent / (im.width * im.height)
    return (f"mode=RGBA size={im.width}x{im.height} alpha_range=({lo},{hi}) "
            f"transparent_bg={pct:.1f}%")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt", help="subject phrase; STYLE suffix is appended. "
                                      "Omit to use the building in the template.")
    ap.add_argument("--neg", default=None)
    ap.add_argument("--name", default="test")
    ap.add_argument("--seed", type=int, default=None)
    args = ap.parse_args()

    wf = json.loads(WF.read_text(encoding="utf-8"))
    if args.prompt:
        wf["6"]["inputs"]["text"] = f"aerovia_cartoon, {args.prompt}, {STYLE}"
    if args.neg:
        wf["7"]["inputs"]["text"] = args.neg
    wf["3"]["inputs"]["seed"] = args.seed if args.seed is not None else random.randint(1, 2**31)
    wf["9"]["inputs"]["filename_prefix"] = f"aerovia_{args.name}"

    OUT.mkdir(parents=True, exist_ok=True)
    print(f"[run] prompt: {wf['6']['inputs']['text']}")
    print(f"[run] seed:   {wf['3']['inputs']['seed']}")
    pid = queue(wf)
    print(f"[run] queued {pid}, waiting...")
    outputs = wait(pid)

    saved = []
    for node in outputs.values():
        for img in node.get("images", []):
            dst = OUT / f"{args.name}_{img['filename']}"
            dst.write_bytes(view(img))
            saved.append(dst)
            print(f"[ok] {dst.name}  ->  {alpha_report(dst)}")
    if not saved:
        raise SystemExit("no images in outputs — check the workflow")
    print(f"\n[done] {len(saved)} image(s) in {OUT}")


if __name__ == "__main__":
    main()
