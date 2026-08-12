#!/usr/bin/env node
/**
 * build-video.mjs — turn the raw recording + measured cues into a finished
 * 1920×1080 mp4 with the narration laid back on.
 *
 * Playwright's video carries no audio track, so the narration is re-assembled
 * here and aligned to render/cues.json — the wall-clock step boundaries
 * measured while recording. Each segment is placed at its own cue and the
 * gaps are filled with silence, so the voice lands on the same frame it did
 * in the browser no matter how per-step loading overhead drifted.
 *
 * It also trims both ends: the loading screen + start gate at the head, and
 * the final frame the recorder sat on while making sure the deck had really
 * finished at the tail. The head cut is found by looking at the frames — the
 * gate is a near-black overlay over a bright deck, so the luma jump when it
 * disappears IS the moment playback began. That beats wall-clock arithmetic
 * (0.5s better in one real run), and half a second of lip-sync is visible.
 *
 * Usage:  npm run video:mux
 * Output: render/<project>.mp4  +  render/chapters.txt
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "render");
const RAW = path.join(OUT_DIR, "raw.webm");
const CUES = path.join(OUT_DIR, "cues.json");
const AUDIO_DIR = path.join(ROOT, "public", "audio");
const SEGMENTS = JSON.parse(fs.readFileSync(path.join(ROOT, "audio-segments.json"), "utf8"));

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split("=").slice(1).join("=") : d;
};

const NAME = arg("name", path.basename(ROOT));
const CRF = arg("crf", "20");
/** Cut a silent video — for decks that skipped audio synthesis entirely. */
const NO_AUDIO = process.argv.includes("--no-audio");
const OUT = path.join(OUT_DIR, `${NAME}.mp4`);
/** Seconds of held final frame to keep after the last narration ends. */
const TAIL_PAD_S = 1.5;

for (const f of [RAW, CUES]) {
  if (!fs.existsSync(f)) {
    console.error(`✗ ${path.relative(ROOT, f)} 不存在 —— 先跑 \`npm run video:record\`。`);
    process.exit(2);
  }
}

const ff = (args) =>
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    encoding: "utf8",
    maxBuffer: 1 << 26,
  });

const dur = (f) =>
  parseFloat(
    execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f],
      { encoding: "utf8" },
    ).trim(),
  );

const cueFile = JSON.parse(fs.readFileSync(CUES, "utf8"));
const cues = Array.isArray(cueFile) ? cueFile : cueFile.cues;
const leadInHintMs = Array.isArray(cueFile) ? 0 : (cueFile.leadInHintMs ?? 0);
const crop = (!Array.isArray(cueFile) && cueFile.crop) || { x: 80, y: 100, w: 1920, h: 1080 };

if (cues.length !== SEGMENTS.length) {
  console.log(
    `! cues ${cues.length} 条 / segments ${SEGMENTS.length} 条 —— 按录到的部分出片（冒烟测试模式）。`,
  );
}

// Fail with a sentence, not a stack trace: ffmpeg's "No such file" three
// levels down doesn't tell anyone what to do about it.
if (!NO_AUDIO) {
  const missing = [];
  for (let i = 0; i < cues.length; i++) {
    const f = path.join(AUDIO_DIR, SEGMENTS[i].audio);
    if (!fs.existsSync(f)) missing.push(SEGMENTS[i].audio);
  }
  if (missing.length) {
    console.error(
      `✗ 缺 ${missing.length} 段旁白音频：${missing.slice(0, 5).join(", ")}` +
        (missing.length > 5 ? " …" : "") +
        "\n  先跑 `npm run synthesize-audio`；" +
        "\n  如果这条片子本来就不配音，用 `npm run video:mux -- --no-audio` 出无声版。",
    );
    process.exit(1);
  }
}

const videoDur = dur(RAW);

/* ── 0. find the frame where playback actually starts ────────────────── */
function detectLeadIn() {
  let out;
  try {
    out = execFileSync(
      "ffmpeg",
      [
        "-hide_banner", "-nostats",
        "-i", RAW,
        "-t", "40",
        // `file=-` sends the metadata to stdout; without it the print lands
        // in ffmpeg's stderr log and is easy to lose.
        "-vf", "signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-",
        "-f", "null", "-",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26 },
    );
  } catch (e) {
    out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
  const frames = [];
  const re = /pts_time:([\d.]+)[\s\S]*?lavfi\.signalstats\.YAVG=([\d.]+)/g;
  let m;
  while ((m = re.exec(out)) !== null) frames.push({ t: parseFloat(m[1]), y: parseFloat(m[2]) });
  if (frames.length < 5) return null;
  // Timeline is: blank/loading (bright) → gate (dark) → deck (bright). Find
  // the dark run first; scanning for "first bright frame" from t=0 would just
  // match the loading screen.
  const darkStart = frames.findIndex((f) => f.y < 120);
  if (darkStart === -1) return null;
  let i = darkStart;
  while (i < frames.length && frames[i].y < 160) i++;
  if (i >= frames.length) return null;
  return frames[i].t * 1000;
}

const detected = detectLeadIn();
const leadInMs = detected ?? leadInHintMs;
console.log(
  detected != null
    ? `▸ 起播帧检测到 ${(leadInMs / 1000).toFixed(2)}s（wall-clock 估计 ${(leadInHintMs / 1000).toFixed(2)}s）`
    : `! 起播帧没检出，退回 wall-clock 估计 ${(leadInMs / 1000).toFixed(2)}s`,
);

/* ── 1. narration track aligned to the measured cues ─────────────────── */
const silenceDir = path.join(OUT_DIR, "sil");
fs.mkdirSync(silenceDir, { recursive: true });

const mkSilence = (seconds) => {
  const ms = Math.round(seconds * 1000);
  const f = path.join(silenceDir, `s${ms}.mp3`);
  if (!fs.existsSync(f)) {
    ff([
      "-f", "lavfi",
      "-i", "anullsrc=r=32000:cl=mono",
      "-t", (ms / 1000).toFixed(3),
      "-c:a", "libmp3lame",
      "-b:a", "128k",
      f,
    ]);
  }
  return f;
};

const parts = [];
let clock = 0; // seconds of audio written so far
let clamped = 0;

for (let i = 0; !NO_AUDIO && i < cues.length; i++) {
  const file = path.join(AUDIO_DIR, SEGMENTS[i].audio);
  // Cue times are relative to playback start; the video is trimmed to that
  // same moment below, so both tracks share this zero.
  let gap = cues[i].t / 1000 - clock;
  if (gap < 0) {
    // The deck advanced before the previous mp3 finished — shouldn't happen,
    // Auto mode waits on `ended`. Drop the overlap rather than let the whole
    // track slide late.
    clamped++;
    gap = 0;
  }
  if (gap > 0.005) {
    parts.push(mkSilence(gap));
    clock += Math.round(gap * 1000) / 1000;
  }
  parts.push(file);
  clock += dur(file);
}

const trimStart = leadInMs / 1000;
// With no narration there is no audio clock to trim against, so fall back to
// the last step boundary — otherwise the silent cut keeps the ~40s of held
// final frame the recorder sat on while confirming the deck had finished.
const lastCueEnd = cues.length ? cues[cues.length - 1].t / 1000 : 0;
const contentEnd = NO_AUDIO ? lastCueEnd + 3 : clock + TAIL_PAD_S;
const trimDur = Math.min(contentEnd, Math.max(0, videoDur - trimStart));
if (!NO_AUDIO && trimDur > clock + 0.05) parts.push(mkSilence(trimDur - clock));

const listFile = path.join(OUT_DIR, "align.txt");
let aligned = null;
if (!NO_AUDIO) {
  fs.writeFileSync(
    listFile,
    parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n") + "\n",
  );
  aligned = path.join(OUT_DIR, "narration-aligned.mp3");
  ff(["-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", aligned]);
}

/* ── 2. crop + encode + mux ──────────────────────────────────────────── */
const needsScale = crop.w !== 1920 || crop.h !== 1080;
const vf =
  `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}` +
  (needsScale ? ",scale=1920:1080:flags=lanczos" : "") +
  ",fps=30";

console.log(
  `▸ 编码中（裁掉片头 ${trimStart.toFixed(2)}s / 片尾 ${(videoDur - trimStart - trimDur).toFixed(1)}s，` +
    `成片 ${Math.round(trimDur)}s，1920×1080${needsScale ? "，含缩放" : ""}）…`,
);
ff([
  "-ss", trimStart.toFixed(3),
  "-t", trimDur.toFixed(3),
  "-i", RAW,
  ...(aligned ? ["-i", aligned] : []),
  "-filter:v", vf,
  "-c:v", "libx264",
  "-preset", "medium",
  "-crf", CRF,
  "-pix_fmt", "yuv420p",
  ...(aligned ? ["-c:a", "aac", "-b:a", "160k", "-shortest"] : ["-an"]),
  "-movflags", "+faststart",
  OUT,
]);

/* ── 3. chapter markers from the cues ────────────────────────────────── */
const marks = [];
let lastChapter = -1;
for (let i = 0; i < cues.length; i++) {
  if (cues[i].chapter !== lastChapter) {
    lastChapter = cues[i].chapter;
    const s = Math.floor(cues[i].t / 1000);
    marks.push(
      `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}  ${SEGMENTS[i].chapter}`,
    );
  }
}
fs.writeFileSync(path.join(OUT_DIR, "chapters.txt"), marks.join("\n") + "\n");

// The per-gap silence clips are pure scratch; the aligned track and raw.webm
// are worth keeping so a re-mux doesn't need a re-record.
fs.rmSync(silenceDir, { recursive: true, force: true });
fs.rmSync(listFile, { force: true });

const outDur = dur(OUT);
const m = Math.floor(outDur / 60);
console.log(`\n✓ ${path.relative(ROOT, OUT)}  ${m}分${Math.round(outDur - m * 60)}秒  1920×1080`);
console.log(`✓ render/chapters.txt  ${marks.length} 个章节标记`);
if (clamped) console.log(`! ${clamped} 段音频与下一步重叠，已截断对齐`);
