# ────────────────────────────────────────────────────────────────────
# VoxCPM provider — local voice-cloning TTS via a persistent server.
#
# Repo:    https://github.com/OpenBMB/VoxCPM   (pip install voxcpm)
# Model:   OpenBMB/VoxCPM2 — 2B, 48kHz, 30 langs, voice cloning + design.
#
# Unlike the cloud providers (one cheap API call per segment), VoxCPM
# takes ~9s to load its model. So tts_check starts a long-lived local
# HTTP server (scripts/voxcpm/voxcpm_server.py) that loads the model
# ONCE; tts_synthesize then forwards each segment to it. The server is
# reused across runs (health-checked, not restarted).
#
# Env (or set in scripts/voxcpm/voxcpm.env, sourced if present):
#   VOXCPM_MODEL_PATH     required  path to the local VoxCPM2 snapshot
#   VOXCPM_VOICE          ref wav for cloning (e.g. bundled voices/sam_voice_ref.wav)
#   VOXCPM_VOICE_DESIGN   if no ref: voice-design description string instead
#   VOXCPM_PYTHON         default python3  (point at a venv/conda with voxcpm+torch)
#   VOXCPM_DEVICE         default auto     (auto|cpu|mps|cuda)
#   VOXCPM_PORT           default 8765
#   VOXCPM_CFG            default 2.0      CFG guidance scale
#   VOXCPM_STEPS          default 10       inference timesteps
#
# The 4.6G model is NOT bundled — it lives wherever you downloaded it;
# point VOXCPM_MODEL_PATH at it. Voice samples live in the skill's
# references/voices/ (see references/voices/README.md).
# ────────────────────────────────────────────────────────────────────

# ── Source-time config (runs when the runner sources this file) ──────────
# Resolve our own dir so the server script and optional env file are found
# regardless of where the scaffolded project lives. (cd is in a subshell —
# does not affect the runner's working directory.)
PROVIDER_FILE="${BASH_SOURCE[0]:-}"
SCRIPT_DIR="$(cd "$(dirname "$PROVIDER_FILE")" && pwd)"
VOXCPM_DIR="$SCRIPT_DIR/../voxcpm"
SERVER="$VOXCPM_DIR/voxcpm_server.py"
ENV_FILE="$VOXCPM_DIR/voxcpm.env"
HEALTH_MARKER="voxcpm-ok"

# Optional user overrides — sourced if present. You usually DON'T need this:
# model / voice / python are auto-resolved just below. Create voxcpm.env (copy
# of voxcpm.env.example) only if you want to override the auto-detected values.
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$ENV_FILE"
fi

VOXCPM_PYTHON="${VOXCPM_PYTHON:-python3}"
VOXCPM_PORT="${VOXCPM_PORT:-8765}"
VOXCPM_START_TIMEOUT="${VOXCPM_START_TIMEOUT:-120}"
LOG="${VOXCPM_LOG:-/tmp/voxcpm_server.log}"
BASE_URL="http://127.0.0.1:${VOXCPM_PORT}"

# ── Auto-resolve MODEL (so you rarely hand-configure it) ─────────────────
# Precedence: an already-set path that actually exists wins; otherwise scan
# conventional locations for one containing model.safetensors. A stale path
# (set but missing) falls through to detection.
_voxcpm_resolve_model() {
  if [[ -n "${VOXCPM_MODEL_PATH:-}" && -f "$VOXCPM_MODEL_PATH/model.safetensors" ]]; then
    return 0
  fi
  local candidate
  for candidate in \
      "$PWD/pretrained_models/VoxCPM2" \
      "$HOME/.cache/huggingface/hub/VoxCPM2" \
      "$HOME/pretrained_models/VoxCPM2"; do
    if [[ -f "$candidate/model.safetensors" ]]; then
      VOXCPM_MODEL_PATH="$candidate"
      return 0
    fi
  done
  return 1
}
_voxcpm_resolve_model || true   # not fatal at source time; tts_check reports clearly

# ── Auto-resolve VOICE (default to the bundled sample) ───────────────────
_voxcpm_resolve_voice() {
  if [[ -n "${VOXCPM_VOICE:-}" && -f "$VOXCPM_VOICE" ]]; then
    return 0
  fi
  local candidate
  for candidate in \
      "$VOXCPM_DIR/voices/sam_voice_ref.wav" \
      "$SCRIPT_DIR/../../../references/voices/sam_voice_ref.wav"; do
    if [[ -f "$candidate" ]]; then
      VOXCPM_VOICE="$candidate"
      return 0
    fi
  done
  return 1
}
_voxcpm_resolve_voice || true

# Export so the spawned server child process (nohup "$VOXCPM_PYTHON" "$SERVER" &)
# inherits the resolved values. Without this, auto-detected paths don't reach it.
export VOXCPM_MODEL_PATH VOXCPM_VOICE VOXCPM_PORT VOXCPM_DEVICE VOXCPM_CFG VOXCPM_STEPS VOXCPM_VOICE_DESIGN

# ── Helpers (all `local`, no global-state side effects) ──────────────────
_voxcpm_health() {
  # Prints the /health body ("voxcpm-ok") if the server is up, empty otherwise.
  curl -fsS -m 2 "$BASE_URL/health" 2>/dev/null || true
}

_voxcpm_ensure_up() {
  if [[ "$(_voxcpm_health)" == "$HEALTH_MARKER" ]]; then
    return 0
  fi
  if [[ ! -f "$SERVER" ]]; then
    echo "✗ server script not found: $SERVER" >&2
    return 1
  fi
  echo "▸ starting VoxCPM server (loading model, ~10s) …" >&2
  nohup "$VOXCPM_PYTHON" "$SERVER" >>"$LOG" 2>&1 &
  local i
  for ((i = 0; i < VOXCPM_START_TIMEOUT; i++)); do
    sleep 1
    if [[ "$(_voxcpm_health)" == "$HEALTH_MARKER" ]]; then
      return 0
    fi
  done
  echo "✗ VoxCPM server did not come up within ${VOXCPM_START_TIMEOUT}s." >&2
  echo "  Log: $LOG   (tail -f $LOG)" >&2
  return 1
}

tts_check() {
  command -v curl          >/dev/null || { echo "✗ curl not found" >&2; return 1; }
  command -v ffmpeg        >/dev/null || { echo "✗ ffmpeg not found (brew install ffmpeg)" >&2; return 1; }
  command -v jq            >/dev/null || { echo "✗ jq not found (brew install jq)" >&2; return 1; }
  command -v "$VOXCPM_PYTHON" >/dev/null || { echo "✗ python not found: $VOXCPM_PYTHON (set VOXCPM_PYTHON)" >&2; return 1; }

  if ! "$VOXCPM_PYTHON" -c "import voxcpm" >/dev/null 2>&1; then
    echo "✗ voxcpm not importable by $VOXCPM_PYTHON." >&2
    return 1
  fi
  if [[ -z "${VOXCPM_MODEL_PATH:-}" ]]; then
    echo "✗ Couldn't auto-find the VoxCPM2 model." >&2
    echo "  Put it at ./pretrained_models/VoxCPM2 or ~/.cache/huggingface/hub/VoxCPM2," >&2
    echo "  or set VOXCPM_MODEL_PATH to your VoxCPM2 dir (the one with model.safetensors)." >&2
    return 1
  fi
  if [[ ! -d "$VOXCPM_MODEL_PATH" ]]; then
    echo "✗ VOXCPM_MODEL_PATH is not a directory: $VOXCPM_MODEL_PATH" >&2
    return 1
  fi
  # Voice is *not* fatal here — it can be supplied per-call via --voice.
  if [[ -z "${VOXCPM_VOICE:-}" && -z "${VOXCPM_VOICE_DESIGN:-}" ]]; then
    echo "⚠ VOXCPM_VOICE not set — set it (reference wav for cloning) or" >&2
    echo "  VOXCPM_VOICE_DESIGN (description), or pass --voice=<wav>." >&2
  fi
  _voxcpm_ensure_up
}

tts_install_help() {
  cat <<EOF >&2
To use the VoxCPM provider (local voice cloning):

  1. Install (Python ≥ 3.10, PyTorch ≥ 2.5):
       pip install voxcpm soundfile
     Or point VOXCPM_PYTHON at a venv/conda env that already has it, e.g.:
       export VOXCPM_PYTHON=/path/to/conda/envs/cc/bin/python

  2. Download the model once (4.6G) and point VOXCPM_MODEL_PATH at it:
       snapshot_download("OpenBMB/VoxCPM2", local_dir="./pretrained_models/VoxCPM2")
       export VOXCPM_MODEL_PATH=/abs/path/to/pretrained_models/VoxCPM2

  3. Point VOXCPM_VOICE at a reference wav (the skill ships Sam's clone at
     references/voices/sam_voice_ref.wav). Add your own — see that folder's
     README.

  Tip: put all of the above in scripts/voxcpm/voxcpm.env (copy voxcpm.env.example)
  and this provider sources it automatically.

Or pick another provider:  PRESENTATION_TTS=<name> npm run synthesize-audio
See scripts/tts-providers/README.md.
EOF
}

tts_synthesize() {
  local text="$1"
  local out="$2"
  local voice="${3:-}"

  # Effective reference voice: per-call arg > env. (macOS bash 3.2-safe:
  # avoid empty-array expansion; plain parameter defaults only.)
  local ref="${voice:-${VOXCPM_VOICE:-}}"

  # Lazy liveness re-check — restart once if the server died mid-run.
  if [[ "$(_voxcpm_health)" != "$HEALTH_MARKER" ]]; then
    _voxcpm_ensure_up || return 1
  fi

  local tmp
  tmp="$(mktemp -t voxcpm).wav"
  local code=0

  # POST raw UTF-8 text as the body; voice goes on the query string
  # (URL-encoded via jq so paths with spaces/special chars are safe).
  if [[ -n "$ref" ]]; then
    local enc
    enc="$(printf '%s' "$ref" | jq -sRr @uri)"
    curl -fsS -m 600 -o "$tmp" -X POST "${BASE_URL}/synthesize?voice=${enc}" \
      -H "Content-Type: text/plain; charset=utf-8" \
      --data-binary "$text" 2>/dev/null || code=$?
  else
    curl -fsS -m 600 -o "$tmp" -X POST "${BASE_URL}/synthesize" \
      -H "Content-Type: text/plain; charset=utf-8" \
      --data-binary "$text" 2>/dev/null || code=$?
  fi

  if [[ $code -ne 0 ]]; then
    rm -f "$tmp"
    echo "✗ voxcpm server request failed (code $code). Log: $LOG" >&2
    return $code
  fi

  # VoxCPM outputs 48kHz wav → convert to mp3 for the browser <audio> tag.
  ffmpeg -y -i "$tmp" -codec:a libmp3lame -qscale:a 2 "$out" >/dev/null 2>&1 || code=$?
  rm -f "$tmp"
  return $code
}
