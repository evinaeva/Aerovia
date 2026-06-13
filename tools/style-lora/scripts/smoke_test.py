#!/usr/bin/env python3
"""
Quick style smoke-test for the trained LoRA — run on the pod BEFORE stopping it.

Loads SDXL base + the freshest LoRA checkpoint and renders a few test prompts so
you can eyeball whether the cartoon style transferred. No transparency here
(that's LayerDiffuse's job at real generation time) — this only checks the look.

    pip install -q diffusers accelerate
    python3 /workspace/aerovia-lora/scripts/smoke_test.py
"""
import glob
import os
import re
from pathlib import Path

import torch
from diffusers import StableDiffusionXLPipeline

VOL = Path("/workspace")
BASE = VOL / "models" / "sd_xl_base_1.0.safetensors"
OUT = VOL / "aerovia-lora" / "output"
SMOKE = OUT / "smoke"
SMOKE.mkdir(parents=True, exist_ok=True)

STYLE = ("single warm-dark outline, glossy cartoon, soft cel shading, "
         "saturated daytime palette, simple background")
NEG = "blurry, photo, realistic, 3d render, noisy, text, watermark, jpeg artifacts"

# (filename, prompt) — mix of views the LoRA was taught.
PROMPTS = [
    ("airplane_topdown",
     f"aerovia_cartoon, top-down view of a yellow cargo airplane, top-down, {STYLE}"),
    ("building_3q",
     f"aerovia_cartoon, a green control-tower service building, three-quarter view, {STYLE}"),
    ("token_front",
     f"aerovia_cartoon, a glossy blue gem currency token, front view, {STYLE}"),
    ("env_front",
     f"aerovia_cartoon, a small palm tree on a grass tuft, front view, {STYLE}"),
]


def latest_lora() -> Path:
    final = OUT / "aerovia_cartoon_sdxl_v1.safetensors"
    if final.exists():
        return final
    cks = sorted(glob.glob(str(OUT / "aerovia_cartoon_sdxl_v1-*.safetensors")),
                 key=lambda p: int(re.findall(r"-(\d+)\.safetensors$", p)[0]))
    if not cks:
        raise SystemExit(f"No LoRA checkpoint found in {OUT}")
    return Path(cks[-1])


def main() -> None:
    lora = latest_lora()
    print(f"[smoke] base : {BASE}")
    print(f"[smoke] lora : {lora}")
    pipe = StableDiffusionXLPipeline.from_single_file(
        str(BASE), torch_dtype=torch.bfloat16).to("cuda")
    pipe.load_lora_weights(str(lora))
    pipe.set_progress_bar_config(disable=False)

    gen = torch.Generator("cuda").manual_seed(42)
    for name, prompt in PROMPTS:
        img = pipe(prompt=prompt, negative_prompt=NEG,
                   num_inference_steps=28, guidance_scale=7.0,
                   width=1024, height=1024, generator=gen).images[0]
        path = SMOKE / f"{name}.png"
        img.save(path)
        print(f"[smoke] wrote {path}")

    print(f"\n[smoke] done -> {SMOKE}")
    print("Open these in Jupyter Lab (left file browser) to eyeball the style.")


if __name__ == "__main__":
    main()
