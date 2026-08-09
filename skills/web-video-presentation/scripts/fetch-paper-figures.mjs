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
 *   node fetch-paper-figures.mjs ./saved.html --base https://arxiv.org/html/1706.03762v7
 *   node fetch-paper-figures.mjs 1706.03762 --out ./paper-figures
 *
 * Output (default ./paper-figures/):
 *   fig-01.png, fig-02a.png, …    the images, renamed by label
 *   figures.json                  machine-readable manifest
 *   figures.md                    human-readable index, paste into paper-digest §8
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
if (local && !url) {
  console.error("✗ 本地 HTML 需要 --base <原始页面 URL> 才能解析相对图片地址。");
  process.exit(2);
}

async function getHtml() {
  if (local) return fs.readFileSync(local, "utf8");
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" }, redirect: "follow" });
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
    const tag = caption.match(/^(Figure|Fig\.?|Table)\s*(\d+)/i);
    const label = tag
      ? `${/table/i.test(tag[1]) ? "Table" : "Fig"} ${tag[2]}`
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

for (const f of figs) {
  const num = String(f.label.match(/(\d+)/)?.[1] ?? ++n).padStart(2, "0");
  const kind = /^Table/i.test(f.label) ? "table" : "fig";
  for (let i = 0; i < f.srcs.length; i++) {
    const suffix = f.srcs.length > 1 ? String.fromCharCode(97 + i) : "";
    const abs = new URL(f.srcs[i], url).toString();
    const ext = (path.extname(new URL(abs).pathname) || ".png").split("?")[0];
    const file = `${kind}-${num}${suffix}${ext}`;
    const dest = path.join(outDir, file);
    try {
      const r = await fetch(abs, { headers: { "user-agent": "Mozilla/5.0" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
      manifest.push({ label: f.label, part: suffix || null, file, caption: f.caption, source: abs });
      console.log(`✓ ${f.label}${suffix ? ` (${suffix})` : ""}  → ${file}`);
    } catch (e) {
      console.error(`✗ ${f.label}${suffix ? ` (${suffix})` : ""}  ${abs} — ${e.message}`);
    }
  }
}

fs.writeFileSync(path.join(outDir, "figures.json"), JSON.stringify({ source: url, figures: manifest }, null, 2));
fs.writeFileSync(
  path.join(outDir, "figures.md"),
  [
    `# 论文原图清单`,
    ``,
    `来源：${url}`,
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
