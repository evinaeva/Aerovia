#!/usr/bin/env python3
"""
Batch-generate transparent sprites from comfy/prompts.json on the pod.
Each entry: {name, view, subject, [neg], [seed]} -> one RGBA PNG named <name>.png
in output/gen/, with an alpha report. Reuses run_comfy.py's API helpers.

    cd /workspace/Aerovia && python3 tools/style-lora/scripts/run_batch.py
"""
import json
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import run_comfy as rc  # noqa: E402

PROMPTS = rc.ROOT / "comfy" / "prompts.json"


def main() -> None:
    items = json.loads(PROMPTS.read_text(encoding="utf-8"))
    template = json.loads(rc.WF.read_text(encoding="utf-8"))
    rc.OUT.mkdir(parents=True, exist_ok=True)

    ok, fail = 0, []
    for it in items:
        wf = json.loads(json.dumps(template))  # deep copy per item
        prompt = f"aerovia_cartoon, {it['subject']}, {it['view']}, {rc.STYLE}"
        wf["6"]["inputs"]["text"] = prompt
        if it.get("neg"):
            wf["7"]["inputs"]["text"] = it["neg"]
        wf["3"]["inputs"]["seed"] = it.get("seed", random.randint(1, 2**31))
        wf["9"]["inputs"]["filename_prefix"] = f"aerovia_{it['name']}"
        print(f"\n=== {it['name']} (seed {wf['3']['inputs']['seed']}) ===")
        try:
            outputs = rc.wait(rc.queue(wf))
        except SystemExit as e:
            print(f"[FAIL] {it['name']}: {e}")
            fail.append(it["name"])
            continue
        for node in outputs.values():
            for img in node.get("images", []):
                dst = rc.OUT / f"{it['name']}.png"
                dst.write_bytes(rc.view(img))
                print(f"[ok] {dst.name} -> {rc.alpha_report(dst)}")
                ok += 1

    print(f"\n[batch done] {ok} ok, {len(fail)} failed{': ' + ', '.join(fail) if fail else ''}")
    print(f"output in {rc.OUT}")


if __name__ == "__main__":
    main()
