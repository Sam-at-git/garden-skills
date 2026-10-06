#!/usr/bin/env node
/**
 * fetch-paper-figures.mjs — harvest a paper's ORIGINAL figures so the video can
 * show them instead of guessing at a redraw.
 *
 * Why this exists: the single most recognisable asset a paper has is its own
 * Figure 1. Redrawing everything throws that away, and "原图未取得 → placeholder"
 * is almost never true for an arXiv paper — the HTML build ships the real
 * image files. This script goes and gets them.
 *
 * Usage:
 *   node fetch-paper-figures.mjs 1706.03762            # arXiv id (latest v)
 *   node fetch-paper-figures.mjs 1706.03762v7          # pinned version
 *   node fetch-paper-figures.mjs https://arxiv.org/html/1706.03762v7
 *   node fetch-paper-figures.mjs ./saved.html          # 另存的网页 + 同名 _files/ 目录
 *   node fetch-paper-figures.mjs ./saved.html --base https://arxiv.org/html/1706.03762v7
 *   node fetch-paper-figures.mjs 1706.03762 --out ./paper-figures --timeout 30
 *
 * OFFLINE / SANDBOX: if the network is blocked, don't hand-map filenames to
 * figure numbers — that is how Fig 8 and Fig 40 get swapped. Save the page from
 * a browser ("网页，全部") and feed the .html here instead: images are copied out
 * of the sibling `_files/` folder with zero network, and the figcaption → 图号
 * mapping in figures.md is generated exactly as in the online path. `--base` is
 * optional in that mode — only assets missing from disk fall back to it.
 *
 * Output (default ./paper-figures/):
 *   fig-01.png, fig-02a.png, …    the images, renamed by label
 *   figures.json                  machine-readable manifest
 *   figures.md                    human-readable index, paste into paper-digest §8
 *
 * Every network call has a hard `--timeout` (default 20s) and remote runs start
 * with a reachability preflight, so a blackholed host fails in seconds with the
 * offline route printed — it never hangs.
 *
 * Exit codes: 0 ok · 1 nothing found · 2 bad invocation / fetch failed.
 *
 * NOT for PDFs. If you only have a PDF, see PAPER-INTERPRETATION.md §6.5 —
 * `pdftoppm`/`pdfimages` or a manual crop, then hand-write figures.json.
 */

import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
if (!argv.length || argv.includes("-h") || argv.includes("--help")) {
  console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\*?|^ \* ?/gm, ""));
  process.exit(argv.length ? 0 : 2);
}
const src = argv[0];
const flag = (n, d) => {
  const i = argv.indexOf(n);
  return i === -1 ? d : argv[i + 1];
};
const outDir = path.resolve(flag("--out", "./paper-figures"));

/** arXiv id → HTML url. Anything already a URL passes through. */
function resolveSource(s) {
  if (/^https?:\/\//.test(s)) return { url: s, local: null };
  if (/^\d{4}\.\d{4,5}(v\d+)?$/.test(s)) return { url: `https://arxiv.org/html/${s}`, local: null };
  return { url: flag("--base", null), local: s };
}

const { url, local } = resolveSource(src);
// Directory the saved page lives in — "浏览器另存网页" drops its assets into a
// sibling `<name>_files/` folder, so relative <img src> resolve against it and
// no network is needed at all. --base is therefore OPTIONAL in local mode; it
// is only consulted for assets that aren't on disk.
const localDir = local ? path.dirname(path.resolve(local)) : null;

const TIMEOUT_MS = Number(flag("--timeout", "20")) * 1000;

/**
 * fetch with a hard deadline.
 *
 * Bare `fetch` has NO default timeout: inside a sandbox that silently blackholes
 * arxiv.org the script hangs forever with no output and no error — you only find
 * out by killing it. Every network call goes through here.
 */
async function fetchWithTimeout(u, extra = {}) {
  return fetch(u, {
    headers: { "user-agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    ...extra,
  });
}

/** Turn an AbortError into a message that names the actual problem. */
function netMessage(e, u) {
  if (e?.name === "TimeoutError" || e?.name === "AbortError") {
    return `${Math.round(TIMEOUT_MS / 1000)}s 内没有响应（网络被拦截或站点不可达）: ${u}`;
  }
  return `${e.message} — ${u}`;
}

/** Fail fast, with the offline route spelled out, rather than hanging. */
async function preflight() {
  try {
    await fetchWithTimeout(url, { method: "HEAD", redirect: "follow" });
  } catch (e) {
    console.error(`✗ 连不上 ${new URL(url).host} — ${netMessage(e, url)}`);
    console.error("");
    console.error("  沙箱 / 容器里通常就是网络被拦。改走「另存网页」路线（PAPER-INTERPRETATION.md §6.5）：");
    console.error("    1. 在有网的浏览器里打开该页，另存为「网页，全部」→ 得到 page.html + page_files/");
    console.error("    2. 把两者拷进本机，然后：");
    console.error(`       node ${path.basename(process.argv[1])} ./page.html --out ./paper-figures`);
    console.error("    图片直接从 page_files/ 读，不再走网络，figcaption→图号 的映射照常生成。");
    process.exit(2);
  }
}

async function getHtml() {
  if (local) return fs.readFileSync(local, "utf8");
  await preflight();
  const r = await fetchWithTimeout(url, { redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.text();
}

const strip = (s) =>
  s.replace(/<[^>]+>/g, " ").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
   .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/**
 * LaTeXML (what arXiv's HTML build emits) wraps every float as
 *   <figure id="S3.F1" class="ltx_figure"> <img src=…> <figcaption>Figure 1: …
 * Tables get id "S4.T1" and usually contain no <img>, so they drop out
 * naturally when we require at least one image.
 */
function parseFigures(html) {
  const out = [];
  const re = /<figure\b([^>]*)>([\s\S]*?)<\/figure>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1];
    const body = m[2];
    const id = (attrs.match(/id="([^"]+)"/) || [])[1] || "";
    const imgs = [...body.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((x) => x[1])
      .filter((s) => !/^data:/.test(s));
    if (!imgs.length) continue;
    const capRaw = (body.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/) || [])[1] || "";
    const caption = strip(capRaw);
    // "Figure 3:" / "Fig. 3" / "Table 1:" → canonical label
    // 书稿按章编号（Fig. 1.1 / Table 2.3），附录 Figure A1 —— 编号整段保留，只取第一个数字会让各章的图互相覆盖
    const tag = caption.match(/^(Figure|Fig\.?|Table|Tab\.?)\s*([A-Z]?\d+(?:\.\d+)*)/i);
    const label = tag
      ? `${/^tab/i.test(tag[1]) ? "Table" : "Fig"} ${tag[2]}`
      : id.replace(/^S\d+\./, "").replace(/^F/, "Fig ").replace(/^T/, "Table ");
    out.push({ id, label, caption, srcs: imgs });
  }
  return out;
}

const html = await getHtml().catch((e) => {
  console.error("✗ 取页面失败:", e.message);
  process.exit(2);
});

const figs = parseFigures(html);
if (!figs.length) {
  console.error("✗ 没解析到带图片的 figure。");
  console.error("  · arXiv 只有 PDF、没有 HTML 版时会这样 → 走 PAPER-INTERPRETATION.md §6.5 的 PDF 路径。");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const manifest = [];
let n = 0;

/**
 * Where does this <img src> actually live?
 *
 * In local mode a relative src is almost always a file the browser already
 * saved next to the HTML (`page_files/x1.png`), so disk wins over the network:
 * the whole point of the saved-page route is that it works with no connectivity.
 * Falls back to `--base` (or an absolute src) only when the file isn't there.
 */
function resolveAsset(srcAttr) {
  if (localDir && !/^https?:\/\//.test(srcAttr)) {
    const onDisk = path.resolve(localDir, decodeURIComponent(srcAttr.split(/[?#]/)[0]));
    if (fs.existsSync(onDisk)) return { disk: onDisk, source: path.relative(localDir, onDisk) };
  }
  if (!url) return null;
  const abs = new URL(srcAttr, url).toString();
  return { abs, source: abs };
}

let missingBase = 0;

for (const f of figs) {
  const raw = f.label.match(/([A-Z]?\d+(?:\.\d+)*)\s*$/)?.[1] ?? String(++n);
  const num = /^\d+$/.test(raw) ? raw.padStart(2, "0") : raw.replace(/\./g, "-");
  const kind = /^Table/i.test(f.label) ? "table" : "fig";
  for (let i = 0; i < f.srcs.length; i++) {
    const suffix = f.srcs.length > 1 ? String.fromCharCode(97 + i) : "";
    const tag = `${f.label}${suffix ? ` (${suffix})` : ""}`;
    const at = resolveAsset(f.srcs[i]);
    if (!at) {
      missingBase++;
      console.error(`✗ ${tag}  ${f.srcs[i]} — 本地找不到该文件，且没给 --base <原始页面 URL>`);
      continue;
    }
    const fromPath = at.disk ?? new URL(at.abs).pathname;
    const ext = (path.extname(fromPath) || ".png").split("?")[0];
    const file = `${kind}-${num}${suffix}${ext}`;
    const dest = path.join(outDir, file);
    try {
      if (at.disk) {
        fs.copyFileSync(at.disk, dest);
      } else {
        const r = await fetchWithTimeout(at.abs);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
      }
      manifest.push({ label: f.label, part: suffix || null, file, caption: f.caption, source: at.source });
      console.log(`✓ ${tag}  → ${file}${at.disk ? "  (本地)" : ""}`);
    } catch (e) {
      console.error(`✗ ${tag}  ${netMessage(e, at.source)}`);
    }
  }
}

if (missingBase > 0) {
  console.error(`\n! ${missingBase} 张图既不在本地也无法解析 —— 补一个 --base <原始页面 URL> 再跑一次。`);
}

const sourceLabel = url ?? path.resolve(local);
fs.writeFileSync(path.join(outDir, "figures.json"), JSON.stringify({ source: sourceLabel, figures: manifest }, null, 2));
fs.writeFileSync(
  path.join(outDir, "figures.md"),
  [
    `# 论文原图清单`,
    ``,
    `来源：${sourceLabel}`,
    ``,
    `> ⚠️ **用前先确认许可**：arXiv 各篇 license 不同（perpetual non-exclusive / CC-BY / CC-BY-NC …）。`,
    `> 逐条填下面的「可用」列，再决定 cite 原图还是 redraw。做法见 PAPER-INTERPRETATION.md §6.5。`,
    ``,
    `| 标签 | 文件 | 可用 | 复用决策 | caption |`,
    `|---|---|---|---|---|`,
    ...manifest.map((x) => `| ${x.label}${x.part ? ` (${x.part})` : ""} | \`${x.file}\` | ? | cite / redraw / animate | ${x.caption.slice(0, 120)} |`),
    ``,
  ].join("\n"),
);

console.log(`\n▸ ${manifest.length} 张图 → ${outDir}`);
console.log(`▸ 清单：figures.json / figures.md（把 figures.md 的表贴进 paper-digest §8）`);
