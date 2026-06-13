#!/usr/bin/env bash
# Serve ComfyUI from the pod over a public Cloudflare quick-tunnel.
# Bypasses the RunPod HTTP proxy (403) and the direct-TCP firewall block:
# the tunnel is plain HTTPS over 443 to a https://<random>.trycloudflare.com URL.
#
#   cd /workspace/Aerovia && git pull && bash /workspace/aerovia-lora/serve_comfyui.sh
#
# Copy the printed https://...trycloudflare.com URL into your browser -> ComfyUI.
set -euo pipefail
export HF_HUB_ENABLE_HF_TRANSFER=0

COMFY=/workspace/ComfyUI

echo "==> Cleaning stale processes"
pkill -f 'main.py' 2>/dev/null || true
pkill -f cloudflared 2>/dev/null || true
sleep 2

echo "==> Launching ComfyUI in the background on :8188"
cd "$COMFY"
nohup python main.py --listen 127.0.0.1 --port 8188 > /workspace/comfy.log 2>&1 &

echo "==> Waiting for ComfyUI to respond..."
up=0
for i in $(seq 1 60); do
  if curl -s -o /dev/null http://localhost:8188; then up=1; break; fi
  sleep 2
done
if [ "$up" != "1" ]; then
  echo "!! ComfyUI did not come up — last log lines:"; tail -n 30 /workspace/comfy.log; exit 1
fi
echo "   ComfyUI is up."

echo "==> Installing cloudflared (once)"
if [ ! -x /usr/local/bin/cloudflared ]; then
  wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
    -O /usr/local/bin/cloudflared
  chmod +x /usr/local/bin/cloudflared
fi

echo "============================================================"
echo " Opening public tunnel. Copy the https://<...>.trycloudflare.com"
echo " URL printed below into your browser to reach ComfyUI."
echo " (Keep this terminal running. Ctrl-C stops the tunnel.)"
echo "============================================================"
exec cloudflared tunnel --url http://localhost:8188
