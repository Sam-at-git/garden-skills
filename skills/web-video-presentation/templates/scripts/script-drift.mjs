#!/usr/bin/env node
/**
 * script-drift.mjs — 核 narrations.ts 的口播总量有没有相对 script.md 缩水
 *
 * 为什么需要它：script.md 是 Phase 1 定下的口播稿，分章开发时每章各自把它
 * 「转写」进 narrations.ts。转写过程没有任何闸，模型很容易顺手精简 ——
 * 实测一次掉了 38%（10,453 → 6,433 字），而 layout:check / evidence:check /
 * anim:budget / smoke 全绿，成片直接短掉三分之一。
 *
 * 用法: node scripts/script-drift.mjs [--max-drift=15] [--script=../script.md] [--require]
 *       node scripts/script-drift.mjs --chapter=<目录名> --beat-from=<a> --beat-to=<b>
 *         按章核：script.md 按 --- 切拍，第 a..b 拍（1 起）对应这一章，只比这一段
 *
 * 找不到 script.md 时**跳过并 exit 0，且明说跳过了**（只有口播没有 script.md 的项目）；
 * 带 --require 则直接 fail —— 无人值守流水线必须带，否则 script.md 路径一错这道闸就静默失效。
 *
 * 计量单位：script 里有中文就数中文字；纯英文（或其它空格分词的语言）就数单词。
 */
import fs from "node:fs";
import path from "node:path";

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split("=")[1] : d;
};
const MAX = parseFloat(arg("max-drift", "15"));
const SCRIPT = path.resolve(arg("script", "../script.md"));
const cjkCount = (s) => [...s].filter((c) => c >= "一" && c <= "鿿").length;
// 中文数字；没有中文的稿子数单词（引号、标点、TS 语法里的 export/const 等也会被数到，
// 所以 narrations 一侧只数字符串字面量里的内容，见 narrationText）
const wordCount = (s) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
let UNIT = "字";
let count = cjkCount;
const narrationText = (src) => [...src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(\/\/|import\b).*$/gm, "")
  .matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]).join("\n");
// 拍 = 用 --- 分隔、去掉 # 标题行和 > 引用行后仍有中文的块；script.md 开头的标题/说明块不算拍
// （以前按块数直接数，开头那块让 1:1 永远差 1，只好留 ±1 容差；容差一放，章节级核对就对不上）
const isCjk = (c) => c >= "一" && c <= "鿿";
let hasText = (b) => [...b].some(isCjk);
const splitBeats = (text) => text.split(/\n---+\n/).map((b) => b.split("\n").filter((l) => !/^\s*[#>]/.test(l)).join("\n").trim()).filter((b) => hasText(b));

if (!fs.existsSync(SCRIPT)) {
  if (!process.argv.includes("--require")) {
    console.log(`! script:drift 已跳过：找不到 ${SCRIPT}（用 --script=<路径> 指定）。跳过 ≠ 通过`);
    console.log(`\n▸ script.md 缺失，漂移未核（已跳过）`);
    process.exit(0);
  }
  console.error(`✗ 找不到 ${SCRIPT} —— 无法核对漂移`);
  process.exit(1);
}
if (!cjkCount(fs.readFileSync(SCRIPT, "utf8"))) {
  // 非中文稿：拍 = 有字母的块；计量换成单词，narrations 只数字符串里的词
  UNIT = "词";
  hasText = (b) => /\p{L}/u.test(b);
  count = wordCount;
}
const countNarr = (src) => (UNIT === "字" ? count(src) : count(narrationText(src)));
const dir = path.join(process.cwd(), "src", "chapters");
const ONLY = arg("chapter", null);
let want, got = 0;
const rows = [];
if (ONLY) {
  const a = parseInt(arg("beat-from", "0"), 10), b = parseInt(arg("beat-to", "0"), 10);
  const beats = splitBeats(fs.readFileSync(SCRIPT, "utf8"));
  if (!a || !b || b > beats.length) { console.error(`✗ 拍号范围不对：${a}-${b}，script 共 ${beats.length} 拍`); process.exit(1); }
  want = count(beats.slice(a - 1, b).join("\n"));
  const f = path.join(dir, ONLY, "narrations.ts");
  if (!fs.existsSync(f)) { console.error(`✗ 没有 ${f}`); process.exit(1); }
  got = countNarr(fs.readFileSync(f, "utf8"));
  rows.push([`${ONLY}（第 ${a}-${b} 拍）`, got]);
} else {
  want = count(splitBeats(fs.readFileSync(SCRIPT, "utf8")).join("\n"));   // 只数拍里的字，标题/说明块不算
  for (const ch of fs.readdirSync(dir).sort()) {
    const f = path.join(dir, ch, "narrations.ts");
    if (!fs.existsSync(f)) continue;
    const n = countNarr(fs.readFileSync(f, "utf8"));
    got += n;
    rows.push([ch, n]);
  }
}
for (const [ch, n] of rows) console.log(`  ${ch.padEnd(28)} ${String(n).padStart(5)} ${UNIT}`);

const drift = ((want - got) / want) * 100;
console.log(`\n▸ script${ONLY ? "（本章）" : ".md"} ${want} ${UNIT} → narrations ${got} ${UNIT} · 漂移 ${drift.toFixed(1)}%`);
if (UNIT === "字") console.log(`▸ 估时 ${(got / 3.0 / 60).toFixed(1)} 分钟（3.0 中文字/秒·实测）`);
else console.log(`▸ 估时 ${(got / 2.5 / 60).toFixed(1)} 分钟（按 150 词/分估）`);
if (drift > MAX) {
  console.error(`✗ 缩水 ${drift.toFixed(1)}% > 上限 ${MAX}% —— 分章开发把口播压掉了，成片会明显短于规划`);
  process.exit(1);
}
console.log(`✓ 漂移在 ${MAX}% 以内`);
