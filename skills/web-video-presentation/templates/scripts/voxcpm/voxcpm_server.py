#!/usr/bin/env python3
"""
voxcpm_server.py — persistent local VoxCPM2 TTS server.

The skill's audio runner calls `tts_synthesize` once per narration segment.
VoxCPM2 takes ~9 s to load its model, so reloading per segment is wasteful.
This server loads the model ONCE at startup and serves many cheap synthesis
requests over localhost HTTP. The `voxcpm.sh` provider adapter starts it on
demand (reusing an already-running instance) and forwards each segment here.

Endpoints
---------
  GET  /health                         -> 200 "voxcpm-ok"
  POST /synthesize?voice=<wav>         -> 200 audio/wav
            body = UTF-8 text to synthesize (raw, not JSON)
            optional: &design=<desc>   voice-design / style hint
                      (see VOXCPM_VOICE_DESIGN below)

Configuration (env)
-------------------
  VOXCPM_MODEL_PATH     required  path to the local VoxCPM2 snapshot
  VOXCPM_PYTHON         (used by the adapter, not here)
  VOXCPM_DEVICE         default "auto"  (auto|cpu|mps|cuda|cuda:N)
  VOXCPM_PORT           default 8765
  VOXCPM_VOICE          default ""     reference wav for voice cloning
  VOXCPM_CFG            default 2.0    CFG guidance scale
  VOXCPM_STEPS          default 10     inference timesteps
  VOXCPM_VOICE_DESIGN   default ""     if no reference voice, use voice-design
                                       mode with this description string

Voice selection priority (per request): `?voice=` param > VOXCPM_VOICE >
(fallback to voice-design with VOXCPM_VOICE_DESIGN) > 400 error.

Run directly for debugging:
  VOXCPM_MODEL_PATH=/path/to/VoxCPM2 \
  VOXCPM_VOICE=/path/to/sam_voice_ref.wav \
  python3 voxcpm_server.py
"""
from __future__ import annotations

import io
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

MODEL_PATH = os.environ.get("VOXCPM_MODEL_PATH", "").strip()
DEVICE = os.environ.get("VOXCPM_DEVICE", "auto").strip() or "auto"
PORT = int(os.environ.get("VOXCPM_PORT", "8765"))
DEFAULT_VOICE = os.environ.get("VOXCPM_VOICE", "").strip()
CFG = float(os.environ.get("VOXCPM_CFG", "2.0"))
STEPS = int(os.environ.get("VOXCPM_STEPS", "10"))
DEFAULT_DESIGN = os.environ.get("VOXCPM_VOICE_DESIGN", "").strip()

HEALTH_MARKER = "voxcpm-ok"

if not MODEL_PATH:
    sys.exit("voxcpm_server: VOXCPM_MODEL_PATH is required (point it at your local VoxCPM2 dir)")
if not os.path.isdir(MODEL_PATH):
    sys.exit(f"voxcpm_server: VOXCPM_MODEL_PATH not a directory: {MODEL_PATH}")


def log(msg: str) -> None:
    print(f"[voxcpm_server] {msg}", file=sys.stderr, flush=True)


# ── Load model once at startup ────────────────────────────────────────────
log(f"loading VoxCPM2 from {MODEL_PATH} (device={DEVICE}) ...")
import time as _time  # noqa: E402
_t0 = _time.perf_counter()

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402
from voxcpm import VoxCPM  # noqa: E402

# load_denoiser=False -> skip ModelScope download (not needed for plain TTS).
# optimize=False      -> skip torch.compile (slow / flaky on MPS first pass).
MODEL = VoxCPM.from_pretrained(
    MODEL_PATH,
    load_denoiser=False,
    optimize=False,
    device=DEVICE,
)
SAMPLE_RATE = MODEL.tts_model.sample_rate
GENERATE_LOCK = threading.Lock()  # serialize generate() calls just in case
log(f"model loaded in {_time.perf_counter() - _t0:.1f}s | sample_rate={SAMPLE_RATE} | listening on 127.0.0.1:{PORT}")


def synthesize(text: str, voice: str | None, design: str | None) -> bytes:
    """Synthesize one utterance -> wav bytes. Raises on any failure."""
    text = (text or "").strip()
    if not text:
        raise ValueError("empty text")

    ref = (voice or DEFAULT_VOICE or "").strip()
    style = (design or DEFAULT_DESIGN or "").strip()

    with GENERATE_LOCK:
        if ref:
            # Controllable voice cloning from a reference clip.
            full = f"({style}){text}" if style else text
            wav = MODEL.generate(
                text=full,
                reference_wav_path=ref,
                cfg_value=CFG,
                inference_timesteps=STEPS,
            )
        elif style:
            # Voice-design mode (no reference audio).
            wav = MODEL.generate(
                text=f"({style}){text}",
                cfg_value=CFG,
                inference_timesteps=STEPS,
            )
        else:
            raise ValueError(
                "no voice: set VOXCPM_VOICE (reference wav) or VOXCPM_VOICE_DESIGN, "
                "or pass ?voice=/path/to/ref.wav"
            )

    wav = np.asarray(wav).reshape(-1)
    buf = io.BytesIO()
    sf.write(buf, wav, SAMPLE_RATE, format="WAV", subtype="PCM_16")
    return buf.getvalue()


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):  # quieter, prefixed logging
        log(f"{self.address_string()} {fmt % args}")

    def _send(self, status: int, body: bytes, ctype: str = "text/plain; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._send(200, HEALTH_MARKER.encode())
        else:
            self._send(404, b"not found")

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/synthesize":
            self._send(404, b"not found")
            return

        qs = parse_qs(parsed.query)
        voice = qs.get("voice", [None])[0]
        design = qs.get("design", [None])[0]

        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length > 0 else b""
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            self._send(400, b"body must be UTF-8 text")
            return

        try:
            wav_bytes = synthesize(text, voice, design)
        except Exception as e:  # surface the reason to the adapter / log
            log(f"synthesize failed: {e!r}")
            self._send(500, f"synthesize failed: {e}".encode("utf-8"))
            return

        self._send(200, wav_bytes, "audio/wav")


def main():
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
