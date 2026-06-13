<#
  Local ComfyUI + LayerDiffuse + Aerovia LoRA setup for the RTX 3060 machine.
  ComfyUI portable bundles its own Python (python_embeded) — no system/admin
  Python needed. Run from the repo's tools/style-lora folder:

      powershell -ExecutionPolicy Bypass -File setup_local_comfyui.ps1 -LoraPath C:\path\to\aerovia_cartoon_sdxl_v1.safetensors

  Needs: NVIDIA driver for the 3060, ~15 GB free disk. The LoRA file must be on
  this machine (copy it over, ~200 MB) — pass it with -LoraPath, or drop it in
  Downloads/Desktop and the script will find it.
#>
param(
  [string]$Base = "$env:USERPROFILE\aerovia-comfy",
  [string]$LoraPath = ""
)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"   # faster Invoke-WebRequest
function Say($m){ Write-Host "==> $m" -ForegroundColor Cyan }

New-Item -ItemType Directory -Force -Path $Base | Out-Null
$portable = Join-Path $Base "ComfyUI_windows_portable"
$comfy    = Join-Path $portable "ComfyUI"
$py       = Join-Path $portable "python_embeded\python.exe"

# 1. ComfyUI portable ---------------------------------------------------------
if (-not (Test-Path $comfy)) {
  Say "Downloading ComfyUI portable (~1.5 GB) + 7zr extractor"
  $z7 = Join-Path $Base "7zr.exe"
  if (-not (Test-Path $z7)) { Invoke-WebRequest "https://www.7-zip.org/a/7zr.exe" -OutFile $z7 }
  $arc = Join-Path $Base "comfy_portable.7z"
  Invoke-WebRequest "https://github.com/comfyanonymous/ComfyUI/releases/latest/download/ComfyUI_windows_portable_nvidia.7z" -OutFile $arc
  Say "Extracting (this takes a minute)"
  & $z7 x $arc "-o$Base" -y | Out-Null
  Remove-Item $arc
} else { Say "ComfyUI portable already present" }
if (-not (Test-Path $py)) { throw "python_embeded not found at $py — extraction layout changed; extract the .7z manually under $Base" }

# 2. LayerDiffuse custom node + patch ----------------------------------------
$node = Join-Path $comfy "custom_nodes\ComfyUI-layerdiffuse"
if (-not (Test-Path $node)) {
  Say "Cloning ComfyUI-layerdiffuse"
  git clone https://github.com/huchenlei/ComfyUI-layerdiffuse $node
}
Say "Installing node requirements"
& $py -m pip install -q -r (Join-Path $node "requirements.txt")
Say "Patching layerdiffuse for current ComfyUI"
$env:LAYERDIFFUSE_PY = Join-Path $node "layered_diffusion.py"
& $py (Join-Path $PSScriptRoot "scripts\patch_layerdiffuse.py")

# 3. Models: SDXL base + our LoRA --------------------------------------------
$ckptDir = Join-Path $comfy "models\checkpoints"
$loraDir = Join-Path $comfy "models\loras"
New-Item -ItemType Directory -Force -Path $ckptDir,$loraDir | Out-Null

$base = Join-Path $ckptDir "sd_xl_base_1.0.safetensors"
if (-not (Test-Path $base)) {
  Say "Downloading SDXL base (~6.5 GB)"
  Invoke-WebRequest "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors" -OutFile $base
} else { Say "SDXL base already present" }

if (-not $LoraPath) {
  $LoraPath = (Get-ChildItem "$env:USERPROFILE\Downloads","$env:USERPROFILE\Desktop" `
    -Filter "aerovia_cartoon_sdxl_v1.safetensors" -Recurse -ErrorAction SilentlyContinue |
    Select-Object -First 1 -Expand FullName)
}
if (-not $LoraPath -or -not (Test-Path $LoraPath)) {
  throw "LoRA not found. Copy aerovia_cartoon_sdxl_v1.safetensors to this machine and re-run with -LoraPath <file>."
}
Copy-Item $LoraPath (Join-Path $loraDir "aerovia_cartoon_sdxl_v1.safetensors") -Force
Say "LoRA in place"

# 4. Launch -------------------------------------------------------------------
Say "Starting ComfyUI on http://127.0.0.1:8188  (first run downloads LayerDiffuse weights)"
Set-Location $comfy
& $py -s "$comfy\main.py" --listen 127.0.0.1 --port 8188 --lowvram
