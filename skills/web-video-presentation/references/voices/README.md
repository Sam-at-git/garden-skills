# Voice samples for VoxCPM

VoxCPM2 does **voice cloning** — it copies a voice from a short reference
audio clip. This folder holds reference clips the skill can clone from.

## `sam_voice_ref.wav` — the default voice

The skill's default voice-cloning reference. Whatever voice is in this file is
what `npm run synthesize-audio` narrates in by default (the provider auto-uses
it; scaffold copies it into each project). Mono, 48 kHz, ~15 s, silence-trimmed.

> The filename still says `sam` for backward compatibility with the code/docs
> that reference it — the **content** is whatever you last converted into it.
> Swap it any time with the recipe below (overwrite this file, or add a new one
> and point `VOXCPM_VOICE` at it).

How it was made (reproduce for any voice):

```bash
# 1. Start from any clip of the target voice (m4a/mp3/wav …). Trim to a
#    clean 10–30s of steady speech; avoid long pauses / music / noise.
# 2. Convert to mono 48kHz wav, trimming leading/trailing silence:
ffmpeg -y -i "<your_clip>.m4a" -ac 1 -ar 48000 \
  -af "silenceremove=start_periods=1:start_silence=0.05:start_threshold=-45dB,\
areverse,silenceremove=start_periods=1:start_silence=0.05:start_threshold=-45dB,\
areverse" \
  -c:a pcm_s16le sam_voice_ref.wav     # overwrite the default, or use <name>_voice_ref.wav
```

## The clone mental model (important)

VoxCPM2 does **not** produce a standalone "voice model" file that you save
and reuse. It extracts the timbre **live, on every synthesis call**, from the
reference clip you point it at. So "I cloned a voice" really means:

> You have one clean reference wav, and every TTS call points `VOXCPM_VOICE`
> (or `--voice=`) at it.

The VoxCPM provider's persistent server loads the 4.6 G model once and
reuses the reference across all narration segments — efficient, and the
timbre stays consistent.

## Use it

Point the provider at a sample (absolute path). In `scripts/voxcpm/voxcpm.env`:

```bash
export VOXCPM_VOICE="/abs/path/to/this/skill/references/voices/sam_voice_ref.wav"
```

or per-run:

```bash
PRESENTATION_TTS=voxcpm \
  npm run synthesize-audio -- --voice=/abs/path/to/sam_voice_ref.wav
```

Then `npm run synthesize-audio` narrates the whole deck in that voice.

## Add your own voice

1. Record 10–30 s of clean, single-speaker speech.
2. Convert as shown above → `<name>_voice_ref.wav` in this folder.
3. Point `VOXCPM_VOICE` at it. Done — no training step.

Tips for a good clone:
- One speaker, no background music, minimal noise.
- Steady pacing; trim silence at both ends (the ffmpeg filter above does it).
- 48 kHz mono is ideal, but VoxCPM accepts 16 kHz+ and resamples internally.
- Longer ≠ always better — a focused 15 s clip often clones more cleanly
  than a 60 s clip with varying emotion.
