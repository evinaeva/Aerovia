#!/usr/bin/env python3
"""
Patch ComfyUI-layerdiffuse for current ComfyUI.

The RGBA decode calls `JoinImageWithAlpha().join_image_with_alpha(image, alpha)`,
but recent ComfyUI renamed that method (V3 node migration) -> AttributeError.
We replace the call with an inline equivalent that reproduces the original
behaviour exactly (same bilinear mask resize + inversion), so it no longer
depends on ComfyUI internals. Idempotent.

    python3 tools/style-lora/scripts/patch_layerdiffuse.py
"""
import os
import sys
from pathlib import Path

# Path to the node file: argv[1] > $LAYERDIFFUSE_PY > pod default. Lets the same
# patch run on the pod and on a local Windows ComfyUI.
TARGET = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
    os.environ.get("LAYERDIFFUSE_PY",
                   "/workspace/ComfyUI/custom_nodes/ComfyUI-layerdiffuse/layered_diffusion.py"))
MARKER = "join_image_with_alpha(image, alpha)"
TAG = "AEROVIA_PATCHED"


def main() -> None:
    if not TARGET.exists():
        sys.exit(f"not found: {TARGET}")
    src = TARGET.read_text(encoding="utf-8")
    if TAG in src:
        print("already patched, nothing to do")
        return
    lines = src.splitlines()
    for i, ln in enumerate(lines):
        if MARKER in ln and "return" in ln:
            ind = ln[: len(ln) - len(ln.lstrip())]
            repl = [
                f"{ind}# {TAG}: inline JoinImageWithAlpha (ComfyUI renamed the method)",
                f"{ind}import torch as _t",
                f"{ind}_a = _t.nn.functional.interpolate("
                f"alpha.reshape((-1, 1, alpha.shape[-2], alpha.shape[-1])), "
                f"size=(image.shape[1], image.shape[2]), mode='bilinear').squeeze(1)",
                f"{ind}_a = 1.0 - _a",
                f"{ind}_out = [_t.cat((image[j][:, :, :3], _a[j].unsqueeze(2)), dim=2) "
                f"for j in range(min(len(image), len(_a)))]",
                f"{ind}return (_t.stack(_out),)",
            ]
            lines[i : i + 1] = repl
            TARGET.write_text("\n".join(lines) + "\n", encoding="utf-8")
            print(f"patched {TARGET} at line {i + 1}")
            return
    sys.exit("marker line not found — node version changed; inspect manually")


if __name__ == "__main__":
    main()
