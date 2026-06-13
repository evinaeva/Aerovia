#!/usr/bin/env bash
# Serve the generated sprites (output/gen) over a public Cloudflare URL so you
# can eyeball them in a browser. Plain http.server does no Host check, so no
# 403 (unlike ComfyUI). Re-run anytime; refresh the browser to see new sprites.
#
#   bash /workspace/aerovia-lora/serve_outputs.sh
set -euo pipefail

DIR=/workspace/Aerovia/tools/style-lora/output/gen
mkdir -p "$DIR"

pkill -f 'http.server' 2>/dev/null || true
pkill -f cloudflared   2>/dev/null || true
sleep 1

cd "$DIR"
nohup python3 -m http.server 8000 > /workspace/httpd.log 2>&1 &
sleep 2

echo "============================================================"
echo " Open the https://<...>.trycloudflare.com URL below — you'll"
echo " get a file listing of generated sprites. Click a .png to view."
echo "============================================================"
exec cloudflared tunnel --url http://localhost:8000
