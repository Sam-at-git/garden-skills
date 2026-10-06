#!/usr/bin/env node
/**
 * record-auto.mjs — screen-record the whole deck playing in Auto mode.
 *
 * This is the headless half of references/RECORDING.md: no desktop, no OBS,
 * no human holding the mouse. Point it at a running dev server and it drives
 * `?auto=1` from the first step to the last while capturing the stage.
 *
 * Why not playwright-cli's `video-start`: it hard-codes an 800×492 recording
 * size with no flag to change it — fine for debugging, useless for a
 * deliverable. Driving Playwright directly lets us record at the viewport's
 * native size.
 *
 * Two outputs, both needed by scripts/build-video.mjs:
 *
 *   render/raw.webm    the recording, viewport-sized, silent
 *   render/cues.json   { crop, leadInHintMs, cues: [{chapter, step, t}, …] }
 *
 * cues.json is the important half. Auto mode advances on `audio.ended`, so
 * every step boundary drifts by whatever the browser spent loading that mp3 —
 * small each time, ~16s across a 107-step deck in one real run. Measuring the
 * real boundaries in-page lets the muxer lay the narration back down on
 * exactly those frames instead of hoping a pre-stitched track holds sync.
 *
 * The default 2000×1160 viewport is derived, not guessed: useStageScale
 * leaves ~2% / ~3% of margin (40px / 34.8px here), so 2000×1160 renders the
 * 1920×1080 stage at scale exactly 1.0 — captured pixel-for-pixel, cropped later with no
 * resampling. The stage rect is measured anyway and written to cues.json, so
 * a theme or hook that changes those margins still crops correctly.
 *
 * Usage:
 *   npm run video:record
 *   npm run video:record -- --url=http://localhost:5174/
 *   npm run video:record -- --max-steps=6      # smoke-test the pipeline
 *
 * Requires Playwright. If the project doesn't depend on it, the resolver
 * below also looks inside a global @playwright/cli install.
 */

import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/* ── resolve playwright from wherever it happens to live ─────────────── */
function loadPlaywright() {
  const tried = [];
  const attempt = (from) => {
    try {
      return createRequire(from)("playwright");
    } catch {
      tried.push(from);
      return null;
    }
  };

  // 1. a project dependency
  let pw = attempt(path.join(process.cwd(), "package.json"));
  if (pw) return pw;

  // 2. a global @playwright/cli (what the playwright-cli skill installs)
  let globalRoot = null;
  try {
    globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
  } catch {
    /* npm not on PATH — fall through to the fixed guesses */
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

  console.error(
    "✗ 找不到 playwright。装一个：\n" +
      "    npm i -D playwright && npx playwright install chromium\n" +
      "  或者装全局 CLI：npm i -g @playwright/cli\n" +
      `  已尝试：\n${tried.map((t) => "    " + t).join("\n")}`,
  );
  process.exit(2);
}

const { chromium } = loadPlaywright();

/* ── args ────────────────────────────────────────────────────────────── */
const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split("=").slice(1).join("=") : d;
};

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "render");
const SEGMENTS = JSON.parse(fs.readFileSync(path.join(ROOT, "audio-segments.json"), "utf8"));

const URL = arg("url", "http://localhost:5173/");
/** Stop after N steps — smoke-test the pipeline without a full-length run. */
const MAX_STEPS = parseInt(arg("max-steps", "0"), 10);
const VW = parseInt(arg("width", "2000"), 10);
const VH = parseInt(arg("height", "1160"), 10);
const HARD_TIMEOUT_MS = parseInt(arg("timeout-min", "90"), 10) * 60 * 1000;

fs.mkdirSync(OUT_DIR, { recursive: true });

const stamp = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/* ── launch ──────────────────────────────────────────────────────────── */
// Prefer the system Chrome channel (a Playwright install without downloaded
// browsers is common); fall back to the bundled chromium.
let browser;
const launchArgs = ["--autoplay-policy=no-user-gesture-required", "--mute-audio"];
try {
  browser = await chromium.launch({ channel: "chrome", args: launchArgs });
} catch {
  browser = await chromium.launch({ args: launchArgs });
}

const context = await browser.newContext({
  viewport: { width: VW, height: VH },
  deviceScaleFactor: 1,
  recordVideo: { dir: OUT_DIR, size: { width: VW, height: VH } },
});

const page = await context.newPage();
// Playwright's screencast begins with the page, so this is video t≈0.
const tPageCreated = Date.now();

page.on("console", (m) => {
  if (m.type() === "error") console.error("  [page error]", m.text());
});

console.log(`▸ ${URL}?auto=1  ·  ${VW}×${VH}  ·  ${SEGMENTS.length} 步`);
await page.goto(`${URL}?auto=1`, { waitUntil: "networkidle" });

/* ── measure the stage so the muxer can crop exactly ─────────────────── */
const crop = await page.evaluate(() => {
  const el = document.querySelector(".stage-frame");
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    x: Math.round(r.left),
    y: Math.round(r.top),
    w: Math.round(r.width),
    h: Math.round(r.height),
  };
});
if (!crop) {
  console.error("✗ 页面里找不到 .stage-frame —— dev server 起来了吗？");
  process.exit(1);
}
if (crop.w !== 1920 || crop.h !== 1080) {
  console.log(
    `! 舞台实际渲染成 ${crop.w}×${crop.h}（不是 1:1）。裁切会照这个尺寸走，` +
      `出片时缩放到 1920×1080；想要无缩放，把视口调大到 ${1920 + (VW - crop.w)}×${1080 + (VH - crop.h)}。`,
  );
}

/* ── arm the cursor poller, then start playback ──────────────────────── */
// Hold the poller until playback actually starts — an entry recorded before
// the gate is dismissed maps every segment to the wrong boundary.
await page.evaluate(() => {
  window.__armed = false;
  window.__cues = [];
  window.__poll = setInterval(() => {
    if (!window.__armed) return;
    // 片尾（EndCredits）开始的时刻：出片按它把片尾整段留下
    const ec = window.__presentationCredits;
    if (ec && ec.active && window.__creditsT == null) {
      window.__creditsT = performance.now() - window.__t0;
      window.__creditsMs = ec.durationMs;
    }
    const c = window.__presentationCursor && window.__presentationCursor();
    if (!c) return;
    const last = window.__cues[window.__cues.length - 1];
    if (!last || last.chapter !== c.chapter || last.step !== c.step) {
      window.__cues.push({ chapter: c.chapter, step: c.step, t: performance.now() - window.__t0 });
    }
  }, 25);
});

// Click the gate rather than press Space. The gate carries `data-no-advance`,
// so a click can never leak through to the stepper. (Space is handled safely
// too — see components/AutoStartGate.tsx — but a click assumes nothing about
// listener ordering.)
await page.click(".auto-gate");
const tStart = Date.now();
// Seed step 0 at t=0: its audio starts on this gesture, and seeding stops the
// poller from also pushing the step already on screen.
await page.evaluate(() => {
  window.__t0 = performance.now();
  window.__cues = [{ chapter: 0, step: 0, t: 0 }];
  window.__armed = true;
});
console.log("▸ 开始播放…");

/* ── wait it out ─────────────────────────────────────────────────────── */
let lastCount = 0;
let lastChange = Date.now();

for (;;) {
  await page.waitForTimeout(2000);
  const n = await page.evaluate(() => window.__cues.length);
  if (n !== lastCount) {
    lastCount = n;
    lastChange = Date.now();
    if (n % 10 === 0 || n === SEGMENTS.length) {
      process.stdout.write(`  ${n}/${SEGMENTS.length} 步 · 已录 ${stamp(Date.now() - tStart)}\n`);
    }
  }
  if (MAX_STEPS && n >= MAX_STEPS) {
    console.log(`  (--max-steps=${MAX_STEPS} 冒烟测试，提前停)`);
    break;
  }
  // 片尾在放：等它放完（参考文献多时会超过两分钟，不算卡住）
  const ec = await page.evaluate(() => (window.__creditsT == null ? null : { t: window.__creditsT, ms: window.__creditsMs, now: performance.now() - window.__t0 }));
  if (ec) {
    if (ec.now > ec.t + ec.ms + 1500) break;
    continue;
  }
  // Done: every step has been shown AND the last one has had time to finish.
  // （有片尾的工程在最后一步放完后会自动进片尾，走上面那条；这里是没有片尾的老工程）
  if (n >= SEGMENTS.length && Date.now() - lastChange > 40_000) break;
  // Stuck: nothing advanced for two minutes — bail rather than record dead air.
  if (Date.now() - lastChange > 120_000) {
    console.error(`✗ 卡在第 ${n} 步，停止录制。检查那一步的 mp3 是否存在、能否解码。`);
    break;
  }
  if (Date.now() - tStart > HARD_TIMEOUT_MS) {
    console.error("✗ 超过硬超时，停止录制。");
    break;
  }
}

const cues = await page.evaluate(() => window.__cues);
const credits = await page.evaluate(() => (window.__creditsT == null ? null : { t: window.__creditsT, ms: window.__creditsMs }));
fs.writeFileSync(
  path.join(OUT_DIR, "cues.json"),
  JSON.stringify(
    {
      crop,
      // Rough guess at how much video sits before playback starts. The muxer
      // prefers to detect this from the frames (the start gate is a dark
      // overlay that vanishes the moment playback begins) and only falls
      // back to this number.
      leadInHintMs: tStart - tPageCreated,
      cues,
      // 片尾开始时刻（相对第 0 步，ms）与时长；没有片尾为 null
      credits,
    },
    null,
    1,
  ),
);

const video = page.video();
await context.close(); // finalizes the webm
fs.renameSync(await video.path(), path.join(OUT_DIR, "raw.webm"));
await browser.close();

console.log(`\n✓ render/raw.webm  ·  录了 ${stamp(Date.now() - tStart)}`);
console.log(`✓ render/cues.json ·  ${cues.length}/${SEGMENTS.length} 个步骤边界`);
if (!MAX_STEPS && cues.length < SEGMENTS.length) {
  console.error(`✗ 只走到 ${cues.length} 步 —— 成片会缺尾巴，检查音频是否都能播。`);
  process.exit(1);
}
console.log("▸ 下一步：npm run video:mux");
