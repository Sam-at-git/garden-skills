#!/usr/bin/env node
/**
 * build-audio-track.mjs — stitch the per-step mp3s into one continuous
 * narration track, paced the way Auto mode paces the deck.
 *
 * Why it lines up: in Auto mode (hooks/useAudioPlayer.ts) each step lasts
 * exactly `audio duration + trailMs`, then the stepper advances. So the track
 * is every segment in order with `trailMs` of silence spliced between them.
 *
 * Use it when you want the voice-over as a standalone file — a podcast cut, a
 * track to drop into a video editor, or a length check before recording.
 *
 * ⚠️ For muxing against a SCREEN RECORDING, prefer scripts/build-video.mjs.
 * It aligns to the step boundaries actually measured during the recording;
 * this file assumes zero per-step loading overhead, which drifts over a long
 * deck (~16s across 107 steps in one real run).
 *
 * Usage:
 *   npm run audio:track                 # → render/narration.mp3
 *   npm run audio:track -- --trail=200  # match a different trailMs
 *
 * Needs ffmpeg. All segments must share codec params (they do — one provider,
 * one run), so the concat demuxer can stream-copy.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const AUDIO_DIR = path.join(ROOT, "public", "audio");
const SEGMENTS = path.join(ROOT, "audio-segments.json");
const OUT_DIR = path.join(ROOT, "render");
const OUT = path.join(OUT_DIR, "narration.mp3");

const trailArg = process.argv.find((a) => a.startsWith("--trail="));
const TRAIL_MS = trailArg ? parseInt(trailArg.split("=")[1], 10) : 200;

function ff(args) {
  return execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    encoding: "utf8",
  });
}

function duration(file) {
  return parseFloat(
    execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
      { encoding: "utf8" },
    ).trim(),
  );
}

if (!fs.existsSync(SEGMENTS)) {
  console.error("✗ audio-segments.json 不存在 —— 先跑 `npm run extract-narrations`。");
  process.exit(2);
}
const segments = JSON.parse(fs.readFileSync(SEGMENTS, "utf8"));

fs.mkdirSync(OUT_DIR, { recursive: true });

// One silence clip, encoded to match the narration segments.
const silence = path.join(OUT_DIR, `silence-${TRAIL_MS}ms.mp3`);
ff([
  "-f", "lavfi",
  "-i", "anullsrc=r=32000:cl=mono",
  "-t", String(TRAIL_MS / 1000),
  "-c:a", "libmp3lame",
  "-b:a", "128k",
  silence,
]);

const lines = [];
const cues = [];
let clock = 0;
let missing = 0;

for (const seg of segments) {
  const file = path.join(AUDIO_DIR, seg.audio);
  if (!fs.existsSync(file)) {
    console.error(`✗ 缺 ${seg.audio}`);
    missing++;
    continue;
  }
  cues.push({ t: clock, chapter: seg.chapter });
  clock += duration(file) + TRAIL_MS / 1000;
  lines.push(`file '${file.replace(/'/g, "'\\''")}'`);
  lines.push(`file '${silence.replace(/'/g, "'\\''")}'`);
}

if (missing) {
  console.error(`✗ 缺 ${missing} 段 —— 先跑 \`npm run synthesize-audio\`。`);
  process.exit(1);
}

const listFile = path.join(OUT_DIR, "concat.txt");
fs.writeFileSync(listFile, lines.join("\n") + "\n");

ff(["-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", OUT]);

// Cue sheet — paste into a video description for chapter jumps.
const cueLines = [];
let lastChapter = null;
for (const c of cues) {
  if (c.chapter !== lastChapter) {
    const m = Math.floor(c.t / 60);
    const s = Math.floor(c.t - m * 60);
    cueLines.push(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}  ${c.chapter}`);
    lastChapter = c.chapter;
  }
}
fs.writeFileSync(path.join(OUT_DIR, "chapters.txt"), cueLines.join("\n") + "\n");

const total = duration(OUT);
const m = Math.floor(total / 60);
console.log(
  `✓ ${path.relative(ROOT, OUT)}  ${m}分${Math.round(total - m * 60)}秒 · ${segments.length} 段 · trail ${TRAIL_MS}ms`,
);
console.log(`✓ ${path.relative(ROOT, path.join(OUT_DIR, "chapters.txt"))}  章节时间戳`);
