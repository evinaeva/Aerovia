#!/usr/bin/env bash
# ============================================================================
# Install ComfyUI + LayerDiffuse on the pod's network volume, wire in the
# SDXL base + our trained LoRA, and launch the ComfyUI server.
#
# Goal: validate the transparent-sprite workflow interactively BEFORE moving it
# to a serverless worker-comfyui endpoint. Everything lives on /workspace so it
# survives a pod stop and can be reused by the serverless worker.
#
#   bash /workspace/aerovia-lora/setup_comfyui.sh
#
# Then open ComfyUI via the pod proxy:  https://<POD_ID>-8188.proxy.runpod.net
# (expose HTTP port 8188 first: Pods -> your pod -> Edit -> add port 8188).
# ============================================================================
set -euo pipefail

# RunPod images set this without shipping hf_transfer -> breaks HF downloads
# (LayerDiffuse pulls its weights from HF on first use).
export HF_HUB_ENABLE_HF_TRANSFER=0

VOL=/workspace
COMFY="$VOL/ComfyUI"
BASE="$VOL/models/sd_xl_base_1.0.safetensors"
LORA="$VOL/aerovia-lora/output/aerovia_cartoon_sdxl_v1.safetensors"

echo "==> [1/4] ComfyUI"
if [ ! -d "$COMFY/.git" ]; then
  git clone https://github.com/comfyanonymous/ComfyUI "$COMFY"
fi
cd "$COMFY"
pip install -q -r requirements.txt

echo "==> [2/4] ComfyUI-LayerDiffuse custom node"
ND="$COMFY/custom_nodes/ComfyUI-layerdiffuse"
if [ ! -d "$ND/.git" ]; then
  git clone https://github.com/huchenlei/ComfyUI-layerdiffuse "$ND"
fi
pip install -q -r "$ND/requirements.txt" || true

echo "==> [3/4] Link base model + LoRA into ComfyUI"
mkdir -p "$COMFY/models/checkpoints" "$COMFY/models/loras"
ln -sf "$BASE" "$COMFY/models/checkpoints/sd_xl_base_1.0.safetensors"
ln -sf "$LORA" "$COMFY/models/loras/aerovia_cartoon_sdxl_v1.safetensors"
ls -l "$COMFY/models/checkpoints" "$COMFY/models/loras"

echo "==> [4/4] Launch ComfyUI on :8188 (Ctrl-C to stop)"
echo "    Open: https://<POD_ID>-8188.proxy.runpod.net   (expose port 8188 first)"
cd "$COMFY"
python main.py --listen 0.0.0.0 --port 8188
