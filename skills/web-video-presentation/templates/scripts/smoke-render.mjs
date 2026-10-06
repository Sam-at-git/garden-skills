#!/usr/bin/env node
/**
 * smoke-render.mjs — does the app actually RENDER? Walk every step in a real
 * browser and fail on a blank screen.
 *
 * Why this exists (a real incident): a chapter's narrations.ts had an unescaped
 * quote inside a Chinese string. The structural gates were all green — layout:check
 * is pure source analysis with no DOM, and `?layout=1` needs a human eye — but
 * esbuild's dependency scan died on the parse error, react-dom never got
 * pre-bundled, and every page was blank white while still answering HTTP 200.
 * Nothing in the pipeline ever rendered the app, so the failure travelled all
 * the way to screen-recording before anyone noticed.
 *
 * This closes that hole. It is deliberately dumb: it does not judge design,
 * only "is there anything on the screen at all, and did anything throw".
 *
 *   FAIL  blank stage · uncaught exception · console error · missing .scene
 *   WARN  step with no [data-role="primary"] · failed sub-resource request
 *
 * Run it AFTER `npm run build` — build catches parse/type errors without a
 * browser, this catches what only shows up once the app is running.
 *
 * Usage:
 *   npm run smoke                          # dev server on :5173, every step
 *   npm run smoke -- --url=http://localhost:5174/
 *   npm run smoke -- --max-steps=12        # quick pass while iterating
 *   npm run smoke -- --chapter=3           # just one chapter (0-indexed)
 *   npm run smoke -- --shots               # write a PNG per step to render/smoke/
 *
 * Screenshots of FAILING steps are always written to render/smoke/, so a red
 * run leaves you the evidence.
 *
 * Requires Playwright (same resolver as record-auto.mjs). If it isn't installed
 * the run SKIPS with exit 0 and a loud notice — a skipped smoke test must be
 * reported as skipped, never as passed.
 *
 * Exit codes: 0 ok / skipped · 1 at least one FAIL · 2 bad invocation.
 */

import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/* ── args ────────────────────────────────────────────────────────────── */
const arg = (k, d) => {
  const a = process.argv.find((x) => x === `--${k}` || x.startsWith(`--${k}=`));
  if (!a) return d;
  return a.includes("=") ? a.split("=").slice(1).join("=") : true;
};

const URL_BASE = String(arg("url", "http://localhost:5173/"));
const MAX_STEPS = parseInt(String(arg("max-steps", "0")), 10);
const ONLY_CHAPTER = arg("chapter", null) === null ? null : parseInt(String(arg("chapter", "0")), 10);
const SHOTS = arg("shots", false) === true;
const SETTLE_MS = parseInt(String(arg("settle", "220")), 10);
const OUT_DIR = path.join(process.cwd(), "render", "smoke");
// --dom：每步再跑一遍确定性画面检查（dom-check.mjs：重叠 / 裁切 / 窄列 / TeX 残留 / 坏图 / 偏上），
// 只汇报；--dom-strict 时 fail 级的算进 smoke 失败。--dom-json=<文件> 写出逐步结果（和 visual:review 对照用）。
// --dom-settle：跑检查前每步等多久（入场动画、Flow / Grid 的过程动画要跑完），默认 1500ms
const DOM = arg("dom", false) === true || arg("dom-strict", false) === true || !!arg("dom-json", null);
const DOM_STRICT = arg("dom-strict", false) === true;
const DOM_JSON = arg("dom-json", null);
const DOM_SETTLE = parseInt(String(arg("dom-settle", "1500")), 10);
let DOM_CHECK = null;
if (DOM) {
  try { ({ DOM_CHECK } = await import("./dom-check.mjs")); }
  catch { console.log("! 没有 scripts/dom-check.mjs（老工程的快照），跳过 DOM 检查"); }
}
const domResults = [];

/** Sub-resources whose failure must not redden the gate (offline font CDNs, absent audio). */
const BENIGN = [/fonts\.googleapis\.com/, /fonts\.gstatic\.com/, /\/audio\/.*\.mp3$/, /favicon/];
const isBenign = (s) => BENIGN.some((re) => re.test(s));

/* ── resolve playwright from wherever it happens to live ─────────────── */
// Mirrors record-auto.mjs: a project dep first, then a global @playwright/cli.
function loadPlaywright() {
  const attempt = (from) => {
    try {
      return createRequire(from)("playwright");
    } catch {
      return null;
    }
  };
  let pw = attempt(path.join(process.cwd(), "package.json"));
  if (pw) return pw;
  let globalRoot = null;
  try {
    globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
  } catch {
    /* npm not on PATH */
  }
  const candidates = [
    globalRoot && path.join(globalRoot, "@playwright/cli/"),
    "/usr/local/lib/node_modules/@playwright/cli/",
    "/usr/lib/node_modules/@playwright/cli/",
    path.join(process.env.HOME ?? "", ".local/lib/node_modules/@playwright/cli/"),
  ].filter(Boolean);
  for (const c of candidates) {
    pw = attempt(c);
    if (pw) return pw;
  }
  return null;
}

const playwright = loadPlaywright();
if (!playwright) {
  console.log("");
  console.log("⚠ 跳过渲染烟雾测试 —— 没找到 playwright。");
  console.log("  白屏 / 运行时报错这一类问题本次【未被覆盖】，汇报时必须说明「smoke 已跳过」。");
  console.log("  装一个再跑：  npm i -D playwright && npx playwright install chromium");
  console.log("");
  process.exit(0);
}

/* ── find something to test against ──────────────────────────────────── */
// Prefer a dev server that's already up (that's the app as it's being worked
// on). If nothing is listening, fall back to serving the last `npm run build`
// output with `vite preview`, so `npm run verify` is self-contained and doesn't
// depend on the human having a terminal open.
const reachable = async (u, ms = 4000) => {
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(ms) });
    return r.ok;
  } catch {
    return false;
  }
};

let target = URL_BASE;
let preview = null;

if (!(await reachable(URL_BASE))) {
  const dist = path.join(process.cwd(), "dist", "index.html");
  if (!fs.existsSync(dist)) {
    console.error(`✗ 连不上 ${URL_BASE}，也没有 dist/ 可供预览。`);
    console.error("  → 起开发服务器：npm run dev（端口被占会自动换，用 --url= 指过来）");
    console.error("  → 或者先构建一次：npm run build");
    process.exit(2);
  }
  // Ask the OS for a port instead of hard-coding one. A fixed port silently
  // tested the WRONG app: a leftover preview from another project was still
  // listening, --strictPort made our spawn fail, and the reachability poll
  // happily succeeded against the stranger — a 1-chapter scaffold reported
  // "82 steps / 14 chapters".
  const net = await import("node:net");
  const port = await new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const p = srv.address().port;
      srv.close(() => resolve(p));
    });
  });
  target = `http://localhost:${port}/`;
  console.log(`▸ 开发服务器没在跑 —— 用 vite preview 起 dist/ (:${port})`);
  const { spawn } = await import("node:child_process");
  // detached:true puts vite in its own process group. `npx` spawns the real
  // server as a GRANDCHILD, so killing the npx pid alone leaves the port held
  // — which is how the stray preview above survived in the first place.
  preview = spawn("npx", ["vite", "preview", "--port", String(port), "--strictPort"], {
    stdio: "ignore",
    detached: true,
  });
  let up = false;
  for (let i = 0; i < 30 && !up; i++) {
    await new Promise((r) => setTimeout(r, 400));
    up = await reachable(target, 1500);
  }
  if (!up) {
    try { process.kill(-preview.pid, "SIGTERM"); } catch { /* already gone */ }
    console.error(`✗ vite preview 没能在 12s 内起来（:${port}）`);
    process.exit(2);
  }
  // Detached children keep the parent's event loop alive — without this the
  // script prints its verdict and then hangs forever instead of exiting.
  preview.unref();
}

const shutdown = () => {
  if (!preview) return;
  try { process.kill(-preview.pid, "SIGTERM"); } catch { /* already gone */ }
  preview = null;
};
process.on("exit", shutdown);
process.on("SIGINT", () => { shutdown(); process.exit(130); });

/* ── launch ──────────────────────────────────────────────────────────── */
// 2000×1160 renders the 1920×1080 stage at scale 1.0 (see record-auto.mjs).
const { chromium } = playwright;
let browser;
try {
  browser = await chromium.launch({ channel: "chrome" });
} catch {
  browser = await chromium.launch();
}
const context = await browser.newContext({ viewport: { width: 2000, height: 1160 }, deviceScaleFactor: 1 });
const page = await context.newPage();

const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
page.on("console", (m) => {
  if (m.type() !== "error") return;
  // A resource 404 arrives as a console error whose text names no URL at all
  // ("Failed to load resource: … 404"), so the benign list has to be matched
  // against the location instead — otherwise a missing favicon reddens the run.
  const where = m.location()?.url ?? "";
  if (isBenign(m.text()) || isBenign(where)) return;
  // A missing asset is a content problem, not a render failure: report it with
  // the URL (which the message itself omits) but don't fail the gate on it.
  if (/Failed to load resource/i.test(m.text())) {
    failedRequests.push(`${where || "?"} — ${m.text()}`);
    return;
  }
  consoleErrors.push(where ? `${m.text()}  (${where})` : m.text());
});
page.on("pageerror", (e) => pageErrors.push(e.message));
page.on("requestfailed", (r) => {
  if (!isBenign(r.url())) failedRequests.push(`${r.url()} — ${r.failure()?.errorText ?? "failed"}`);
});

/**
 * How much is actually ON the screen?
 *
 * Text alone is not the test: plenty of steps are a single SVG diagram with no
 * copy at all, and a chapter that renders only a stray label is still broken.
 * So count both — visible text length and drawn elements (svg/canvas/img) that
 * occupy real area — and let the caller decide.
 */
const measureInk = () => page.evaluate(() => {
  const scene = document.querySelector(".scene");
  if (!scene) return { scene: false, text: 0, marks: 0, primary: 0, area: 0 };
  const vis = (el) => {
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) return null;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2 ? r : null;
  };
  let text = 0;
  let marks = 0;
  let area = 0;
  for (const el of scene.querySelectorAll("*")) {
    const r = vis(el);
    if (!r) continue;
    if (/^(svg|canvas|img|video)$/i.test(el.tagName)) {
      marks++;
      area += r.width * r.height;
    }
  }
  const t = scene.innerText?.trim() ?? "";
  text = t.length;
  const primaries = [...scene.querySelectorAll('[data-role="primary"]')].filter(vis);
  // 溢出：规格章的内容区（标题 + 积木）超出场景的安全区底边。自动缩放有下限，缩到头还放不下就会被裁，
  // 以前只有人看图才发现（2609.24220v1 第 5 章第 8/12 步）。
  let overflow = 0;
  const sc = scene.querySelector(".sc-scene");
  if (sc) {
    const r = sc.getBoundingClientRect(), padB = parseFloat(getComputedStyle(sc).paddingBottom) || 0;
    const limit = r.bottom - padB * 0.4;
    sc.querySelectorAll(".sc-scene-head, .sc-spec-fit > *, .sc-body > *, .sc-spec-cell").forEach((e) => { overflow = Math.max(overflow, e.getBoundingClientRect().bottom - limit); });
  }
  return { scene: true, text, marks, primary: primaries.length, area: Math.round(area), overflow: Math.round(overflow) };
});

const cursor = () => page.evaluate(() => window.__presentationCursor?.() ?? null);

const results = [];
let fails = 0;
let warns = 0;

console.log(`▸ smoke-render · ${target} · 2000×1160`);
// 站点托管时播放器默认 auto，会盖一层 AutoStartGate 遮罩：QA 一律显式退回静音手动模式（以前靠 site-patch 补，
// 模板自己不带 —— DOM 检查的 elementFromPoint 全打在遮罩上，重叠一条都查不出来）
const qaTarget = target + (target.includes("?") ? "&" : "?") + "auto=0";
await page.goto(qaTarget, { waitUntil: "networkidle" });

/* ── gate 0: did the app mount at all? ───────────────────────────────── */
const mounted = await page.evaluate(() => {
  const root = document.getElementById("root");
  return {
    rootChildren: root?.children.length ?? 0,
    stage: !!document.querySelector(".stage-frame"),
    scene: !!document.querySelector(".scene"),
  };
});
if (!mounted.rootChildren || !mounted.stage || !mounted.scene) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(OUT_DIR, "blank.png") });
  console.error("");
  console.error("✗ 白屏 —— 应用没有挂载。");
  console.error(`  #root 子元素 ${mounted.rootChildren} · .stage-frame ${mounted.stage} · .scene ${mounted.scene}`);
  if (pageErrors.length) console.error(`  未捕获异常：\n    ${pageErrors.join("\n    ")}`);
  if (consoleErrors.length) console.error(`  console error：\n    ${consoleErrors.slice(0, 5).join("\n    ")}`);
  console.error(`  截图：${path.join(OUT_DIR, "blank.png")}`);
  console.error("");
  console.error("  最常见的原因：某个 .ts/.tsx 解析失败（中文串里的裸直引号是头号嫌疑），");
  console.error("  esbuild 依赖扫描随之失败 → 预打包缺失 → 整页空白，但 HTTP 仍是 200。");
  console.error("  先跑 `npm run build`，它会把出问题的文件和行号直接指出来。");
  await browser.close();
  shutdown();
  process.exit(1);
}

/* ── walk every step ─────────────────────────────────────────────────── */
await page.keyboard.press("Home");
await page.waitForTimeout(SETTLE_MS);

if (ONLY_CHAPTER !== null) {
  // Chapter keys 1-9 jump directly; beyond that, step forward until we arrive.
  if (ONLY_CHAPTER < 9) await page.keyboard.press(String(ONLY_CHAPTER + 1));
  let guard = 0;
  while ((await cursor())?.chapter !== ONLY_CHAPTER && guard++ < 400) {
    await page.keyboard.press("ArrowRight");
  }
  await page.waitForTimeout(SETTLE_MS);
}

let prev = null;
let visited = 0;
const seen = new Set();

while (true) {
  const cur = await cursor();
  if (!cur) {
    console.error("✗ 页面没有暴露 __presentationCursor —— App.tsx 被改过？");
    fails++;
    break;
  }
  if (ONLY_CHAPTER !== null && cur.chapter !== ONLY_CHAPTER) break;
  const key = `${cur.chapter}:${cur.step}`;
  if (seen.has(key)) break; // End of deck — next() stopped moving the cursor.
  seen.add(key);

  const ink = await measureInk();
  const blank = !ink.scene || (ink.text === 0 && ink.marks === 0);
  const thin = !blank && ink.text < 2 && ink.area < 4000;

  if (blank || thin) {
    fails++;
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const shot = path.join(OUT_DIR, `fail-ch${cur.chapter}-step${cur.step}.png`);
    await page.screenshot({ path: shot });
    console.error(`  ✗ ch${cur.chapter} step${cur.step}  空屏（文字 ${ink.text} 字 · 图元 ${ink.marks}）→ ${shot}`);
  } else {
    if (ink.overflow > 12) {
      fails++;
      fs.mkdirSync(OUT_DIR, { recursive: true });
      const shot = path.join(OUT_DIR, `fail-ch${cur.chapter}-step${cur.step}.png`);
      await page.screenshot({ path: shot });
      console.error(`  ✗ ch${cur.chapter} step${cur.step}  内容超出画面底部 ${ink.overflow}px → ${shot}`);
    }
    if (ink.primary === 0) {
      warns++;
      console.log(`  ! ch${cur.chapter} step${cur.step}  没有可见的 [data-role="primary"]`);
    }
    // --shots 时每一步都留一帧：没有 primary 标记只是 warn，不等于没画面。
    // （老模板 / 手写的章节不打 data-role，以前这里直接跳过，封面和 contact sheet 全空。）
    if (SHOTS) {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      await page.screenshot({ path: path.join(OUT_DIR, `ch${cur.chapter}-step${cur.step}.png`) });
    }
  }

  results.push({ ...cur, ...ink });
  if (DOM_CHECK) {
    if (DOM_SETTLE > SETTLE_MS) await page.waitForTimeout(DOM_SETTLE - SETTLE_MS);
    const issues = await page.evaluate(DOM_CHECK).catch((e) => [{ rule: "dom-check", sev: "warn", what: String(e).slice(0, 120) }]);
    domResults.push({ chapter: cur.chapter, step: cur.step, issues });
    for (const it of issues) {
      const mark = it.sev === "fail" ? "✗" : "!";
      console.log(`  ${mark} ch${cur.chapter} step${cur.step} [${it.rule}] ${it.what}`);
      if (it.sev === "fail" && DOM_STRICT) fails++; else warns++;
    }
  }
  visited++;
  if (MAX_STEPS && visited >= MAX_STEPS) break;
  if (prev && prev.chapter === cur.chapter && prev.step === cur.step) break;
  prev = cur;

  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(SETTLE_MS);
}

// 走到末尾后的那次「下一步」会进片尾（EndCredits）：确认它渲染出来了
if (ONLY_CHAPTER === null && !MAX_STEPS) {
  await page.waitForTimeout(SETTLE_MS);
  const ec = await page.evaluate(() => {
    const el = document.querySelector("[data-credits]");
    return el ? { text: (el.textContent || "").trim().length } : null;
  });
  if (ec && ec.text < 4) {
    fails++;
    console.error("  ✗ 片尾是空的");
  } else if (ec && SHOTS) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(OUT_DIR, "credits.png") });
  }
}

await browser.close();

/* ── report ──────────────────────────────────────────────────────────── */
const chapters = [...new Set(results.map((r) => r.chapter))].length;
console.log("");
console.log(`▸ 走了 ${visited} 步 / ${chapters} 章`);

if (pageErrors.length) {
  fails += pageErrors.length;
  console.error(`✗ ${pageErrors.length} 个未捕获异常：`);
  for (const e of pageErrors.slice(0, 8)) console.error(`    ${e}`);
}
if (consoleErrors.length) {
  fails += consoleErrors.length;
  console.error(`✗ ${consoleErrors.length} 条 console error：`);
  for (const e of consoleErrors.slice(0, 8)) console.error(`    ${e}`);
}
if (failedRequests.length) {
  warns += failedRequests.length;
  console.log(`! ${failedRequests.length} 个子资源请求失败：`);
  for (const e of failedRequests.slice(0, 5)) console.log(`    ${e}`);
}

if (DOM_CHECK) {
  const all = domResults.flatMap((r) => r.issues), f = all.filter((i) => i.sev === "fail").length;
  console.log(`▸ DOM 检查：${f} fail · ${all.length - f} warn${DOM_STRICT ? "" : "（不计入 smoke 结果，--dom-strict 才算）"}`);
  if (DOM_JSON) fs.writeFileSync(String(DOM_JSON), JSON.stringify(domResults, null, 1));
}
console.log("");
if (fails > 0) {
  console.error(`✗ smoke 失败 · ${fails} fail · ${warns} warn`);
} else {
  console.log(`✓ smoke 通过 · ${visited} 步全部渲染出内容 · ${warns} warn`);
}
// Explicit: tear the preview down and leave, rather than waiting on a stray
// handle. Any spawned server is in our own process group, so nothing survives.
shutdown();
process.exit(fails > 0 ? 1 : 0);
