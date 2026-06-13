#!/usr/bin/env bash
# Push generated sprites (output/gen) to the `lora-outputs` branch so they can be
# pulled off the pod for review. The token stays in the pod shell, never in chat.
#
#   GITHUB_TOKEN=ghp_xxx bash /workspace/aerovia-lora/push_outputs.sh
#
# Leaves the pod's main branch unchanged (soft-resets the transfer commit) so
# future `git pull` keeps fast-forwarding.
set -euo pipefail
: "${GITHUB_TOKEN:?set GITHUB_TOKEN=...  (needs repo write access)}"

cd /workspace/Aerovia
git config user.email "pod@aerovia.local"
git config user.name  "aerovia-pod"

git add -f tools/style-lora/output/gen/*.png
git commit -q -m "pod batch outputs" || { echo "nothing to push"; exit 0; }
git push -f "https://${GITHUB_TOKEN}@github.com/evinaeva/Aerovia.git" \
  HEAD:refs/heads/lora-outputs
git reset --soft HEAD~1     # keep main clean + files still in working tree
echo "pushed $(ls tools/style-lora/output/gen/*.png | wc -l) sprites to branch 'lora-outputs'"
