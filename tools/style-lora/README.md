# Aerovia cartoon style LoRA

Pipeline to fix the existing `assets/sprites/cartoon` art style as an SDXL LoRA,
then generate new transparent (RGBA) sprites in that style. All models used are
commercially clean (SDXL = OpenRAIL++).

- **Trigger token:** `aerovia_cartoon`
- **Base:** SDXL 1.0
- **Transparency:** handled at *generation* time by LayerDiffuse — training is on
  flattened RGB (see step 1).
- **Train + generate:** one RunPod network volume mounted at `/workspace`.

## Dataset (Core, 33 sprites)

Curated in [`dataset/manifest.json`](dataset/manifest.json). Style is intentionally
homogeneous: gameplay airplanes (top-down), bay/terminal buildings (three-quarter),
environment, the service truck, and glossy tokens. Deliberately **excluded** from
the style set: flat UI icons (`plane.png`, `play`, `back`, `settings`…), service
chip buttons (`svc-*`), HUD rings (`ring-*`), branding (`logo`, `app-icon`,
`wordmark`, `splash`, `menu-bg`), and `fx-*` effects — they use different render
treatments / messy alpha and would dilute the style.

## 1 · Prepare the dataset

`prepare_dataset.py` trims each sprite to its alpha box, composites it onto a flat
neutral background, squares + resizes to 1024, and writes `<name>.png` +
`<name>.txt` captions into `dataset/train/10_aerovia/`.

```bash
pip install pillow
# local Windows:  py scripts\prepare_dataset.py
python3 scripts/prepare_dataset.py            # uses repo sprites by default
```

Captions are built as `aerovia_cartoon, <subject>, <view>, <style suffix>`. The
`<view>` tag (`top-down` / `three-quarter view`) is what lets ONE LoRA serve both
the top-down planes and the angled buildings — steer it with the same tag at
generation time.

> Background: default `--bg 240,240,242` (light neutral) protects the white-bodied
> planes from washing out. If silhouettes still bleed, try a mid-gray. The bg is
> only a training aid — LayerDiffuse produces the real alpha later.

## 2 · Train on RunPod (RTX 4090, ~30–60 min)

You: deploy the pod with a network volume, then **stop it right after training**.

```bash
# on the pod, with the volume mounted at /workspace
cd /workspace && git clone https://github.com/kohya-ss/sd-scripts && cd sd-scripts
pip install -r requirements.txt && accelerate config default

# base model -> volume (accept SDXL license on HF; token only if gated for you)
mkdir -p /workspace/models
wget -O /workspace/models/sd_xl_base_1.0.safetensors \
  https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors

# put this repo's tools/style-lora/ on the volume as /workspace/aerovia-lora/
# (git clone Aerovia, or rsync just the folder), run prep there, then:
bash /workspace/aerovia-lora/train.sh
```

Config: [`train.sh`](train.sh) + [`config/dataset.toml`](config/dataset.toml).
Defaults: dim 32 / alpha 16, AdamW8bit, cosine, batch 2, 8 epochs ≈ **~1300 steps**
on 33 imgs. Checkpoints every 2 epochs land in `/workspace/aerovia-lora/output/`
so you can pick the least-overfit one. Output:
`aerovia_cartoon_sdxl_v1.safetensors`.

## 3 · Generate transparent sprites — *next step*

ComfyUI workflow: SDXL base + this LoRA + LayerDiffuse → RGBA PNG. Run as a pod
batch or a `worker-comfyui` serverless endpoint reading the same volume. A Python
client will POST one prompt per asset and pull the PNG. (Built once the LoRA exists.)

## 4 · QA / auto-reject — *next step*

Filter geometry/artefact/dirty-alpha failures before they pile up.

## 5 · Local generation on the RTX 3060 — *next step*

Pull the `.safetensors` from the volume; run the same ComfyUI workflow locally for
free.
