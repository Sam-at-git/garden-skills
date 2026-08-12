#!/usr/bin/env node
/**
 * audio-report.mjs — measure the synthesized narration track.
 *
 * Why this exists: after `synthesize-audio` you want three numbers before
 * recording — the real runtime, which steps run long (split them), and which
 * run short (the copy is too thin for a full screen). Doing that with an
 * ad-hoc shell loop is a permission prompt every time; this is a named script
 * instead (see SKILL.md「验证通道」).
 *
 * Usage:
 *   npm run audio:report
 *
 * Wants `ffprobe` on PATH. Without it, falls back to a bitrate estimate from
 * file size and says so.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const AUDIO_DIR = path.join(ROOT, "public", "audio");
const SEGMENTS = path.join(ROOT, "audio-segments.json");

/** Longer than this and the step should probably be split. */
const LONG_S = 26;
/** Shorter than this and the copy is likely too thin for a full screen. */
const SHORT_S = 3;

function haveFfprobe() {
  try {
    execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function durationOf(file, useFfprobe) {
  if (useFfprobe) {
    const out = execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
      { encoding: "utf8" },
    );
    return parseFloat(out.trim());
  }
  // 128 kbps mono mp3 → 16000 bytes per second, minus ~2KB of tags.
  return Math.max(0, (fs.statSync(file).size - 2000) / 16000);
}

function fmt(s) {
  const m = Math.floor(s / 60);
  const r = Math.round(s - m * 60);
  return `${m}分${String(r).padStart(2, "0")}秒`;
}

if (!fs.existsSync(SEGMENTS)) {
  console.error(`✗ ${SEGMENTS} 不存在 —— 先跑 \`npm run extract-narrations\`。`);
  process.exit(2);
}

const segments = JSON.parse(fs.readFileSync(SEGMENTS, "utf8"));
const list = Array.isArray(segments) ? segments : segments.segments;
if (!Array.isArray(list)) {
  console.error("✗ audio-segments.json 结构不认识。");
  process.exit(2);
}

const useFfprobe = haveFfprobe();
if (!useFfprobe) {
  console.log("! 没找到 ffprobe —— 时长按文件大小估算。\n");
}

const byChapter = new Map();
const long = [];
const short = [];
const missing = [];
let total = 0;

for (const seg of list) {
  // `audio` is the 1-indexed relative path the synthesize runner wrote.
  const file = path.join(AUDIO_DIR, seg.audio);
  if (!fs.existsSync(file)) {
    missing.push(seg.audio);
    continue;
  }
  const d = durationOf(file, useFfprobe);
  total += d;
  byChapter.set(seg.chapter, (byChapter.get(seg.chapter) ?? 0) + d);
  const text = seg.text ?? "";
  if (d > LONG_S) long.push({ chapter: seg.chapter, step: seg.step, d, n: text.length });
  if (d < SHORT_S && text.length > 0) {
    short.push({ chapter: seg.chapter, step: seg.step, d, n: text.length });
  }
}

console.log("▸ 每章时长");
for (const [ch, d] of byChapter) {
  console.log(`  ${ch.padEnd(16)} ${fmt(d)}`);
}
console.log(`\n▸ 全片 ${fmt(total)} · ${list.length} 步 · 平均 ${(total / list.length).toFixed(1)}s/步`);

if (missing.length) {
  console.log(`\n✗ 缺 ${missing.length} 个音频：${missing.slice(0, 8).join(", ")}`);
}
if (long.length) {
  console.log(`\n! 偏长（> ${LONG_S}s，考虑拆 step 或让画面在步内继续生长）：`);
  for (const x of long) console.log(`  ${x.chapter}/${x.step}  ${x.d.toFixed(1)}s  ${x.n} 字`);
}
if (short.length) {
  console.log(`\n! 偏短（< ${SHORT_S}s，文案可能太薄）：`);
  for (const x of short) console.log(`  ${x.chapter}/${x.step}  ${x.d.toFixed(1)}s  ${x.n} 字`);
}
if (!long.length && !short.length && !missing.length) {
  console.log("\n✓ 没有异常段落。");
}
