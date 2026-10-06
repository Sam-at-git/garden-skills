/**
 * anim-budget.mjs — 核「动画时长 ≤ 该 step 口播时长」这条硬规则。
 *
 * Auto 模式严格按音频结束推进，没有「等动画跑完」的兜底 —— 动画比口播长，
 * 就会被当场切断，演到一半跳下一步（CHAPTER-CRAFT.md 代码红线）。
 *
 * 做法：
 *   • 从每章 CSS 里抽出所有 `animation: ... <dur> ... <delay>` 与
 *     `animation-delay`，取 max(delay + dur) 当作该章最长的动画收尾时刻。
 *   • 口播时长优先用 public/audio/<ch>/<n>.mp3 的真实长度（ffprobe），
 *     没有音频就退回估算：中文 字数 ÷ 4，其它语言 词数 ÷ 2.5（秒）。
 *   • 章内最长动画 > 该章最短一步的口播时长 → warn（可能被切断）。
 *     > 该章最长一步 → fail（一定被切断）。
 *
 * ⚠️ 限制：CSS 规则归不到具体 step（一个 .css 服务全章），所以「最长动画」
 *    是**章级**的。warn 只说明「章里有某条动画比章里最短那一步长」，不等于
 *    它们落在同一步上 —— 命中 warn 时要人工确认那条动画到底属于哪一步。
 *
 * 用：npm run anim:budget
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const CH_DIR = path.join(ROOT, "src", "chapters");
const chapters = fs.readdirSync(CH_DIR).filter((d) => fs.statSync(path.join(CH_DIR, d)).isDirectory()).sort();

const ms = (tok) => (tok.endsWith("ms") ? parseFloat(tok) : parseFloat(tok) * 1000);

/** 每条 animation 简写里，前两个时间值分别是 duration 和 delay。 */
function longestAnim(css) {
  let max = 0;
  const decls = [...css.matchAll(/animation:\s*([^;]+);/g)].map((m) => m[1]);
  for (const decl of decls) {
    const times = [...decl.matchAll(/(-?[\d.]+m?s)\b/g)].map((m) => ms(m[1]));
    const dur = times[0] ?? 0;
    const delay = times[1] ?? 0;
    max = Math.max(max, dur + Math.max(0, delay));
  }
  // 单独写的 animation-delay 只能和它那条 animation 的 duration 粗略相加，
  // 这里保守地按「最长 duration + 该 delay」估。
  const durs = decls.map((d) => (([...d.matchAll(/(-?[\d.]+m?s)\b/g)].map((m) => ms(m[1]))[0]) ?? 0));
  const maxDur = Math.max(0, ...durs);
  for (const m of css.matchAll(/animation-delay:\s*([\d.]+m?s)/g)) max = Math.max(max, ms(m[1]) + maxDur);
  return max;
}

function audioMs(file) {
  try {
    const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1", file], { encoding: "utf8" });
    return Math.round(parseFloat(out) * 1000);
  } catch { return null; }
}

const idFromDir = (d) => d.replace(/^\d+-/, "");
// 没有音频时的估算：中文按字（4 字/秒），其它语言按词（2.5 词/秒 ≈ 150 词/分）。
// 英文按字符数估会把时长估长好几倍，闸就放水了。
const estimateMs = (t) => (/[一-鿿]/.test(t)
  ? [...t].filter((c) => !/\s/.test(c)).length * 250
  : (t.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length * 400);
let fails = 0, warns = 0;

for (const ch of chapters) {
  const dir = path.join(CH_DIR, ch);
  const cssFile = fs.readdirSync(dir).find((f) => f.endsWith(".css"));
  const nar = fs.readFileSync(path.join(dir, "narrations.ts"), "utf8");
  const texts = [...nar.matchAll(/^\s*"((?:[^"\\]|\\.)*)",?\s*(?:\/\/.*)?$/gm)].map((m) => m[1]);
  const id = idFromDir(ch);

  const durs = texts.map((t, i) => {
    const f = path.join(ROOT, "public", "audio", id, `${i + 1}.mp3`);
    return (fs.existsSync(f) && audioMs(f)) || Math.max(1500, estimateMs(t));
  });

  const anim = cssFile ? longestAnim(fs.readFileSync(path.join(dir, cssFile), "utf8")) : 0;
  const min = Math.min(...durs), max = Math.max(...durs);

  if (anim > max) {
    console.log(`✗ ${ch}  最长动画 ${anim}ms > 本章最长口播 ${max}ms —— 一定被切断`);
    fails++;
  } else if (anim > min) {
    console.log(`! ${ch}  最长动画 ${anim}ms > 本章最短口播 ${min}ms（最长 ${max}ms）—— 短步上可能被切断`);
    console.log(`    （章级估算：需人工确认这条动画是否真落在那一短步上）`);
    warns++;
  } else {
    console.log(`✓ ${ch}  最长动画 ${anim}ms ≤ 最短口播 ${min}ms`);
  }
}

console.log(`\n▸ ${chapters.length} 章 · ${fails} fail · ${warns} warn`);
process.exit(fails ? 1 : 0);
