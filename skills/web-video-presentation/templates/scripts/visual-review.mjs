#!/usr/bin/env node
/**
 * visual-review.mjs — 视觉评审闸：把 smoke --shots 的逐步截图交给一个能看图的模型，
 * 按「已知的、机器闸看不出来的画面事故」清单逐帧找问题。
 *
 * 为什么要有它：layout:check 读源码、smoke 只判「有没有画出东西」，下面这些事故
 * 两道闸都全绿，以前只能靠人翻 contact sheet 才发现 ——
 *   • 中文 max-width 写成 ch 单位，标题被挤成每行三四个字的窄列
 *   • SVG 曲线漏 fill="none"，画面里凭空一块黑楔形
 *   • 柱图的柱名写进 slot，柱子被顶离 0 线、底部高低不齐
 *   • grid 场景漏 align-content: center，内容贴顶、下半屏全白
 *   • 字体里没有的字形（花体 𝒪 之类）渲染成方框「豆腐块」
 *
 * 前置：npm run smoke -- --shots   （写 render/smoke/ch<N>-step<M>.png，N 是注册表 0 起下标）
 *
 * 用法：npm run visual:review
 *       npm run visual:review -- --chapter=3        只评第 4 章（0 起，和 smoke 一致）
 *       npm run visual:review -- --require          没配模型 / 一章都没评成 → exit 3（无人值守流水线用）
 *       npm run visual:review -- --no-confirm       跳过二审（省请求，误报会变多）
 *       npm run visual:review -- --passes=2 --votes=3   一审遍数（取并集）/ 二审票数（过半才算）
 *       npm run visual:review -- --batch=6          一审每次最多几张图（默认整章一次）
 *       npm run visual:review -- --concurrency=3
 *
 * 模型配置（OpenAI 兼容 /chat/completions，模型必须支持图片输入）：
 *   VISION_BASE_URL / VISION_API_KEY / VISION_MODEL
 *   没配时退回 MiniMax：MINIMAX_API_KEY（或 ~/.mmx/config.json 的 api_key）
 *     + MINIMAX_BASE_URL（默认 https://api.minimax.io/v1）+ MiniMax-M3（实测能看图）
 *   VISUAL_REVIEW_USAGE_LOG=<file.jsonl>：每次请求的 token 用量追加进去（可选）
 *
 * 两审制（误报会把修复循环带偏，漏报等于没这道闸，两头都要管）：
 *   一审：每章一次请求，本章所有步的截图 + 清单，模型列出问题（step / 规则 / 看到了什么）。
 *         跑 --passes 遍（默认 2）取并集 —— 单遍会随机漏报，实测同一章同一黑块三遍里漏一遍。
 *   二审：一审的每条 fail 单独拿那一帧独立问 --votes 次（默认 3）「这个问题确实存在吗」，
 *         过半确认才算 fail，否则降成 warn —— 单票二审偶尔会附和一审的误报。
 *   规则的 fail / warn 由下面的 RULES 决定，不由模型决定。
 *
 * 退出码：0 通过（或跳过）· 1 有确认过的 fail · 3 --require 下没配模型或一章都没评成
 * 输出：终端按闸格式（✗ fail / ! warn / ✓）；render/visual-review.json（每章结论，给看板 / 验收页用）
 *
 * 跳过 ≠ 通过：没配模型时 exit 0 并明说「已跳过」。人工看 contact sheet（npm run sheet）照样要做 ——
 * 这道闸只能拦清单里的事故，拦不住「这一步讲得不清楚」「构图没重点」这类判断。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const has = (k) => process.argv.includes(`--${k}`);
const ONLY = arg("chapter", null) === null ? null : parseInt(arg("chapter"), 10);
const REQUIRE = has("require");
const CONFIRM = !has("no-confirm");
const CONCURRENCY = Math.max(1, parseInt(arg("concurrency", "3"), 10));
const BATCH = Math.max(1, parseInt(arg("batch", "0"), 10) || Infinity);
const PASSES = Math.max(1, parseInt(arg("passes", "2"), 10));
const VOTES = Math.max(1, parseInt(arg("votes", "3"), 10));
const ROOT = process.cwd();
const SHOTS = path.join(ROOT, "render", "smoke");
const OUT = path.join(ROOT, "render", "visual-review.json");

// ── 清单：规则 id · 严重度 · 给模型看的描述。严重度只在这里定，模型改不了 ──────────
const RULES = [
  ["cjk-narrow-column", "fail", "中文标题或正文被挤成很窄的一列：每行只有两三个到五六个字、折成很多行，而同一块区域横向明明还有大片空白"],
  ["top-heavy", "fail", "内容全部挤在画面上部，下半屏大面积空白，整体明显没有垂直居中（有意的上下留白、标题页的居中构图不算）"],
  ["black-blob", "fail", "画面里出现意外的黑色或深色实心块：一条曲线/连线本该只是细线，却和它两端的连线围出一块实心的月牙形、弯刀形、楔形；或一块没有意义的大面积深色色块"],
  ["bar-baseline", "fail", "柱状图的柱子没有从同一条基线（0 线）起：柱子底部高低不齐、悬空、或被标签顶起来"],
  ["overlap", "fail", "文字和文字、或文字和图形真的互相覆盖（笔画叠在笔画上、字压在图形上），导致读不清。只是挨得近、中英文之间没空格，不算"],
  ["clipped", "fail", "文字或主要元素被画面边缘或容器边界裁掉一截、伸出画面之外"],
  ["tofu", "fail", "缺字：本该是一个字符的地方显示成空心方框、带叉的方框或问号方块（字体里没有这个字形，常见于花体 𝒪、数学符号、生僻字）"],
  ["raw-tex", "fail", "公式没有渲染：画面上直接出现 TeX 源码，比如 \\frac、^{…}、_{…}、\\sum、$…$"],
  ["broken-image", "fail", "图片坏了：裂图图标、本该有图的地方是空白框、只显示 alt 文字（框里没有任何说明文字）"],
  // 写明了「原图未取得 / 待补」的占位框是流水线有意留的缺图（另有缺图清单），改代码修不好，只提醒
  ["placeholder", "warn", "占位框：虚线框或灰框里写着「原图未取得」「待补」「placeholder」之类的说明文字，代替了真图"],
  ["off-center", "warn", "本该居中的主体整体明显偏向一侧，甚至有一部分跑到画面外"],
  ["low-contrast", "warn", "文字和背景颜色太接近，几乎看不清"],
  ["empty", "warn", "整帧除了页眉页脚之外几乎没有内容"],
];
const RULE = Object.fromEntries(RULES.map(([id, sev, desc]) => [id, { sev, desc }]));

// ── 模型配置 ───────────────────────────────────────────────────────────────
function resolveModel() {
  if (process.env.VISION_BASE_URL && process.env.VISION_API_KEY) {
    return { base: process.env.VISION_BASE_URL, key: process.env.VISION_API_KEY, model: process.env.VISION_MODEL || "MiniMax-M3" };
  }
  let key = process.env.MINIMAX_API_KEY;
  if (!key) {
    try { key = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".mmx", "config.json"), "utf8")).api_key; } catch { key = null; }
  }
  if (!key) return null;
  // mmx 的 MINIMAX_BASE_URL 常常不带 /v1（TTS 用），chat 要带
  let base = process.env.MINIMAX_BASE_URL || "https://api.minimax.io/v1";
  if (!/\/v1\/?$/.test(base)) base = base.replace(/\/$/, "") + "/v1";
  return { base, key, model: process.env.VISION_MODEL || "MiniMax-M3" };
}

// ── 章节下标 → 目录 / 标题（报告里要能直接定位到文件）─────────────────────────
function chapterMap() {
  const reg = path.join(ROOT, "src", "registry", "chapters.ts");
  if (!fs.existsSync(reg)) return [];
  const src = fs.readFileSync(reg, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const dirOf = {};
  for (const m of src.matchAll(/import\s+(\w+)\s+from\s+["']\.\.\/chapters\/([^/"']+)\//g)) dirOf[m[1]] = m[2];
  const body = src.slice(src.indexOf("CHAPTERS"));
  const out = [];
  for (const m of body.matchAll(/\{([^{}]*Component\s*:\s*(\w+)[^{}]*)\}/g)) {
    const title = /title\s*:\s*["'`]([^"'`]*)/.exec(m[1])?.[1] || "";
    out.push({ dir: dirOf[m[2]] || m[2], title });
  }
  return out;
}

function shotsByChapter() {
  if (!fs.existsSync(SHOTS)) return new Map();
  const by = new Map();
  for (const f of fs.readdirSync(SHOTS)) {
    const m = /^ch(\d+)-step(\d+)\.png$/.exec(f);
    if (!m) continue;
    const c = +m[1];
    if (ONLY !== null && c !== ONLY) continue;
    if (!by.has(c)) by.set(c, []);
    by.get(c).push({ step: +m[2], file: path.join(SHOTS, f) });
  }
  for (const list of by.values()) list.sort((a, b) => a.step - b.step);
  return new Map([...by.entries()].sort((a, b) => a[0] - b[0]));
}

// ── 请求 ───────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const img = (file) => ({ type: "image_url", image_url: { url: `data:image/png;base64,${fs.readFileSync(file).toString("base64")}` } });

function logUsage(cfg, u, ms) {
  const f = process.env.VISUAL_REVIEW_USAGE_LOG;
  if (!f) return;
  try {
    fs.appendFileSync(f, JSON.stringify({
      stage: "visual-review", model: cfg.model, at: new Date().toISOString(), requests: 1, ms,
      tokens: u ? { input: u.prompt_tokens || 0, output: u.completion_tokens || 0,
                    reasoning: u.completion_tokens_details?.reasoning_tokens || 0, total: u.total_tokens || 0 } : null,
    }) + "\n");
  } catch { /* 用量记不上不影响评审 */ }
}

async function ask(cfg, content) {
  let last;
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    try {
      const res = await fetch(cfg.base.replace(/\/$/, "") + "/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${cfg.key}` },
        body: JSON.stringify({ model: cfg.model, max_tokens: 16384, temperature: 0.1, messages: [{ role: "user", content }] }),
        signal: AbortSignal.timeout(240_000),
      });
      const text = await res.text();
      let d; try { d = JSON.parse(text); } catch { d = null; }
      logUsage(cfg, d?.usage, Date.now() - t0);
      // MiniMax 出错时可能是 HTTP 200 + base_resp.status_code ≠ 0
      const bizErr = d?.base_resp && d.base_resp.status_code !== 0 ? d.base_resp.status_msg : null;
      if (!res.ok || bizErr || !d?.choices?.length) {
        last = `HTTP ${res.status}：${bizErr || d?.error?.message || text.slice(0, 200)}`;
        if (res.status === 400 || res.status === 401 || res.status === 403) break;   // 重试也没用
      } else {
        return String(d.choices[0].message?.content || "");
      }
    } catch (e) {
      last = e.message;
    }
    await sleep(3000 * (i + 1));
  }
  throw new Error(last);
}

/** 从回复里拿 JSON：剥掉开头的思考段和 ``` 围栏，取第一个 { 到最后一个 } */
function parseJson(text) {
  let t = String(text).replace(/^\s*<think>[\s\S]*?<\/think>/, "");
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(t);
  if (fence) t = fence[1];
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error(`回复里没有 JSON：${t.trim().slice(0, 120)}`);
  return JSON.parse(t.slice(a, b + 1));
}

const RULES_TEXT = RULES.map(([id, , desc]) => `- \`${id}\`：${desc}`).join("\n");

function reviewPrompt(steps) {
  return `下面是一部 16:9 网页演示片某一章的逐步截图，共 ${steps.length} 帧，每帧前面标了 step 号。
截图四周的灰色区域是舞台外的留白，不算画面；页眉、页脚里的小号等宽字（论文引用、章节号、进度）是有意设计的，不要报。

请逐帧检查，**只找下面清单里的问题**：

${RULES_TEXT}

要求：
- 只报你在图上**清楚看到**的问题，拿不准就不报。正常的设计选择（大面积留白的标题页、左右分栏、小号注释文字）不是问题。
- 每条写明 step 号、规则 id、以及你具体看到了什么（位置 + 现象，一句话）。
- **每一帧都要把清单从头到尾过一遍**：一帧可能同时有好几个问题，一章可能好几帧有问题，不要只报最显眼的那一个。
  小处也要看：公式和符号里的方框缺字、标题折行。
- 同一帧同一规则只报一次。

只输出 JSON，不要别的文字：
{"issues":[{"step":0,"rule":"black-blob","what":"右侧流程图中间有一块黑色楔形遮住了两个节点"}]}
没有问题就输出 {"issues":[]}`;
}

function confirmPrompt(step, rule, what) {
  return `这是一部 16:9 网页演示片的一帧（step ${step}）。截图四周的灰色区域是舞台外留白，不算画面。

有人报告这一帧有问题：
- 类型：${RULE[rule].desc}
- 描述：${what}

先客观描述报告里说的那个位置**实际**是什么样子，再独立判断问题是否**确实存在**，且明显到观众一眼就会注意到。
报告经常是错的，不要因为有人报告就附和；要放大仔细找才看得出来的、或者拿不准的，一律算 false。

只输出 JSON：{"seen":"那个位置实际的样子，一两句","confirmed":true 或 false,"reason":"一句话"}`;
}

async function reviewBatch(cfg, shots) {
  const content = [{ type: "text", text: reviewPrompt(shots) }];
  for (const s of shots) { content.push({ type: "text", text: `step ${s.step}：` }); content.push(img(s.file)); }
  // 思考型模型偶尔把输出预算耗在思考里、回一个空答案：重问一次
  for (let i = 0; ; i++) {
    try { const parsed = parseJson(await ask(cfg, content)); return Array.isArray(parsed.issues) ? parsed.issues : []; }
    catch (e) { if (i >= 1) throw e; }
  }
}

async function reviewChapter(cfg, idx, shots, meta) {
  const size = Math.min(BATCH, shots.length);
  const batches = [];
  for (let i = 0; i < shots.length; i += size) batches.push(shots.slice(i, i + size));
  // 各遍独立并发；某一遍失败不要紧，全部失败才算这章没评成
  const runs = await Promise.allSettled(Array.from({ length: PASSES }, async () => {
    const out = [];
    for (const b of batches) out.push(...await reviewBatch(cfg, b));
    return out;
  }));
  const ok = runs.filter((r) => r.status === "fulfilled");
  if (!ok.length) throw runs[0].reason;
  const raw = ok.flatMap((r) => r.value);
  const byStep = new Map(shots.map((s) => [s.step, s.file]));
  const seen = new Set();
  const issues = [];
  for (const it of raw) {
    const step = Number(it?.step), rule = String(it?.rule || "");
    if (!byStep.has(step) || !RULE[rule]) continue;           // 编出来的 step / 清单外的规则不收
    const k = `${step}:${rule}`;
    if (seen.has(k)) continue;
    seen.add(k);
    issues.push({ step, rule, severity: RULE[rule].sev, what: String(it.what || "").slice(0, 200) });
  }
  if (CONFIRM) {
    await Promise.all(issues.filter((x) => x.severity === "fail").map(async (it) => {
      const votes = await Promise.allSettled(Array.from({ length: VOTES }, () =>
        ask(cfg, [{ type: "text", text: confirmPrompt(it.step, it.rule, it.what) }, img(byStep.get(it.step))]).then(parseJson)));
      const got = votes.filter((v) => v.status === "fulfilled").map((v) => v.value);
      const yes = got.filter((r) => r.confirmed === true).length;
      it.votes = `${yes}/${VOTES}`;
      // 过半按总票数算：二审请求失败的票算「没确认」—— 不能拿没确认的结论去卡流水线
      if (yes * 2 <= VOTES) {
        it.severity = "warn"; it.unconfirmed = true;
        const no = got.find((r) => r.confirmed !== true);
        it.confirm = no ? String(no.seen ? `${no.seen}；${no.reason || ""}` : no.reason || "").slice(0, 240)
                        : `二审失败：${String(votes.find((v) => v.status === "rejected")?.reason?.message || "").slice(0, 120)}`;
      }
    }));
  }
  return { index: idx, dir: meta?.dir || `ch${idx}`, title: meta?.title || "", steps: shots.length, status: "reviewed", issues };
}

// ── 主流程 ─────────────────────────────────────────────────────────────────
const byCh = shotsByChapter();
if (!byCh.size) {
  console.log(`✗ render/smoke/ 里没有 ch<N>-step<M>.png —— 先跑 npm run smoke -- --shots`);
  process.exit(1);
}
const cfg = resolveModel();
if (!cfg) {
  const msg = "visual:review 已跳过：没配置视觉模型（VISION_BASE_URL + VISION_API_KEY + VISION_MODEL，或 MINIMAX_API_KEY）。跳过 ≠ 通过";
  console.log(`! ${msg}`);
  console.log(`\n▸ visual:review 0 章 · 0 fail · 1 warn（已跳过）`);
  fs.writeFileSync(OUT, JSON.stringify({ status: "skipped", reason: msg, chapters: [] }, null, 2) + "\n");
  process.exit(REQUIRE ? 3 : 0);
}

const metas = chapterMap();
const jobs = [...byCh.entries()];
const results = [];

// ── 先确认模型真能看图 ───────────────────────────────────────────────────────
// 有的模型收了图不报错：deepseek-v4-pro 是 HTTP 200 + 「我无法查看这张图片」。不探测的话整轮评审拿到的是空话，
// 解析成「没问题」，精修静默失效（2610.04437v1）。拿第一张截图问大标题，和 spec 里这一步的标题对一下
const NO_VISION = /无法(查看|看到|识别|读取|处理|打开)|看不(到|了|见)|没有(看到|收到)[^。]{0,6}图|不能(查看|看)|未(能)?(收到|看到)[^。]{0,6}图|cannot (see|view|process)|can't (see|view)|unable to (see|view|process)|no image/i;
const VISION_FALLBACK = { "api.deepseek.com": "deepseek-flash" };   // 同一端点里能看图的模型（实测）
function stepTitle(idx, step) {
  try {
    const sp = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "chapters", metas[idx]?.dir || "", "spec.json"), "utf8"));
    return String(sp.steps?.[step]?.title || "");
  } catch { return ""; }
}
async function seesImage(c) {
  const [idx0, shots0] = jobs[0];
  const ans = await ask(c, [{ type: "text", text: "这张截图里最上面的大标题是什么？只回答标题原文，不要解释。" }, img(shots0[0].file)]);
  if (NO_VISION.test(ans)) return { ok: false, ans };
  const want = [...stepTitle(idx0, shots0[0].step).replace(/\s+/g, "")];
  if (want.length >= 4) {
    const got = new Set(ans.replace(/\s+/g, ""));
    const hit = want.filter((ch) => got.has(ch)).length / want.length;
    if (hit < 0.5) return { ok: false, ans };
  }
  return { ok: true, ans };
}
{
  // 探测请求本身出错（网络 / 限流）不拦：交给正式评审照常重试、报错
  const probe = await seesImage(cfg).catch((e) => ({ ok: true, err: e.message }));
  if (!probe.ok) {
    const host = (() => { try { return new URL(cfg.base).host; } catch { return ""; } })();
    const alt = process.env.VISION_FALLBACK_MODEL || VISION_FALLBACK[host];
    console.log(`! 模型 ${cfg.model} 看不了图（问截图标题，回「${probe.ans.replace(/\s+/g, " ").slice(0, 40)}」）${alt ? `，试同一端点的 ${alt}` : ""}`);
    const p2 = alt ? await seesImage({ ...cfg, model: alt }).catch((e) => ({ ok: true, err: e.message })) : { ok: false };
    if (alt && p2.ok) cfg.model = alt;
    else {
      const msg = `visual:review 已跳过：视觉模型 ${cfg.model}${alt ? ` / ${alt}` : ""} 看不了图（收图不报错，但答不出截图内容）。跳过 ≠ 通过 —— 在管理页换一个能看图的模型，或设 VISION_FALLBACK_MODEL`;
      console.log(`! ${msg}`);
      console.log(`\n▸ visual:review 0 章 · 0 fail · 1 warn（已跳过）`);
      fs.writeFileSync(OUT, JSON.stringify({ status: "skipped", reason: msg, chapters: [] }, null, 2) + "\n");
      process.exit(REQUIRE ? 3 : 0);
    }
  }
}
let next = 0;
console.log(`▸ visual:review  ${jobs.length} 章 · 模型 ${cfg.model} · 一审 ${PASSES} 遍${CONFIRM ? ` · 二审 ${VOTES} 票过半` : " · 不二审"}`);
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, async () => {
  while (next < jobs.length) {
    const [idx, shots] = jobs[next++];
    try {
      results.push(await reviewChapter(cfg, idx, shots, metas[idx]));
    } catch (e) {
      results.push({ index: idx, dir: metas[idx]?.dir || `ch${idx}`, title: metas[idx]?.title || "", steps: shots.length,
                     status: "error", error: e.message.slice(0, 300), issues: [] });
    }
  }
}));
results.sort((a, b) => a.index - b.index);

let fails = 0, warns = 0, errors = 0;
for (const r of results) {
  const label = `ch${r.index} ${r.dir}`;
  if (r.status === "error") {
    errors++; warns++;
    console.log(`! ${label}  没评成：${r.error}`);
    continue;
  }
  const f = r.issues.filter((x) => x.severity === "fail"), w = r.issues.filter((x) => x.severity === "warn");
  fails += f.length; warns += w.length;
  console.log(`${f.length ? "✗" : w.length ? "!" : "✓"} ${label}  (${f.length} fail, ${w.length} warn · ${r.steps} 步)`);
  for (const x of f) {
    console.log(`  ✗ step ${x.step} [${x.rule}] ${x.what}${x.votes ? `（二审 ${x.votes} 确认）` : ""}`);
    console.log(`      截图 render/smoke/ch${r.index}-step${x.step}.png · 章节目录 src/chapters/${r.dir}/（tsx 里 step === ${x.step} 那一支）`);
  }
  for (const x of w) console.log(`  ! step ${x.step} [${x.rule}] ${x.what}${x.unconfirmed ? `（二审 ${x.votes || "0/" + VOTES} 未过半：${x.confirm || ""}）` : ""}`);
}

fs.writeFileSync(OUT, JSON.stringify({
  status: errors === results.length ? "error" : "reviewed", model: cfg.model, confirm: CONFIRM, passes: PASSES, votes: VOTES,
  at: new Date().toISOString(), fails, warns, chapters: results,
}, null, 2) + "\n");

console.log(`\n▸ visual:review ${results.length} 章 · ${fails} fail · ${warns} warn${errors ? `（${errors} 章没评成）` : ""}`);
if (errors === results.length) {
  console.log("! 一章都没评成（模型不支持图片 / key 不对 / 网络）—— 视觉层没覆盖到，跳过 ≠ 通过");
  process.exit(REQUIRE ? 3 : 0);
}
if (fails) {
  console.log("✗ 画面有确认过的问题 —— 按上面的 step / 规则改对应章节，改完 smoke --shots 再评一次");
  process.exit(1);
}
console.log("✓ 视觉评审通过（只覆盖清单里的事故；contact sheet 仍要人看）");
