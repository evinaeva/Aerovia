#!/usr/bin/env python3
"""
Dump the LayerDiffuse node definitions from the running ComfyUI on the pod.
Used to author the exact API workflow JSON (class names + enum option values).

ComfyUI must be running locally (serve_comfyui.sh leaves it on 127.0.0.1:8188).

    cd /workspace/Aerovia && git pull && python3 tools/style-lora/scripts/comfy_inspect.py
"""
import json
import urllib.request

URL = "http://127.0.0.1:8188/object_info"


def main() -> None:
    data = json.load(urllib.request.urlopen(URL, timeout=30))
    hits = [k for k in data if "layer" in k.lower()]
    print(f"Found {len(hits)} LayerDiffuse-related nodes:\n")
    for k in sorted(hits):
        node = data[k]
        print(f"CLASS: {k}   (display: {node.get('display_name')})")
        ins = node.get("input", {})
        for grp in ("required", "optional"):
            for name, spec in ins.get(grp, {}).items():
                t = spec[0]
                if isinstance(t, list):           # enum -> show the options
                    print(f"    {grp}.{name}: ENUM {t}")
                else:
                    print(f"    {grp}.{name}: {t}")
        outs = node.get("output_name") or node.get("output")
        print(f"    -> outputs: {outs}\n")

    # also confirm the checkpoint + lora ComfyUI can see
    for loader in ("CheckpointLoaderSimple", "LoraLoader"):
        if loader in data:
            req = data[loader]["input"]["required"]
            key = "ckpt_name" if loader == "CheckpointLoaderSimple" else "lora_name"
            print(f"{loader}.{key} options: {req[key][0]}")


if __name__ == "__main__":
    main()
