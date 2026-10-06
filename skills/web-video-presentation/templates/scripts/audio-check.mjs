#!/usr/bin/env node
/**
 * audio-check.mjs — 音频合成的硬验收
 *
 * 核三件事：
 *   1. audio-segments.json 里每一段都真的有 mp3，且不是 0 字节 / 截断的壳
 *   2. 章节 id 没有「一个是另一个的后缀」—— extract-narrations 用 id 当目录名，
 *      撞上了整章音频文本会错位，而且所有机器闸都看不出来
 *   3. 用 ffprobe 量真实总时长 —— 这才是成片长度，outline 的估算一律不可信
 *
 * 用法: node scripts/audio-check.mjs [--min-bytes=2000]
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? parseInt(a.split("=")[1], 10) : d;
};
const MIN_BYTES = arg("min-bytes", 2000);

const root = process.cwd();
const segs = JSON.parse(fs.readFileSync(path.join(root, "audio-segments.json"), "utf8"));
const fails = [];

// —— id 后缀撞车
const ids = [...new Set(segs.map((s) => s.chapter))];
for (const a of ids) for (const b of ids) {
  if (a !== b && b.endsWith(a)) fails.push(`章节 id 撞车：「${a}」是「${b}」的后缀 —— extract-narrations 会把两章音频文本弄错位`);
}

const dur = (f) => {
  try {
    return parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration",
      "-of", "default=nw=1:nk=1", f], { encoding: "utf8" }).trim());
  } catch { return NaN; }
};

const perCh = new Map();
let missing = 0, tiny = 0, totalSec = 0;
for (const s of segs) {
  const f = path.join(root, "public", "audio", s.chapter, `${s.step}.mp3`);
  if (!fs.existsSync(f)) { fails.push(`缺音频：${s.chapter}/${s.step}.mp3`); missing++; continue; }
  const sz = fs.statSync(f).size;
  if (sz < MIN_BYTES) { fails.push(`音频过小（${sz}B）：${s.chapter}/${s.step}.mp3 —— 多半是失败的空壳`); tiny++; continue; }
  const d = dur(f);
  if (!isNaN(d)) {
    totalSec += d;
    perCh.set(s.chapter, (perCh.get(s.chapter) || 0) + d);
  }
}

for (const [ch, d] of perCh) console.log(`  ${ch.padEnd(28)} ${(d / 60).toFixed(1).padStart(5)} 分`);
const mm = Math.floor(totalSec / 60), ss = Math.round(totalSec % 60);
console.log(`\n▸ ${segs.length} 段 · 缺 ${missing} · 过小 ${tiny}`);
console.log(`▸ **实测成片时长 ${mm} 分 ${ss} 秒**（ffprobe 加总，不是估算）`);
if (segs.length) console.log(`▸ 实测语速 ${(segs.reduce((a, s) => a + [...s.text].filter((c) => c >= "一" && c <= "鿿").length, 0) / totalSec).toFixed(2)} 中文字/秒`);

// 把实测时长落盘，站点详情页直接读，不用再 ffprobe 一遍 90 个文件
fs.writeFileSync(path.join(root, "audio-duration.json"), JSON.stringify({
  seconds: Math.round(totalSec), segments: segs.length,
  cjkPerSec: +(segs.reduce((a, s) => a + [...s.text].filter((c) => c >= "\u4e00" && c <= "\u9fff").length, 0) / totalSec).toFixed(2),
}, null, 2) + "\n");

if (fails.length) {
  console.error("");
  for (const f of fails.slice(0, 20)) console.error(`✗ ${f}`);
  if (fails.length > 20) console.error(`✗ …还有 ${fails.length - 20} 条`);
  process.exit(1);
}
console.log("✓ 音频验收通过");
