#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────
# voxcpm-setup.sh — one-time bootstrap so the VoxCPM provider "just works".
#
# Run once (from the project root) before the first synthesis:
#   bash scripts/voxcpm/voxcpm-setup.sh
#
# It is idempotent — safe to re-run. In order, it:
#   1. Finds a python that already has voxcpm (your $VOXCPM_PYTHON, python3,
#      then conda envs under ~/miniconda3 / ~/anaconda3 / ~/.conda / ~/miniforge3).
#      → If none: offers to create <project>/.venv-voxcpm + pip install.
#   2. Finds the model in conventional locations:
#        ./pretrained_models/VoxCPM2, ~/.cache/huggingface/hub/VoxCPM2,
#        ~/pretrained_models/VoxCPM2
#      → If none: CONFIRMS, then downloads OpenBMB/VoxCPM2 (4.6G) via
#        huggingface_hub into ./pretrained_models/VoxCPM2.
#   3. Defaults the voice to the bundled sample (scripts/voxcpm/voices/).
#   4. Writes scripts/voxcpm/voxcpm.env with everything resolved, so the
#      provider loads zero-config from then on.
#
# Flags:
#   --yes / -y   auto-confirm the install + download prompts (non-interactive /
#                agent use). Without it, prompts wait for [y/N].
#   -h / --help  print this header.
#
# Exit codes: 0 = ready to synthesize; 1 = blocked (declined / failed) with
# guidance printed.
# ────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"      # …/scripts/voxcpm
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"                 # the project root
ENV_FILE="$SCRIPT_DIR/voxcpm.env"
BUNDLED_VOICE="$SCRIPT_DIR/voices/sam_voice_ref.wav"
SKILL_VOICE="$SCRIPT_DIR/../../../references/voices/sam_voice_ref.wav"  # when run from the skill repo

AUTO_YES=false
for arg in "$@"; do
  case "$arg" in
    --yes|-y) AUTO_YES=true ;;
    -h|--help) sed -n '2,34p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "✗ unknown arg: $arg" >&2; exit 1 ;;
  esac
done

confirm() {  # confirm <prompt> → 0 = yes, 1 = no
  if $AUTO_YES; then echo "  (auto-yes) $1" >&2; return 0; fi
  local reply
  read -p "$1 [y/N] " reply >&2 || reply=n
  case "$reply" in y|Y|yes|YES|Yes) return 0 ;; *) return 1 ;; esac
}

# Honour an existing voxcpm.env on re-runs (preserve user overrides).
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$ENV_FILE"
fi

# ── 1. Resolve a python that has voxcpm ─────────────────────────────────
find_python_with_voxcpm() {
  local cands=()
  [[ -n "${VOXCPM_PYTHON:-}" ]] && cands+=("$VOXCPM_PYTHON")
  cands+=("python3" "python")
  local base p
  for base in "$HOME/miniconda3" "$HOME/anaconda3" "$HOME/.conda" "$HOME/miniforge3"; do
    [[ -d "$base/envs" ]] || continue
    for p in "$base"/envs/*/bin/python; do
      [[ -x "$p" ]] && cands+=("$p")
    done
  done
  local c
  for c in "${cands[@]}"; do
    if "$c" -c "import voxcpm, soundfile, numpy" >/dev/null 2>&1; then
      printf '%s\n' "$c"; return 0
    fi
  done
  return 1
}

echo "▸ finding a python with voxcpm…" >&2
VOXCPM_PYTHON="$(find_python_with_voxcpm || true)"
if [[ -z "$VOXCPM_PYTHON" ]]; then
  VENV="$PROJECT_ROOT/.venv-voxcpm"
  if confirm "  No python has voxcpm. Create $VENV and pip install voxcpm soundfile (pulls torch — multi-GB)?"; then
    python3 -m venv "$VENV"
    "$VENV/bin/python" -m pip install --upgrade pip >/dev/null
    "$VENV/bin/python" -m pip install voxcpm soundfile
    VOXCPM_PYTHON="$VENV/bin/python"
  else
    echo "✗ declined install. Either:" >&2
    echo "    pip install voxcpm soundfile     (into a python you choose)" >&2
    echo "    export VOXCPM_PYTHON=/that/python   then re-run this script" >&2
    exit 1
  fi
fi
echo "  python = $VOXCPM_PYTHON" >&2

# ── 2. Resolve the model ────────────────────────────────────────────────
find_model() {
  local c
  for c in "$PROJECT_ROOT/pretrained_models/VoxCPM2" \
           "$HOME/.cache/huggingface/hub/VoxCPM2" \
           "$HOME/pretrained_models/VoxCPM2"; do
    [[ -f "$c/model.safetensors" ]] && { printf '%s\n' "$c"; return 0; }
  done
  if [[ -n "${VOXCPM_MODEL_PATH:-}" && -f "$VOXCPM_MODEL_PATH/model.safetensors" ]]; then
    printf '%s\n' "$VOXCPM_MODEL_PATH"; return 0
  fi
  return 1
}

echo "▸ finding the model…" >&2
VOXCPM_MODEL_PATH="$(find_model || true)"
if [[ -z "$VOXCPM_MODEL_PATH" ]]; then
  TARGET="$PROJECT_ROOT/pretrained_models/VoxCPM2"
  echo "  not found in conventional locations." >&2
  if confirm "  Download OpenBMB/VoxCPM2 (4.6G) into $TARGET?"; then
    mkdir -p "$TARGET"
    "$VOXCPM_PYTHON" -c \
      "from huggingface_hub import snapshot_download; snapshot_download('OpenBMB/VoxCPM2', local_dir='$TARGET')"
    VOXCPM_MODEL_PATH="$TARGET"
  else
    echo "✗ declined download. Download manually, then re-run:" >&2
    echo "    $VOXCPM_PYTHON -c \"from huggingface_hub import snapshot_download; snapshot_download('OpenBMB/VoxCPM2', local_dir='$TARGET')\"" >&2
    exit 1
  fi
fi
echo "  model  = $VOXCPM_MODEL_PATH" >&2

# ── 3. Resolve the voice (default to the bundled sample) ────────────────
if [[ -z "${VOXCPM_VOICE:-}" || ! -f "${VOXCPM_VOICE:-}" ]]; then
  if [[ -f "$BUNDLED_VOICE" ]]; then
    VOXCPM_VOICE="$BUNDLED_VOICE"
  elif [[ -f "$SKILL_VOICE" ]]; then
    VOXCPM_VOICE="$SKILL_VOICE"
  fi
fi

# ── 4. Write voxcpm.env (the file the provider sources) ─────────────────
cat > "$ENV_FILE" <<EOF
# Auto-generated by voxcpm-setup.sh on this machine. Edit freely.
# (This is the file voxcpm.sh sources — not voxcpm.env.example.)
export VOXCPM_MODEL_PATH="$VOXCPM_MODEL_PATH"
export VOXCPM_PYTHON="$VOXCPM_PYTHON"
EOF
if [[ -n "${VOXCPM_VOICE:-}" ]]; then
  echo "export VOXCPM_VOICE=\"$VOXCPM_VOICE\"" >> "$ENV_FILE"
fi
cat >> "$ENV_FILE" <<'EOF'
# export VOXCPM_DEVICE="auto"     # auto|cpu|mps|cuda
# export VOXCPM_PORT="8765"
# export VOXCPM_CFG="2.0"
# export VOXCPM_STEPS="10"
# export VOXCPM_VOICE_DESIGN="A young woman, gentle and sweet voice"  # alt: design instead of clone
EOF
echo "  config = $ENV_FILE" >&2

# ── 5. Summary ──────────────────────────────────────────────────────────
echo >&2
echo "✓ VoxCPM ready." >&2
echo "  python = $VOXCPM_PYTHON" >&2
echo "  model  = $VOXCPM_MODEL_PATH" >&2
echo "  voice  = ${VOXCPM_VOICE:-(none — set VOXCPM_VOICE or pass --voice=)}" >&2
echo "  → now run:  npm run synthesize-audio        (voxcpm is the default provider)" >&2
