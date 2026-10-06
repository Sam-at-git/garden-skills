#!/usr/bin/env node
/**
 * spec-check.mjs — 规格驱动章节（spec.json）的机器校验。既是 CLI 也是模块。
 *
 *   node scripts/spec-check.mjs src/chapters/03-foo            # 校验一章（步数对 narrations.ts）
 *   node scripts/spec-check.mjs src/chapters/03-foo --steps=4  # 指定期望步数
 *   import { validateSpec } from "./spec-check.mjs"            # 生成器 / 闸复用同一套规则
 *
 * 规则（全是硬约束，不过就让模型带着报错重来）：
 *   S1 steps 数 = 期望步数（narrations 条数 / outline 声明）
 *   S2 composition ∈ 八选一；同构图连续 ≤2 步（stable=true 豁免）
 *   S3 每步 1~5 个积木；恰好一个 role=primary；类型必须是已知积木；必填字段齐
 *   S4 文本密度：单个字符串 ≤ 120 字；一步的正文总字数 ≤ 260 —— 超了就是把口播打字上屏
 *   S5 evidence：fact/supported 必有 locator，infer/background 必为 null
 *   S6 Figure 的 src 必须在给定的原图清单里（防编造路径）；RevealList.shown ≥1；Pipeline.active 在范围内
 *   S7 primary 的 delay ≤150
 *   S8 讲解型积木：Formula.symbols 每个符号有 tex/name、式子里找得到（找不到只是软提示）、active 在范围内；
 *      Formula.parts 拼成一行显示，相邻两段数字直接相连（「= 0.58」「0.58 / 3.35」→ 0.580.58）算错；
 *      CodeBlock.notes 的行号在代码范围内、active 在范围内、代码 ≤24 行；DataTable.marks 行列在范围内；
 *      Figure.regions 坐标是 0~100 的百分比、active 指向存在的区域、mode 合法
 *   S9 动画积木：Grid 总格数 ≤4096、lit/done 在范围内；Flow 1~4 条轨道、每条 ≤10 趟、width 1~4；
 *      Gauge 的 value/capacity/input 是数字、max/capacity > 0
 */
import fs from "node:fs";
import path from "node:path";

export const COMPOSITIONS = ["centered-hero", "asymmetric-60-40", "split-screen", "rule-of-thirds", "full-width-strip", "layered-depth", "triptych", "diagram-canvas"];
export const BLOCK_TYPES = {
  Callout: [], BigNumber: ["value"], Stats: ["items"], RevealList: ["items", "shown"], CodeBlock: ["code"], BarChart: ["items"],
  Compare: ["columns"], Pipeline: ["stages"], DataTable: ["columns", "rows"], Diagram: ["nodes"], Placeholder: ["label"],
  Figure: ["src", "label", "alt"], Prose: ["text"], Quote: ["text"], Chips: ["items"], Formula: [],
  Grid: ["cols", "lit"], Flow: ["lanes"], Gauge: ["value", "capacity"],
};
const ROLES = ["primary", "secondary", "background", "annotation"];
const MAX_STR = 120, MAX_STEP_TEXT = 260, MAX_BLOCKS = 5, MAX_RUN = 2;

// 项目里装了 katex 就用它试渲染公式（throwOnError），抓 \middle 缺 \left、括号不配对这类会以红字原样上屏的错
let katex = null;
try { const { createRequire } = await import("node:module"); katex = createRequire(path.join(process.cwd(), "package.json"))("katex"); } catch { katex = null; }
const fixTex = (t) => String(t).replace(/\\\\(?=[A-Za-z,;:!|{}()[\]<>=+\-^_])/g, "\\");
const texError = (t) => { if (!katex) return null; try { katex.renderToString(fixTex(t), { throwOnError: true }); return null; } catch (e) { return e.message.replace(/^KaTeX parse error:\s*/, "").slice(0, 120); } };

/** 软规则前缀：生成器第一次会让模型改，改不掉就放行；闸只记警告不判失败 */
export const SOFT = "〔建议〕";
export const hardErrors = (errs) => errs.filter((e) => !e.startsWith(SOFT));

const cjkLen = (s) => [...String(s)].filter((c) => (c >= "一" && c <= "鿿") || /[A-Za-z0-9]/.test(c)).length;

/** 收集一个积木里所有会上屏的字符串（数字、id、路径不算） */
function textsOf(b) {
  const out = [];
  const push = (v) => { if (typeof v === "string") out.push(v); };
  // code 不算：代码不是口播的字幕，按行数另管（≤24 行）；notes 只算当前讲的那一条
  const skip = new Set(["type", "id", "role", "src", "lang", "kind", "state", "states", "tone", "size", "variant", "orientation", "color", "tex", "code", "notes", "mode", "minimap", "regions"]);
  const walk = (v, key) => {
    if (v === null || v === undefined) return;
    if (typeof v === "string") { if (!skip.has(key)) push(v); return; }
    if (Array.isArray(v)) { v.forEach((x) => walk(x, key)); return; }
    if (typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(b, "");
  if (b && b.type === "CodeBlock" && Array.isArray(b.notes) && typeof b.active === "number" && b.notes[b.active]) walk(b.notes[b.active], "");
  if (b && b.type === "Figure" && b.regions && typeof b.regions === "object") for (const g of Object.values(b.regions)) if (g && typeof g.label === "string") out.push(g.label);
  return out;
}

/**
 * @param spec 解析后的 spec 对象
 * @param opts { steps?: number, figures?: string[] (可用的 /paper/... 路径), math?: boolean,
 *               partial?: boolean (只是一章的一段：不查整章级规则), prev?: string[] (前一段末尾的构图序列，接着数连续),
 *               narrations?: string[] (每步口播；给了就查「念字」：上屏文字与口播的 8 字连串重合 > 40% 判 fail) }
 * @returns string[] 问题列表（空 = 通过）
 */
export function validateSpec(spec, opts = {}) {
  const errs = [];
  if (!spec || typeof spec !== "object") return ["spec 不是对象"];
  if (!Array.isArray(spec.steps)) return ["spec.steps 不是数组"];
  const n = spec.steps.length;
  if (opts.steps !== undefined && n !== opts.steps) errs.push(`S1 步数不对：spec 有 ${n} 步，应为 ${opts.steps} 步（每一拍口播对应一步，不能合并也不能拆）`);
  const figs = opts.figures ? new Set(opts.figures) : null;
  let run = 0, prev = null;
  if (Array.isArray(opts.prev) && opts.prev.length) {
    prev = opts.prev[opts.prev.length - 1];
    for (let k = opts.prev.length - 2; k >= 0 && opts.prev[k] === prev; k--) run++;
  }
  spec.steps.forEach((s, i) => {
    const at = `step ${i}`;
    if (!s || typeof s !== "object") { errs.push(`${at}: 不是对象`); return; }
    if (!COMPOSITIONS.includes(s.composition)) errs.push(`${at}: composition「${s.composition}」不合法，只能是 ${COMPOSITIONS.join(" / ")}`);
    if (s.composition === prev) { run++; if (run >= MAX_RUN && !s.stable) errs.push(`${at}: 构图「${s.composition}」已连续 ${run + 1} 步，换一种构图（有意的对照系列可加 "stable": true）`); }
    else run = 0;
    prev = s.composition;
    if (s.titleSize && !["h1", "h2"].includes(s.titleSize)) errs.push(`${at}: titleSize 只能 h1/h2`);
    if (s.title && cjkLen(s.title) > 40) errs.push(`${at}: title 太长（${cjkLen(s.title)} 字，≤40）——标题是一句话不是一段`);
    if (s.lead && cjkLen(s.lead) > MAX_STR) errs.push(`${at}: lead 太长（${cjkLen(s.lead)} 字，≤${MAX_STR}）`);
    // 括号 / 引号没配对，多半是生成时字符串被截断了（「Table 1 看哪里 + 作者意图：7 行（每个 su」）
    for (const t of [s.title, s.lead, ...(Array.isArray(s.blocks) ? s.blocks.flatMap((x) => textsOf(x)) : [])].filter(Boolean)) {
      const bad = [["（", "）"], ["「", "」"], ["(", ")"], ["“", "”"]].find(([o, c]) => t.split(o).length !== t.split(c).length);
      if (bad) { errs.push(`${SOFT}${at}: 「${String(t).slice(-24)}」里的 ${bad[0]}${bad[1]} 没配对，像是写到一半被截断了，补完整`); break; }
    }
    const blocks = Array.isArray(s.blocks) ? s.blocks : [];
    if (!blocks.length) errs.push(`${at}: 没有积木（blocks 为空）—— 至少一个 primary 积木`);
    if (blocks.length > MAX_BLOCKS) errs.push(`${at}: 积木 ${blocks.length} 个（≤${MAX_BLOCKS}），一步只放最值得放大的 1~3 样东西`);
    const primaries = blocks.filter((b) => b && b.role === "primary").length;
    if (blocks.length && primaries !== 1) errs.push(`${at}: role=primary 的积木有 ${primaries} 个，必须恰好 1 个`);
    let stepText = 0;
    blocks.forEach((b, j) => {
      const bat = `${at} 积木 ${j}`;
      if (!b || typeof b !== "object") { errs.push(`${bat}: 不是对象`); return; }
      const req = BLOCK_TYPES[b.type];
      if (!req) { errs.push(`${bat}: 未知积木类型「${b.type}」，只能是 ${Object.keys(BLOCK_TYPES).join(" / ")}`); return; }
      for (const k of req) if (b[k] === undefined || b[k] === null || (Array.isArray(b[k]) && !b[k].length)) errs.push(`${bat}（${b.type}）: 缺必填字段 ${k}`);
      if (b.role !== undefined && !ROLES.includes(b.role)) errs.push(`${bat}: role「${b.role}」不合法`);
      if (b.role === "primary" && (b.delay ?? 0) > 150) errs.push(`${bat}: primary 的 delay ${b.delay} > 150ms`);
      if (b.type === "Figure" && b.focus !== undefined) {
        const f = b.focus, okObj = f && typeof f === "object" && !Array.isArray(f) && [f.x, f.y, f.w].every((n) => typeof n === "number") && f.w > 0 && f.w <= 100;
        const okArr = Array.isArray(f) && f.length >= 3 && f.slice(0, 3).every((n) => typeof n === "number") && f[2] > 0;
        if (!okObj && !okArr) errs.push(`${bat}: Figure.focus 要写成 { "x": 0~100, "y": 0~100, "w": 1~100 }（原图百分比），现在是 ${JSON.stringify(f).slice(0, 40)}`);
      }
      if (b.type === "Figure" && figs && !figs.has(b.src)) errs.push(`${bat}: Figure src「${b.src}」不在可用原图清单里（不能编路径；没有图就用 Placeholder）`);
      if (b.type === "RevealList" && (typeof b.shown !== "number" || b.shown < 1 || b.shown > (b.items?.length ?? 0))) errs.push(`${bat}: RevealList.shown 必须在 1..items.length`);
      if (b.type === "Pipeline" && b.active !== undefined && (b.active < 0 || b.active >= (b.stages?.length ?? 0))) errs.push(`${bat}: Pipeline.active 超出 stages 范围`);
      if (b.type === "DataTable" && Array.isArray(b.columns) && b.columns.some((c) => typeof c !== "string" && typeof c !== "number")) errs.push(`${bat}: DataTable.columns 每项是字符串（列名），不是对象`);
      if (b.type === "DataTable" && Array.isArray(b.rows) && Array.isArray(b.columns)) {
        const bad = b.rows.findIndex((r) => !Array.isArray(r) || r.length !== b.columns.length);
        if (bad >= 0) errs.push(`${bat}: DataTable 第 ${bad} 行的格数 ≠ 列数 ${b.columns.length}`);
        if (b.rows.length > 8) errs.push(`${bat}: DataTable ${b.rows.length} 行（≤8）—— 大表拆步、每步只答一个问题`);
      }
      if (b.type === "BarChart" && Array.isArray(b.items)) {
        if (b.items.length > 8) errs.push(`${bat}: BarChart ${b.items.length} 根柱（≤8）`);
        if (b.items.some((it) => typeof it?.value !== "number")) errs.push(`${bat}: BarChart 每项 value 必须是数字`);
        if (b.reference !== undefined && typeof b.reference !== "number" && typeof b.reference?.value !== "number") errs.push(`${bat}: BarChart.reference 要写成 { "value": 数字, "label": "…" }`);
        if (b.max !== undefined && typeof b.max !== "number") errs.push(`${bat}: BarChart.max 必须是数字`);
      }
      if (b.type === "Diagram" && Array.isArray(b.nodes)) {
        if (b.nodes.length > 10) errs.push(`${bat}: Diagram ${b.nodes.length} 个节点（≤10）`);
        const ids = new Set(b.nodes.map((x) => x?.id));
        (b.edges || []).forEach((e, k) => { if (!ids.has(e?.from) || !ids.has(e?.to)) errs.push(`${bat}: Diagram 第 ${k} 条边指向不存在的节点（${e?.from} → ${e?.to}）`); });
      }
      if (b.type === "Stats" && Array.isArray(b.items) && b.items.some((it) => it?.value === undefined || it?.value === null)) errs.push(`${bat}: Stats 每项都要有 value`);
      if (b.type === "Chips" && Array.isArray(b.items) && b.items.some((it) => typeof it !== "string" && typeof it?.label !== "string")) errs.push(`${bat}: Chips 每项是字符串或 { label, sub?, state? }`);
      if (b.type === "Compare" && Array.isArray(b.columns) && (b.columns.length < 2 || b.columns.length > 3)) errs.push(`${bat}: Compare 只能 2~3 栏`);
      if (b.type === "Formula" && !b.tex && !(Array.isArray(b.parts) && b.parts.length)) errs.push(`${bat}: Formula 要 tex 或 parts`);
      // parts 是同一条式子的几段，渲染时首尾相接拼成一行：上一段以数字结尾、下一段以数字开头，画面上两个数粘成一个
      // （2610.06790 第 5 章：「= 0.58」「0.58 / 3.35 ≈ 0.173」显示成 0.580.58）。模型多半是把 parts 当成多行推导在写
      if (b.type === "Formula" && Array.isArray(b.parts)) for (let k = 1; k < b.parts.length; k++) {
        const tail = String(b.parts[k - 1]?.tex ?? "").replace(/(\\[,;:!]|\\quad|\\qquad|\s|[{}])+$/g, "");
        const head = String(b.parts[k]?.tex ?? "").replace(/^(\\[,;:!]|\\quad|\\qquad|\s|[{}])+/g, "");
        if (/[0-9%]$|\\%$/.test(tail) && /^[0-9.]/.test(head))
          errs.push(`${bat}: Formula.parts 第 ${k} 段「${String(b.parts[k - 1].tex).slice(-16)}」和第 ${k + 1} 段「${String(b.parts[k].tex).slice(0, 16)}」会拼成一行，两个数直接粘在一起 —— parts 是同一条式子的几段，不是多行推导：写成一条连续的式子（后一段以 = / ≈ / + 开头，如「\\frac{a-b}{b}」「= \\frac{0.58}{3.35}」「\\approx 0.173」），或者拆成两个 Formula / 两步`);
      }
      if (b.type === "Formula") for (const t of [b.tex, ...(Array.isArray(b.parts) ? b.parts.map((p) => p?.tex) : [])].filter(Boolean)) {
        const te = texError(t);
        if (te) errs.push(`${bat}: TeX 渲染不了「${String(t).slice(0, 40)}」—— ${te}（JSON 里一个反斜杠写成 \\\\，\\middle 必须配 \\left … \\right）`);
      }
      if (b.type === "Grid") {
        const nums = ["groups", "groupCols", "rows", "cols", "lit", "done"].filter((k) => b[k] !== undefined && typeof b[k] !== "number");
        if (nums.length) errs.push(`${bat}: Grid 的 ${nums.join(" / ")} 必须是数字`);
        const total = (b.groups ?? 1) * (b.rows ?? 1) * (b.cols ?? 0);
        if (total > 4096) errs.push(`${bat}: Grid 共 ${total} 格（≤4096）—— 层级图不需要真实规模，缩小 rows / cols，标签里写真实数字`);
        if (typeof b.lit === "number" && (b.lit < 0 || b.lit > total)) errs.push(`${bat}: Grid.lit ${b.lit} 超出 0..${total}`);
      }
      if (b.type === "Flow" && Array.isArray(b.lanes)) {
        if (b.lanes.length < 1 || b.lanes.length > 4) errs.push(`${bat}: Flow 有 ${b.lanes.length} 条轨道（1~4）`);
        b.lanes.forEach((l, k) => {
          if (!l || typeof l.from !== "string" || typeof l.to !== "string") errs.push(`${bat}: Flow 第 ${k} 条轨道要有 from / to（两端的名字）`);
          if (!Array.isArray(l?.trips)) errs.push(`${bat}: Flow 第 ${k} 条轨道缺 trips（每一趟一项）`);
          else if (l.trips.length > 10) errs.push(`${bat}: Flow 第 ${k} 条轨道 ${l.trips.length} 趟（≤10）—— 一步里跑不完，拆成几步（同 id，trips 逐步加长）`);
          if (l?.width !== undefined && !(Number.isInteger(l.width) && l.width >= 1 && l.width <= 4)) errs.push(`${bat}: Flow 第 ${k} 条轨道 width 只能是 1~4`);
        });
      }
      if (b.type === "Gauge") {
        if (typeof b.value !== "number" || typeof b.capacity !== "number" || !(b.capacity > 0)) errs.push(`${bat}: Gauge 的 value / capacity 必须是数字，capacity > 0`);
        if (b.input !== undefined && !(b.input && typeof b.input.value === "number" && typeof b.input.max === "number" && b.input.max > 0)) errs.push(`${bat}: Gauge.input 要写成 { "value": 数字, "max": 数字(>0), "label": "…" }`);
      }
      if (b.type === "Prose" && b.size && !["body", "large", "display"].includes(b.size)) errs.push(`${bat}: Prose.size 只能 body/large/display`);
      explainerChecks(b, bat, errs);
      for (const t of textsOf(b)) {
        const L = cjkLen(t);
        stepText += L;
        if (L > MAX_STR) errs.push(`${bat}（${b.type}）: 有一段文字 ${L} 字（≤${MAX_STR}）：「${t.slice(0, 30)}…」—— 画面不是口播的字幕，只留关键短语`);
      }
    });
    if (stepText > MAX_STEP_TEXT) errs.push(`${at}: 上屏文字合计 ${stepText} 字（≤${MAX_STEP_TEXT}）—— 拆掉说明性长句，画面信息密度靠图 / 数字 / 结构，不靠字`);
    // 念字：上屏文字不是口播的字幕。把这一步所有上屏字符串拼起来，和口播比 8 字连串
    // 只拦「当标签用」的写法（前后是分隔符或首尾，如「GRPO · 锚」「锚 + 桥」「概念 #2」），正常句子里的「验算」「桥梁」不算
    const SCAFFOLD_LABEL = /(^|[\s·|/+、，,:：（(])(锚|桥|术语层|术语|验算|必讲)(?=$|[\s·|/+、，,:：）)])|概念\s*#\s*\d/;
    for (const [k, v] of [["kicker", s.kicker], ["title", s.title], ["lead", s.lead]]) if (v && SCAFFOLD_LABEL.test(v)) errs.push(`${at}: ${k}「${v}」用了写稿方法的词（锚 / 桥 / 术语 / 验算 / 概念 #）—— 这些是 outline 的标签，不上屏；换成观众能懂的小标题`);
    if (Array.isArray(opts.narrations) && opts.narrations[i]) {
      const grams = (t, n = 8) => { const z = [...String(t)].filter((c) => c >= "一" && c <= "鿿").join(""); const g = new Set(); for (let k = 0; k + n <= z.length; k++) g.add(z.slice(k, k + n)); return g; };
      const screen = blocks.flatMap((b) => textsOf(b)).concat([s.title || "", s.lead || ""]).join("\n");
      const sg = grams(screen), ng = grams(opts.narrations[i]);
      if (sg.size >= 12) {
        let hit = 0; for (const g of sg) if (ng.has(g)) hit++;
        const ratio = hit / sg.size;
        if (ratio > 0.4) errs.push(`${SOFT}${at}: 上屏文字有 ${(ratio * 100).toFixed(0)}% 和口播逐字重合（≤40%）—— 这是把口播打成字幕了；画面只留关键短语、数字、结构，解释交给口播`);
      }
    }
    const ev = s.evidence;
    if (ev) {
      if (!["fact", "supported", "infer", "background"].includes(ev.type)) errs.push(`${at}: evidence.type「${ev.type}」不合法`);
      else if ((ev.type === "fact" || ev.type === "supported") && !ev.locator) errs.push(`${at}: evidence 是 ${ev.type} 但没有 locator（§X / Fig N / Table N / Eq N）`);
      else if ((ev.type === "infer" || ev.type === "background") && ev.locator) errs.push(`${at}: evidence 是 ${ev.type}，locator 必须是 null（讲者之声 / 通识不能指向论文章节）`);
    }
  });
  // 音画对齐：每步的 say（这一拍口播开头几个字）必须对得上第 i 拍。分段生成时模型会整段错一拍（2609.24220v1 第 2 章第 6~11 步），
  // 画面比口播晚一步，校验器以前完全看不出来。
  if (Array.isArray(opts.narrations) && opts.narrations.length) {
    const norm = (t) => String(t || "").replace(/[\s"'“”‘’「」『』（）()《》<>【】\[\]，。、；：！？,.;:!?—\-·…*`]/g, "");
    const off = opts.narrOffset || 0;
    const hit = (say, k) => { const n = norm(opts.narrations[k]); const q = norm(say).slice(0, 8); return q.length >= 3 && n && n.slice(0, 30).includes(q.slice(0, Math.min(6, q.length))); };
    const shifted = [];
    spec.steps.forEach((s, i) => {
      if (!s) return;
      if (!s.say) { if (opts.requireSay) errs.push(`step ${i}: 缺 say 字段（抄这一拍口播的开头 6~10 个字，用来核对音画没错位）`); return; }
      if (hit(s.say, i)) return;
      const j = [i - 1, i + 1, i - 2, i + 2].find((k) => k >= 0 && k < opts.narrations.length && hit(s.say, k));
      if (j !== undefined) shifted.push(`step ${i + off} 写的是第 ${j + off} 拍的内容（say「${s.say}」）`);
      else errs.push(`step ${i}: say「${s.say}」对不上这一拍口播的开头「${String(opts.narrations[i]).slice(0, 12)}」`);
    });
    if (shifted.length) errs.push(`音画错位：${shifted.slice(0, 4).join("；")}${shifted.length > 4 ? "…" : ""} —— steps 第 j 项必须对应本段第 j 拍口播，逐项重新对齐，不要多写或少写一步`);
  }
  // 依次凸显（软规则）：规则书要一步点亮 1~3 个符号 / 一处区域，模型常一步全亮了事（2501.09223 首跑：4 个符号、整图区域都在一步里全点亮）
  spec.steps.forEach((s, i) => {
    for (const b of s?.blocks || []) {
      if (b?.type === "Formula" && Array.isArray(b.symbols) && b.symbols.length >= 3) {
        const act = Array.isArray(b.active) ? b.active : b.active === undefined ? [] : [b.active];
        if (act.length > 3) errs.push(`${SOFT}step ${i}: 公式一步点亮了 ${act.length} 个符号 —— 拆成几步：同一个 id 的 Formula 连续几步，每步 active 只放 1~3 个，口播讲到哪个亮哪个`);
        const sameId = (k) => b.id && (spec.steps[k]?.blocks || []).some((x) => x?.type === "Formula" && x.id === b.id);
        const series = sameId(i - 1) || sameId(i + 1);
        const boundary = opts.partial && (i === 0 || i === spec.steps.length - 1);
        if (!series && !boundary) errs.push(`${SOFT}step ${i}: 这条 ${b.symbols.length} 个符号的式子只出现了一步 —— 逐符号讲要连续几步用同一个 id，每步 active 换下一个（参考规则书 §3.1）`);
      }
      if (b?.type === "Figure" && b.regions && typeof b.regions === "object") {
        const ids = Object.keys(b.regions);
        const act = Array.isArray(b.active) ? b.active : b.active ? [b.active] : [];
        if (ids.length >= 3 && act.length === ids.length) errs.push(`${SOFT}step ${i}: 图上 ${ids.length} 个区域一步全点亮了 —— 一步指一处：同一个 id 的 Figure 连续几步，每步 active 换一个区域，镜头会滑过去`);
      }
    }
  });
  if (opts.partial) return errs;
  // 整章：构图种类 ≥2（≥4 步时）
  const kinds = new Set(spec.steps.map((s) => s?.composition));
  if (n >= 4 && kinds.size < 2) errs.push(`整章 ${n} 步只用了 1 种构图，至少换 2 种`);
  // 整章：至少一处「会动 / 有结构」的积木，纯文字章不合格
  const structural = new Set(["BarChart", "Diagram", "Pipeline", "DataTable", "Chips", "Figure", "Formula", "RevealList", "BigNumber", "Stats", "CodeBlock", "Compare", "Grid", "Flow", "Gauge"]);
  if (n >= 3 && !spec.steps.some((s) => (s?.blocks || []).some((b) => structural.has(b?.type)))) errs.push("整章只有 Prose / Callout / Quote，没有一处图表 / 结构 / 数字积木 —— 整章纯文字 = 不合格");
  return errs;
}

const inRange = (v, lo, hi) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
const idxList = (a) => (a === undefined || a === null ? [] : Array.isArray(a) ? a : [a]);
const texNorm = (t) => String(t).replace(/\s+/g, "");

/** S8：公式逐符号 / 代码逐段 / 表格圈格 / 图上区域 */
function explainerChecks(b, bat, errs) {
  if (b.type === "Formula" && b.symbols !== undefined) {
    if (!Array.isArray(b.symbols) || !b.symbols.length) { errs.push(`${bat}: Formula.symbols 要是非空数组 [{ "tex": "Q", "name": "查询", "meaning": "…" }]`); return; }
    if (!b.tex) errs.push(`${bat}: 逐符号讲解要写整式 tex（不能只给 parts）`);
    if (b.symbols.length > 8) errs.push(`${bat}: Formula.symbols ${b.symbols.length} 个（≤8）—— 一屏讲不完就拆两条式子，或只挑决定意思的符号`);
    b.symbols.forEach((y, k) => {
      if (!y || typeof y.tex !== "string" || !y.tex.trim() || typeof y.name !== "string" || !y.name.trim()) { errs.push(`${bat}: symbols[${k}] 要有 tex 和 name`); return; }
      if (/\\[A-Za-z]+/.test(y.name)) errs.push(`${SOFT}${bat}: symbols[${k}].name「${y.name.slice(0, 20)}」是 TeX —— name 写它叫什么（「KL 系数」「参考策略」），符号本身放 tex`);
      const te = texError(y.tex);
      if (te) errs.push(`${bat}: symbols[${k}].tex「${y.tex.slice(0, 30)}」渲染不了 —— ${te}`);
    });
    const n = b.symbols.length;
    for (const a of idxList(b.active)) if (!Number.isInteger(a) || a < 0 || a >= n) errs.push(`${bat}: Formula.active ${JSON.stringify(a)} 超出 symbols 范围（0~${n - 1}）`);
    if (b.tex) {
      const t = fixTex(b.tex);
      const marked = [...t.matchAll(/\[\[([\s\S]+?)\]\](?!\])/g)].map((m) => texNorm(m[1]));
      const lost = b.symbols.filter((y) => y && typeof y.tex === "string" && (marked.length ? !marked.includes(texNorm(fixTex(y.tex))) : !texNorm(t).includes(texNorm(fixTex(y.tex)))));
      if (lost.length) errs.push(`${SOFT}${bat}: 符号 ${lost.map((y) => `「${y.tex}」`).join("")} 在整式里找不到，讲到它时式子里不会点亮 —— 在 tex 里用 [[ ]] 把它圈出来（[[ ]] 里的写法要和 symbols 里的 tex 一字不差）`);
    }
  }
  if (b.type === "CodeBlock") {
    const lines = (Array.isArray(b.code) ? b.code : String(b.code ?? "").split("\n")).length;
    if (lines > 24) errs.push(`${bat}: 代码 ${lines} 行（≤24）—— 一屏放不下；只留要讲的那段，其余用 … 省略，或拆成两屏`);
    if (b.notes !== undefined) {
      if (!Array.isArray(b.notes) || !b.notes.length) errs.push(`${bat}: CodeBlock.notes 要是非空数组 [{ "lines": [起, 止], "title": "…", "text": "…" }]`);
      else b.notes.forEach((x, k) => {
        if (!x || !Array.isArray(x.lines) || !x.lines.length || typeof x.text !== "string") { errs.push(`${bat}: notes[${k}] 要有 lines（[起, 止]，1 起）和 text`); return; }
        if (x.lines.some((v) => !Number.isInteger(v) || v < 1 || v > lines)) errs.push(`${bat}: notes[${k}].lines ${JSON.stringify(x.lines)} 超出代码行号范围（1~${lines}）`);
        if (cjkLen(x.text) > MAX_STR) errs.push(`${bat}: notes[${k}].text 太长（${cjkLen(x.text)} 字，≤${MAX_STR}）`);
      });
      if (b.active !== undefined && !(Number.isInteger(b.active) && b.active >= 0 && b.active < (b.notes?.length ?? 0))) errs.push(`${bat}: CodeBlock.active ${JSON.stringify(b.active)} 超出 notes 范围`);
    } else if (b.active !== undefined) errs.push(`${bat}: CodeBlock 给了 active 但没有 notes`);
    if (b.vars !== undefined && (!Array.isArray(b.vars) || b.vars.some((v) => !v || typeof v.name !== "string" || (typeof v.value !== "string" && typeof v.value !== "number")))) errs.push(`${bat}: CodeBlock.vars 每项是 { "name": "i", "value": 3 }`);
  }
  if (b.type === "DataTable" && b.marks !== undefined) {
    if (!Array.isArray(b.marks)) errs.push(`${bat}: DataTable.marks 要是数组 [{ "row": 2 }, { "col": 3 }, { "row": 2, "col": 3 }]`);
    else b.marks.forEach((m, k) => {
      if (!m || (m.row === undefined && m.col === undefined)) { errs.push(`${bat}: marks[${k}] 至少要有 row 或 col`); return; }
      if (m.row !== undefined && !(Number.isInteger(m.row) && m.row >= 0 && m.row < (b.rows?.length ?? 0))) errs.push(`${bat}: marks[${k}].row ${m.row} 超出行范围（0 起，不含表头）`);
      if (m.col !== undefined && !(Number.isInteger(m.col) && m.col >= 0 && m.col < (b.columns?.length ?? 0))) errs.push(`${bat}: marks[${k}].col ${m.col} 超出列范围（0 起）`);
    });
  }
  if (b.type === "Figure" && b.regions !== undefined) {
    const R = b.regions;
    if (!R || typeof R !== "object" || Array.isArray(R) || !Object.keys(R).length) { errs.push(`${bat}: Figure.regions 要写成 { "区域id": { "x": 0~100, "y": 0~100, "w": …, "h": …, "label": "…" } }`); return; }
    for (const [id, g] of Object.entries(R)) {
      if (!g || ![g.x, g.y].every((v) => inRange(v, 0, 100)) || ![g.w, g.h].every((v) => inRange(v, 0.5, 100)) || g.x + g.w > 100.5 || g.y + g.h > 100.5)
        errs.push(`${bat}: regions.${id} 坐标不对 —— x/y/w/h 都是原图百分比（0~100），且 x+w、y+h 不超过 100`);
      if (g && g.label && cjkLen(g.label) > 24) errs.push(`${bat}: regions.${id}.label 太长（≤24 字，显示在图下方图例里的一行）`);
    }
    for (const a of idxList(b.active)) if (typeof a !== "string" || !R[a]) errs.push(`${bat}: Figure.active「${a}」不是 regions 里的区域 id`);
    if (b.mode !== undefined && !["spotlight", "zoom", "crop"].includes(b.mode)) errs.push(`${bat}: Figure.mode 只能 spotlight / zoom / crop`);
    if (b.minimap !== undefined && !["tl", "tr", "bl", "br"].includes(b.minimap)) errs.push(`${bat}: Figure.minimap 只能 tl / tr / bl / br`);
  } else if (b.type === "Figure" && b.active !== undefined && b.active !== null) errs.push(`${bat}: Figure 给了 active 但没有 regions`);
  if (b.intent !== undefined && (typeof b.intent !== "string" || cjkLen(b.intent) > 60)) errs.push(`${bat}: intent 是一句话（≤60 字）：作者用这块想证明什么`);
}

/**
 * 确定性纠正：模型最常犯、又不需要它「想」就能改对的错，直接改掉，不耗重试。
 * 返回修改说明列表（写进日志）。改不了的（文字太长、念字、步数不对）留给 validateSpec 报。
 */
const LABEL_RE = /(^|[\s·|/+、，,:：（(])(锚|桥|术语层|术语|验算|必讲|概念\s*#\s*\d+)(?=$|[\s·|/+、，,:：）)])/g;
export function normalizeSpec(spec, opts = {}) {
  const fixes = [];
  if (!spec || !Array.isArray(spec.steps)) return fixes;
  const figs = opts.figures ? new Set(opts.figures) : null;
  spec.version = 1;
  spec.steps.forEach((s, i) => {
    if (!s || typeof s !== "object") return;
    const at = `step ${i}`;
    if (!Array.isArray(s.blocks)) s.blocks = [];
    s.blocks = s.blocks.filter((b) => b && typeof b === "object" && typeof b.type === "string");
    // 标题里的写稿标签：删掉标签词和它两边多余的分隔符
    for (const k of ["kicker", "title", "lead"]) {
      if (typeof s[k] !== "string") continue;
      const v = s[k].replace(LABEL_RE, "$1").replace(/(\s*[·|/+]\s*){2,}/g, " · ").replace(/^[\s·|/+、，,:：]+|[\s·|/+、，,:：]+$/g, "").trim();
      if (v !== s[k]) { fixes.push(`${at} ${k}: 去掉写稿标签「${s[k]}」→「${v}」`); if (v) s[k] = v; else delete s[k]; }
    }
    if (!COMPOSITIONS.includes(s.composition)) { fixes.push(`${at}: composition「${s.composition}」→ centered-hero`); s.composition = "centered-hero"; }
    for (const b of s.blocks) {
      if (b.type === "Figure" && figs && !figs.has(b.src)) {
        fixes.push(`${at}: Figure「${b.src}」不在原图清单 → 改成 Placeholder`);
        const lbl = b.label || "原图"; for (const k of Object.keys(b)) if (!["type", "id", "role", "delay"].includes(k)) delete b[k];
        b.type = "Placeholder"; b.label = `${lbl} 原图未取得`;
      }
      if (b.type === "Figure" && Array.isArray(b.focus)) { const [x, y, w, h] = b.focus; b.focus = { x, y, w, h }; fixes.push(`${at}: Figure.focus 数组 → 对象`); }
      // 旧写法 focus 是硬裁切：w=50 就只剩半张表，正好把一列字从中间切开（回放 2609.00006 的 Table 15）。
      // 改成 FigureLens 的聚光：整图都在，只把这一块提出来
      if (b.type === "Figure" && b.focus && typeof b.focus === "object" && !b.regions && [b.focus.x, b.focus.y, b.focus.w].every((n) => typeof n === "number")) {
        const f = b.focus; b.regions = { focus: { x: f.x, y: f.y, w: f.w, h: f.h ?? 100 - f.y } }; b.active = "focus"; b.mode = "spotlight"; delete b.focus;
        fixes.push(`${at}: Figure.focus（裁切）→ 聚光区域`);
      }
      if (b.type === "RevealList" && Array.isArray(b.items) && b.items.length) {
        const n = Math.max(1, Math.min(b.items.length, Number(b.shown) || b.items.length));
        if (n !== b.shown) { fixes.push(`${at}: RevealList.shown ${b.shown} → ${n}`); b.shown = n; }
      }
      if (b.type === "Pipeline" && Array.isArray(b.stages) && b.active !== undefined && (b.active < 0 || b.active >= b.stages.length)) { fixes.push(`${at}: Pipeline.active 越界 → 去掉`); delete b.active; }
      if (b.type === "BarChart" && typeof b.reference === "number") { b.reference = { value: b.reference }; fixes.push(`${at}: BarChart.reference 数字 → 对象`); }
      // 横向柱图画不了负值（从左边线往右长），有负值就改成纵向：零线上移、负值柱向下
      if (b.type === "BarChart" && b.orientation === "horizontal" && Array.isArray(b.items) && b.items.some((it) => Number(it?.value) < 0)) { b.orientation = "vertical"; fixes.push(`${at}: 横向 BarChart 有负值 → 改成纵向`); }
      if (b.type === "CodeBlock" && Array.isArray(b.code)) b.code = b.code.map((l) => (typeof l === "string" ? l : JSON.stringify(l)));
      // 应是数组却给了单值（首跑：CodeBlock.highlight: 3 → 运行时 "number 3 is not iterable"）
      const ARR = { CodeBlock: ["highlight"], Chips: ["done"], Pipeline: ["states"], RevealList: ["items"], Stats: ["items"], BarChart: ["items"], Compare: ["columns"], DataTable: ["columns", "rows"], Diagram: ["nodes", "edges"] };
      for (const k of ARR[b.type] || []) if (b[k] !== undefined && b[k] !== null && !Array.isArray(b[k])) { fixes.push(`${at}: ${b.type}.${k} 单值 → 数组`); b[k] = [b[k]]; }
      if (b.type === "CodeBlock" && Array.isArray(b.highlight)) b.highlight = b.highlight.map(Number).filter(Number.isFinite);
      if (b.type === "BarChart" && Array.isArray(b.items)) for (const it of b.items) if (it && it.err !== undefined && !(Array.isArray(it.err) && it.err.length === 2)) { delete it.err; fixes.push(`${at}: BarChart err 形状不对 → 去掉`); }
      if (b.type === "DataTable" && Array.isArray(b.rows)) b.rows = b.rows.map((r) => (Array.isArray(r) ? r : [r]));
      // 动画积木：数字写成字符串（"5.1"）、trips 写成单个字符串、lit 越界
      const num = (v) => (typeof v === "string" && v.trim() !== "" && Number.isFinite(+v.replace(/,/g, "")) ? +v.replace(/,/g, "") : v);
      if (b.type === "Grid") {
        for (const k of ["groups", "groupCols", "rows", "cols", "lit", "done"]) if (typeof b[k] === "string") { const v = num(b[k]); if (v !== b[k]) { b[k] = v; fixes.push(`${at}: Grid.${k} 字符串 → 数字`); } }
        const total = (b.groups ?? 1) * (b.rows ?? 1) * (b.cols ?? 0);
        if (typeof b.lit === "number" && total > 0 && (b.lit < 0 || b.lit > total)) { b.lit = Math.max(0, Math.min(total, b.lit)); fixes.push(`${at}: Grid.lit 越界 → ${b.lit}`); }
      }
      if (b.type === "Flow" && b.lanes && !Array.isArray(b.lanes)) { b.lanes = [b.lanes]; fixes.push(`${at}: Flow.lanes 单值 → 数组`); }
      if (b.type === "Flow" && Array.isArray(b.lanes)) for (const l of b.lanes) {
        if (!l || typeof l !== "object") continue;
        if (typeof l.trips === "number") { l.trips = Array.from({ length: Math.max(0, Math.min(10, l.trips)) }, () => ""); fixes.push(`${at}: Flow.trips 数字 → ${l.trips.length} 趟`); }
        else if (typeof l.trips === "string") { l.trips = [l.trips]; fixes.push(`${at}: Flow.trips 单值 → 数组`); }
        if (typeof l.width === "string") l.width = num(l.width);
      }
      if (b.type === "Gauge") {
        for (const k of ["value", "capacity"]) if (typeof b[k] === "string") { const v = num(b[k]); if (v !== b[k]) { b[k] = v; fixes.push(`${at}: Gauge.${k} 字符串 → 数字`); } }
        if (b.input && typeof b.input === "object") for (const k of ["value", "max"]) if (typeof b.input[k] === "string") b.input[k] = num(b.input[k]);
      }
      // 表头写成 {key, label} 对象（2501.09223 首跑两张表，上屏成了 [OBJECT OBJECT]）→ 取 label
      const txt = (v) => (v && typeof v === "object" ? String(v.label ?? v.title ?? v.name ?? v.text ?? v.key ?? "") : v);
      if (b.type === "DataTable" && Array.isArray(b.columns) && b.columns.some((c) => c && typeof c === "object")) { b.columns = b.columns.map(txt); fixes.push(`${at}: DataTable.columns 对象 → 取 label`); }
      if (b.type === "DataTable" && Array.isArray(b.rows)) b.rows = b.rows.map((r) => (Array.isArray(r) ? r.map((c) => (c && typeof c === "object" ? txt(c) : c)) : r));
      if (b.role !== undefined && !ROLES.includes(b.role)) { fixes.push(`${at}: role「${b.role}」→ secondary`); b.role = "secondary"; }
      // 背景层（layered-depth 放大 1.6 倍、淡化铺底）只放图示：文字积木铺在底下，淡字压在正文上读不清（20 篇里 6 条）
      if (b.role === "background" && !["Diagram", "Grid", "Figure"].includes(b.type)) { fixes.push(`${at}: ${b.type} 不能当背景层 → secondary`); b.role = "secondary"; }
      // 讲解型积木的常见形状错
      if (b.type === "Formula" && typeof b.active === "string" && /^\d+$/.test(b.active)) { b.active = +b.active; fixes.push(`${at}: Formula.active 字符串 → 数字`); }
      if (b.type === "CodeBlock" && Array.isArray(b.notes)) {
        for (const x of b.notes) if (x && typeof x.lines === "number") { x.lines = [x.lines, x.lines]; fixes.push(`${at}: CodeBlock notes.lines 单个数 → [n, n]`); }
        if (typeof b.active === "number" && (b.active < 0 || b.active >= b.notes.length)) { b.active = Math.max(0, Math.min(b.notes.length - 1, b.active)); fixes.push(`${at}: CodeBlock.active 越界 → ${b.active}`); }
      }
      if (b.type === "Figure" && Array.isArray(b.regions)) {
        // 模型常写成数组 [{id, x, y, w, h}] —— 转成对象
        const o = {}; b.regions.forEach((g, k) => { if (g && typeof g === "object") o[g.id || `r${k}`] = g; }); b.regions = o; fixes.push(`${at}: Figure.regions 数组 → 对象`);
      }
      // 推镜到一个占原图一半以上的区域：只放大 1.5 倍左右，却把画面边缘的字切掉（回放 2609.00006 的 Fig 7 底部说明）→ 改聚光
      if (b.type === "Figure" && b.mode === "zoom" && b.regions && typeof b.regions === "object") {
        const act = (Array.isArray(b.active) ? b.active : [b.active]).map((id) => b.regions[id]).filter(Boolean);
        if (act.length && act.every((g) => (Number(g.w) || 0) * (Number(g.h) || 0) >= 5000)) { b.mode = "spotlight"; delete b.minimap; fixes.push(`${at}: Figure 推镜区域太大（≥原图一半）→ 聚光`); }
      }
      if (b.type === "Figure" && b.regions && typeof b.regions === "object") {
        const ids = Object.keys(b.regions);
        if (typeof b.active === "number") { b.active = ids[b.active] ?? null; fixes.push(`${at}: Figure.active 下标 → 区域 id`); }
        const act = Array.isArray(b.active) ? b.active : b.active == null ? [] : [b.active];
        const keep = act.filter((a) => typeof a === "string" && b.regions[a]);
        if (keep.length !== act.length) { b.active = keep.length ? (keep.length === 1 ? keep[0] : keep) : null; fixes.push(`${at}: Figure.active 里有不存在的区域 → 去掉`); }
      }
    }
    // primary 恰好一个：没有就提第一个非 background/annotation 的积木；多了就把后面的降成 secondary
    const prim = s.blocks.filter((b) => b.role === "primary");
    if (!prim.length && s.blocks.length) {
      const c = s.blocks.find((b) => b.role !== "background" && b.role !== "annotation") || s.blocks[0];
      c.role = "primary"; fixes.push(`${at}: 没有 primary → 把 ${c.type} 设为 primary`);
    } else if (prim.length > 1) { prim.slice(1).forEach((b) => { b.role = "secondary"; }); fixes.push(`${at}: ${prim.length} 个 primary → 只留第一个`); }
    for (const b of s.blocks) if (b.role === "primary" && (b.delay ?? 0) > 150) { b.delay = 120; fixes.push(`${at}: primary delay → 120`); }
    if (s.blocks.length > MAX_BLOCKS) { fixes.push(`${at}: 积木 ${s.blocks.length} 个 → 留前 ${MAX_BLOCKS} 个`); s.blocks = s.blocks.slice(0, MAX_BLOCKS); }
    const ev = s.evidence;
    if (ev && typeof ev === "object") {
      if ((ev.type === "infer" || ev.type === "background") && ev.locator) { ev.locator = null; fixes.push(`${at}: ${ev.type} 的 locator → null`); }
      if ((ev.type === "fact" || ev.type === "supported") && !ev.locator) { ev.type = "infer"; fixes.push(`${at}: 没有 locator 的 fact/supported → infer`); }
      if (!["fact", "supported", "infer", "background"].includes(ev.type)) { ev.type = "infer"; ev.locator = null; fixes.push(`${at}: evidence.type 不合法 → infer`); }
    }
  });
  // 讲解序列（公式逐符号 / 代码逐段 / 图上逐区域）：相邻步同构图、且有同 id 的 Formula / CodeBlock / Figure / DataTable，
  // 就是有意连着讲同一块东西 —— 标 stable，别被下面的「连续 3 步换构图」拆掉（换构图会整屏重挂，高亮就不滑了）
  const WALK = new Set(["Formula", "CodeBlock", "Figure", "DataTable", "Grid", "Flow", "Gauge"]);
  for (let i = 1; i < spec.steps.length; i++) {
    const a = spec.steps[i - 1], c = spec.steps[i];
    if (!a || !c || c.stable || a.composition !== c.composition) continue;
    const ids = new Set((a.blocks || []).filter((x) => WALK.has(x?.type) && x.id).map((x) => `${x.type}#${x.id}`));
    if ((c.blocks || []).some((x) => WALK.has(x?.type) && x.id && ids.has(`${x.type}#${x.id}`))) { c.stable = true; fixes.push(`step ${i}: 与上一步连着讲同一块（同 id）→ stable`); }
  }
  // 扫参序列：相邻步同 id 的 BarChart 数值在变、却各自按本步最大值自动定纵轴 —— 比例尺每步悄悄变，柱高没法比
  // （N 从 1k 涨到 32k，每步最高的柱子都顶到天花板）。把整段序列的 max 锁成同一个值，和 BarChart 自动留的 12% 头部空间一致
  const barOf = (s, id) => (s?.blocks || []).find((x) => x?.type === "BarChart" && x.id === id && Array.isArray(x.items));
  for (let i = 0; i < spec.steps.length; i++) {
    for (const b of spec.steps[i]?.blocks || []) {
      if (b?.type !== "BarChart" || !b.id || !Array.isArray(b.items) || barOf(spec.steps[i - 1], b.id)) continue;
      const run = [b];
      for (let k = i + 1; barOf(spec.steps[k], b.id); k++) run.push(barOf(spec.steps[k], b.id));
      if (run.length < 2 || new Set(run.map((x) => JSON.stringify(x.items.map((it) => it?.value)))).size < 2) continue;
      const given = run.map((x) => x.max).filter((m) => typeof m === "number");
      if (given.length === run.length && new Set(given).size === 1) continue;
      const hi = Math.max(0, ...run.flatMap((x) => [...x.items.map((it) => Math.max(Number(it?.value) || 0, Number(it?.err?.[1]) || 0)), Number(x.reference?.value) || 0]));
      if (!(hi > 0)) continue;
      const top = Math.max(+(hi * 1.12).toPrecision(3), ...given);
      run.forEach((x) => { x.max = top; });
      fixes.push(`step ${i}~${i + run.length - 1}: BarChart「${b.id}」跨步扫参 → 纵轴上限统一锁成 ${top}`);
    }
  }
  // Gauge 扫参序列同理：相邻步同 id 的 input.max / capacity 不一致，正方形边长 / 填充高度就不能跨步比 —— 统一成序列里最大的那个
  const gaugeOf = (s, id) => (s?.blocks || []).find((x) => x?.type === "Gauge" && x.id === id);
  for (let i = 0; i < spec.steps.length; i++) {
    for (const b of spec.steps[i]?.blocks || []) {
      if (b?.type !== "Gauge" || !b.id || gaugeOf(spec.steps[i - 1], b.id)) continue;
      const run = [b];
      for (let k = i + 1; gaugeOf(spec.steps[k], b.id); k++) run.push(gaugeOf(spec.steps[k], b.id));
      if (run.length < 2) continue;
      const caps = run.map((x) => x.capacity).filter((v) => typeof v === "number" && v > 0);
      if (caps.length && new Set(caps).size > 1) { const c = Math.max(...caps); run.forEach((x) => { x.capacity = c; }); fixes.push(`step ${i}~${i + run.length - 1}: Gauge「${b.id}」capacity 不一致 → 统一成 ${c}`); }
      const maxes = run.map((x) => x.input?.max).filter((v) => typeof v === "number" && v > 0);
      if (maxes.length && new Set(maxes).size > 1) { const m = Math.max(...maxes); run.forEach((x) => { if (x.input) x.input.max = m; }); fixes.push(`step ${i}~${i + run.length - 1}: Gauge「${b.id}」input.max 不一致 → 统一成 ${m}`); }
    }
  }
  // 同构图连续 >2：把第三个起的换成邻居都没用的构图（有 stable 的除外）
  const alt = ["asymmetric-60-40", "split-screen", "rule-of-thirds", "centered-hero", "full-width-strip"];
  for (let i = 2; i < spec.steps.length; i++) {
    const a = spec.steps[i - 2], b = spec.steps[i - 1], c = spec.steps[i];
    if (c && a && b && !c.stable && a.composition === b.composition && b.composition === c.composition) {
      const next = spec.steps[i + 1]?.composition;
      const pick = alt.find((x) => x !== c.composition && x !== next) || "centered-hero";
      fixes.push(`step ${i}: 构图「${c.composition}」连续 3 步 → ${pick}`); c.composition = pick;
    }
  }
  return fixes;
}

/** 从章节目录把 spec 与期望步数一起读出来 */
export function checkChapterDir(dir, opts = {}) {
  const sp = path.join(dir, "spec.json");
  if (!fs.existsSync(sp)) return { spec: null, errs: [`没有 ${sp}`] };
  let spec;
  try { spec = JSON.parse(fs.readFileSync(sp, "utf8")); } catch (e) { return { spec: null, errs: [`spec.json 不是合法 JSON：${e.message}`] }; }
  let steps = opts.steps, narrations = opts.narrations;
  const nf = path.join(dir, "narrations.ts");
  if (fs.existsSync(nf)) {
    const src = fs.readFileSync(nf, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const arr = src.slice(src.indexOf("= [") + 3);
    const lines = arr.match(/^\s*"(?:[^"\\]|\\.)*",?\s*$/gm) || [];
    if (steps === undefined) steps = lines.length;
    if (!narrations) { try { narrations = lines.map((l) => JSON.parse(l.trim().replace(/,$/, ""))); } catch { narrations = undefined; } }
  }
  return { spec, errs: validateSpec(spec, { ...opts, steps, narrations }) };
}

// ── CLI ──
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith("--"));
  if (!dir) { console.error("用法: spec-check.mjs <chapter-dir> [--steps=N] [--figures=a.png,b.png]"); process.exit(2); }
  const stepsArg = args.find((a) => a.startsWith("--steps="));
  const figArg = args.find((a) => a.startsWith("--figures="));
  const opts = {};
  if (stepsArg) opts.steps = parseInt(stepsArg.slice(8), 10);
  if (figArg) opts.figures = figArg.slice(10).split(",").filter(Boolean);
  const { errs } = checkChapterDir(path.resolve(dir), opts);
  const hard = hardErrors(errs), soft = errs.filter((e) => e.startsWith(SOFT));
  soft.forEach((e) => console.log(`  ! ${e}`));
  if (hard.length) { console.log(`✗ spec-check ${path.basename(dir)}：${hard.length} 个问题`); hard.forEach((e) => console.log(`  ✗ ${e}`)); process.exit(1); }
  console.log(`✓ spec-check ${path.basename(dir)} 通过${soft.length ? `（${soft.length} 条建议）` : ""}`);
}
