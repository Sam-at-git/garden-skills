/**
 * evidence-check.mjs — 论文模式的证据层机器闸（PAPER-INTERPRETATION.md §3 / §10）。
 *
 * 逐章读 evidence.ts，核三件事：
 *   1. fact / supported 必须挂 locator
 *   2. infer / background 的 locator 必须是 null（论文里没有的话不能指向章节号）
 *   3. evidence 的 step 必须落在 [0, narrations.length) 内，且不重复
 *
 * 用：npm run evidence:check              ·  退出码 0 全过 / 1 有 fail
 *     npm run evidence:check -- --require  ·  论文模式强制：哪一章缺 evidence.ts 都算 fail
 *
 * 不是论文模式（没有任何一章有 evidence.ts）时**跳过并 exit 0，且明说跳过了**。
 * 一旦有一章有 evidence.ts，就当论文模式处理：其余章缺 evidence.ts 一律 fail
 * （缺一章 = 那一章的证据层被悄悄丢了）。无人值守流水线请带 --require：
 * 否则把所有 evidence.ts 删光就能让这道闸「跳过」。
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "src", "chapters");
// --chapter=<目录名>：只核这一章（逐章开发完立刻核，不等到 70-gates）
const ONLY = (process.argv.find((a) => a.startsWith("--chapter=")) || "").slice(10);
const chapters = fs.readdirSync(ROOT).filter((d) => fs.statSync(path.join(ROOT, d)).isDirectory() && (!ONLY || d === ONLY)).sort();
if (ONLY && !chapters.length) { console.log(`✗ 没有章节目录 ${ONLY}`); process.exit(1); }
const REQUIRE = process.argv.includes("--require");
const anyEvidence = fs.readdirSync(ROOT).some((d) => fs.existsSync(path.join(ROOT, d, "evidence.ts")));
if (!REQUIRE && !anyEvidence) {
  console.log("! evidence:check 已跳过：没有任何一章有 evidence.ts（不是论文模式）。跳过 ≠ 通过；论文模式请带 --require");
  console.log(`\n▸ ${chapters.length} 章 · 0 条证据标注（已跳过）`);
  process.exit(0);
}

let fails = 0;
let total = 0;
const tally = { fact: 0, supported: 0, infer: 0, background: 0 };

for (const ch of chapters) {
  const evPath = path.join(ROOT, ch, "evidence.ts");
  const narPath = path.join(ROOT, ch, "narrations.ts");
  if (!fs.existsSync(evPath)) {
    console.log(`✗ ${ch}  没有 evidence.ts`);
    fails++;
    continue;
  }
  const src = fs.readFileSync(evPath, "utf8");
  const nar = fs.readFileSync(narPath, "utf8");
  const steps = (nar.match(/^\s*"/gm) || []).length;

  const marks = [...src.matchAll(/\{\s*step:\s*(\d+),\s*type:\s*"(\w+)",\s*locator:\s*(null|"[^"]*")/g)].map(
    (m) => ({ step: +m[1], type: m[2], locator: m[3] === "null" ? null : m[3].slice(1, -1) }),
  );

  const problems = [];
  const seen = new Set();
  for (const m of marks) {
    total++;
    tally[m.type] = (tally[m.type] ?? 0) + 1;
    if ((m.type === "fact" || m.type === "supported") && !m.locator)
      problems.push(`step ${m.step} 是 ${m.type} 却没挂 locator`);
    if ((m.type === "infer" || m.type === "background") && m.locator)
      problems.push(`step ${m.step} 是 ${m.type} 却挂了 locator "${m.locator}"`);
    if (m.step < 0 || m.step >= steps) problems.push(`step ${m.step} 超出该章 0..${steps - 1}`);
    if (seen.has(m.step)) problems.push(`step ${m.step} 有重复的 evidence 条目`);
    seen.add(m.step);
  }

  if (problems.length) {
    console.log(`✗ ${ch}  (${problems.length} fail)`);
    problems.forEach((p) => console.log(`  ✗ ${p}`));
    fails += problems.length;
  } else {
    console.log(`✓ ${ch}  ${marks.length} 条 / ${steps} 步`);
  }
}

console.log(`\n▸ ${chapters.length} 章 · ${total} 条证据标注`);
console.log(`  论文事实 ${tally.fact} · 实验支持 ${tally.supported} · 解读推断 ${tally.infer} · 背景知识 ${tally.background}`);
if (fails) {
  console.log(`✗ ${fails} fail`);
  process.exit(1);
}
console.log("✓ 证据层全部通过");
