#!/usr/bin/env bash
# Train the Aerovia cartoon style LoRA on a RunPod pod (RTX 4090, SDXL).
# Run from inside the kohya sd-scripts repo after setup (see README §2).
#
# Everything reads/writes the NETWORK VOLUME mounted at /workspace, so the
# .safetensors survives after you kill the pod.
set -euo pipefail

# RunPod images set HF_HUB_ENABLE_HF_TRANSFER=1 but don't ship hf_transfer,
# which breaks the small CLIP-tokenizer download. Use the normal downloader.
export HF_HUB_ENABLE_HF_TRANSFER=0

VOL=/workspace/aerovia-lora
BASE_MODEL=/workspace/models/sd_xl_base_1.0.safetensors   # download once to the volume
CFG="$VOL/config"
OUT="$VOL/output"
mkdir -p "$OUT"

accelerate launch --num_cpu_threads_per_process 8 sdxl_train_network.py \
  --pretrained_model_name_or_path="$BASE_MODEL" \
  --dataset_config="$CFG/dataset.toml" \
  --output_dir="$OUT" \
  --output_name="aerovia_cartoon_sdxl_v1" \
  --save_model_as=safetensors \
  --network_module=networks.lora \
  --network_dim=32 --network_alpha=16 \
  --learning_rate=1e-4 --unet_lr=1e-4 --text_encoder_lr=4e-5 \
  --lr_scheduler=cosine --lr_warmup_steps=50 \
  --optimizer_type=AdamW8bit \
  --max_train_epochs=8 \
  --train_batch_size=2 \
  --resolution=1024,1024 \
  --mixed_precision=bf16 --save_precision=bf16 --full_bf16 \
  --gradient_checkpointing \
  --cache_latents --cache_latents_to_disk \
  --sdpa \
  --min_snr_gamma=5 \
  --noise_offset=0.03 \
  --max_data_loader_n_workers=4 --persistent_data_loader_workers \
  --save_every_n_epochs=2 \
  --seed=42

echo "Done. LoRA written to $OUT/aerovia_cartoon_sdxl_v1.safetensors"
