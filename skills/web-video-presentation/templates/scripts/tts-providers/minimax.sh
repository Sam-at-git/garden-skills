# ────────────────────────────────────────────────────────────────────
# MiniMax provider — uses the official mmx-cli.
#
# Docs:  https://platform.minimaxi.com/docs/token-plan/minimax-cli
# Repo:  https://github.com/MiniMax-AI/cli
#
# Strengths: Chinese narration quality is consistently good; lots of
# voice options; one-line CLI call.
#
# Env:
#   PRESENTATION_TTS_VOICE  voice id — `mmx speech voices` lists them.
#                           Chinese ids look like
#                           "Chinese (Mandarin)_Radio_Host".
#   PRESENTATION_TTS_LANG   language boost, e.g. Chinese. MiniMax picks
#                           pronunciation and prosody noticeably better when
#                           told which language the text is in — worth setting
#                           for any non-English narration.
# ────────────────────────────────────────────────────────────────────

tts_check() {
  if ! command -v mmx >/dev/null; then
    echo "✗ mmx CLI not found in PATH." >&2
    return 1
  fi
  if ! mmx auth status >/dev/null 2>&1; then
    echo "✗ mmx is not authenticated." >&2
    return 1
  fi
}

tts_install_help() {
  cat <<'EOF' >&2
To use the MiniMax provider:

  Install:  npm install -g mmx-cli
  Login:    mmx auth login --api-key sk-xxxxx
            (get a key at https://platform.minimaxi.com)

Or pick another provider:  PRESENTATION_TTS=<name> npm run synthesize-audio
See tts-providers/README.md for the list and how to add your own.
EOF
}

tts_synthesize() {
  local text="$1"
  local out="$2"
  local voice="${3:-}"

  local lang="${PRESENTATION_TTS_LANG:-}"

  # Build the argument list without an empty-array expansion — runner uses
  # `set -u`, and macOS-default bash 3.2 fires "unbound variable" on "${arr[@]}"
  # when arr is empty. Append conditionally instead.
  local -a args=(speech synthesize --text "$text" --out "$out")
  [[ -n "$voice" ]] && args+=(--voice "$voice")
  [[ -n "$lang" ]] && args+=(--language "$lang")

  # Keep stderr: when a segment fails, the last line of mmx's output is the
  # only clue (401 / quota / network). The runner tees stderr into the log.
  local err
  if err=$(mmx "${args[@]}" 2>&1 >/dev/null); then
    return 0
  fi
  # mmx prints a pretty JSON error; pull the "message" field, else the last line.
  local msg
  msg=$(printf '%s\n' "$err" | grep -m1 -oE '"message": *"[^"]*"' | cut -d'"' -f4)
  [[ -n "$msg" ]] || msg=$(printf '%s\n' "$err" | grep -v '^\s*$' | tail -1)
  echo "    mmx: ${msg:0:200}" >&2
  return 1
}
