#!/usr/bin/env bash
# ============================================================================
# One-shot RunPod setup + train for the Aerovia cartoon style LoRA.
# Run ONCE on a RTX 4090 pod that has a network volume mounted at /workspace.
#
# Usage on the pod (web terminal):
#
#   cd /workspace
#   git clone https://github.com/evinaeva/Aerovia.git        # public repo
#   # ...or private:  git clone https://<TOKEN>@github.com/evinaeva/Aerovia.git
#   bash Aerovia/tools/style-lora/setup_pod.sh
#
# Optional env vars:
#   HF_TOKEN=hf_xxx        # only if SDXL base download asks you to log in
#   GITHUB_TOKEN=ghp_xxx   # if the repo is private and not cloned yet
#   SKIP_TRAIN=1           # prepare everything but don't start training
# ============================================================================
set -euo pipefail

VOL=/workspace
REPO_DIR="$VOL/Aerovia"
TOOLS="$REPO_DIR/tools/style-lora"
LINK="$VOL/aerovia-lora"            # train.sh / dataset.toml expect this path
SD="$VOL/sd-scripts"
MODELS="$VOL/models"
BASE="$MODELS/sd_xl_base_1.0.safetensors"

echo "==> [1/6] Repo"
if [ ! -d "$REPO_DIR/.git" ]; then
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    git clone "https://${GITHUB_TOKEN}@github.com/evinaeva/Aerovia.git" "$REPO_DIR"
  else
    git clone "https://github.com/evinaeva/Aerovia.git" "$REPO_DIR"
  fi
else
  echo "    repo already present, pulling latest"
  git -C "$REPO_DIR" pull --ff-only || true
fi
# train.sh and dataset.toml reference /workspace/aerovia-lora -> point it at the repo's tools dir
ln -sfn "$TOOLS" "$LINK"

echo "==> [2/6] kohya sd-scripts"
if [ ! -d "$SD/.git" ]; then
  git clone https://github.com/kohya-ss/sd-scripts "$SD"
fi
cd "$SD"
pip install -q -r requirements.txt
pip install -q bitsandbytes      # needed for AdamW8bit optimizer

echo "==> [3/6] accelerate (single-GPU default, headless)"
accelerate config default >/dev/null 2>&1 || true

echo "==> [4/6] SDXL base model (~6.5 GB, to the volume)"
mkdir -p "$MODELS"
if [ ! -f "$BASE" ]; then
  URL="https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors"
  if [ -n "${HF_TOKEN:-}" ]; then
    wget --header="Authorization: Bearer ${HF_TOKEN}" -O "$BASE" "$URL"
  else
    wget -O "$BASE" "$URL"
  fi
else
  echo "    base model already on volume, skipping download"
fi

echo "==> [5/6] Prepare dataset (33 sprites -> 1024 + captions)"
pip install -q pillow
python3 "$TOOLS/scripts/prepare_dataset.py"

echo "==> [6/6] Train"
if [ "${SKIP_TRAIN:-0}" = "1" ]; then
  echo "    SKIP_TRAIN=1 set — stopping before training."
  echo "    To train later:  cd $SD && bash $LINK/train.sh"
  exit 0
fi
cd "$SD"
bash "$LINK/train.sh"

echo
echo "============================================================"
echo "DONE. LoRA -> $LINK/output/aerovia_cartoon_sdxl_v1.safetensors"
echo "It's on the network volume, so you can STOP THE POD now."
echo "============================================================"
