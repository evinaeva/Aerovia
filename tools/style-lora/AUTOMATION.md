# Autonomous generation loop (run on the RTX 3060 machine)

Goal: Claude drives the whole sprite loop locally — write/fix prompts → generate
→ QA → review → finalize → ship — on the local 3060. The user only gives ideas
and approves. We moved off RunPod because the pod was unreachable to Claude
(proxy 403, SSH relay can't exec, direct TCP firewalled); **localhost is directly
drivable** by Claude's terminal tools.

## Division of labor
- **User (one-time / occasional):** install the NVIDIA driver if missing; copy the
  LoRA file `aerovia_cartoon_sdxl_v1.safetensors` to this machine (~200 MB, it's
  not in git); give ideas / approve looks.
- **Claude (everything else):** setup, prompts, generation, QA, review (reads the
  PNGs from disk), finalize, commit, open a PR (the owner merges).

## 0. One-time setup
```
git pull
powershell -ExecutionPolicy Bypass -File tools\style-lora\setup_local_comfyui.ps1 -LoraPath <lora file>
```
Leaves ComfyUI serving on http://127.0.0.1:8188 (bundled python, no system Python
needed). Claude reaches it directly via localhost — no tunnel/proxy.

Run the python scripts below with ComfyUI's bundled python:
`%USERPROFILE%\aerovia-comfy\ComfyUI_windows_portable\python_embeded\python.exe`

## 1. The loop (Claude runs this, iterating)
```
# generate the whole roster (or one asset)
<py> tools\style-lora\scripts\run_batch.py
<py> tools\style-lora\scripts\run_comfy.py --prompt "..." --name foo   # single

# auto-QA: quarantine halos / multi-object / blank
<py> tools\style-lora\scripts\qa_filter.py --apply

# Claude reads output\gen\*.png directly, judges style/framing, edits
# comfy\prompts.json (or workflow_api.json), re-runs failures, repeats.

# when a set is clean: crop + resize + drop into a skin folder + manifest
<py> tools\style-lora\scripts\finalize_assets.py --src tools\style-lora\output\gen --skin cartoon-ai
```
Then commit on a branch and open a PR (the owner merges). To go live: either register `cartoon-ai` in the `SKINS`
array in `index.html` (additive, safe), or `--skin cartoon` to overwrite the
existing cartoon skin (destructive — only for approved assets).

## 2. Known issues to fix first (from the pod batch, 2026-06-13)
- **Planes** rendered 3/4-angled, not strict top-down. prompts.json now forces
  "directly overhead / nose up / flat" + a per-plane negative banning side/3-4/
  perspective. **If txt2img still drifts:** escalate to img2img/ControlNet using an
  existing top-down sprite (`assets/sprites/cartoon/plane-vip.png`) as the init/
  control image at medium denoise — that hard-locks the top-down geometry.
- **coin** rendered a 3-coin pile with gibberish — prompts.json now forces "a
  single coin, dollar sign, no text" + a negative banning multiples/faces/text.
- **gem (test)** had an alpha halo — exactly what `qa_filter.py` catches.
- Buildings sometimes bake gizmos on the roof — prompts say "plain roof".

## 3. Style anchors (don't drift)
- Trigger `aerovia_cartoon`; suffix in run_comfy.STYLE.
- Palette/look: single warm-dark outline `#3a2a17`, glossy top, soft cel shading,
  saturated daytime. Buildings = three-quarter; planes = top-down nose-up;
  tokens = front. Bays = empty glossy stalls, NO baked icon/label (engine overlays).
  No baked text anywhere.

## 4. Status (end of 2026-06-13)
- Steps 1–3 done: dataset → LoRA (`aerovia_cartoon_sdxl_v1`, on RunPod volume +
  user's local copy) → transparent RGBA generation works (ComfyUI + LayerDiffuse).
- 44 sprites from the pod batch are on branch `lora-outputs` (unreviewed; planes/
  coin need redo). Not shipped to prod.
- Next: run this loop locally, fix planes/coin, QA, finalize, ship.
