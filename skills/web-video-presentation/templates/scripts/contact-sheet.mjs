/**
 * contact-sheet.mjs — stitch the per-step PNGs written by
 * `npm run smoke -- --shots` into one grid image per chapter, so a whole
 * chapter can be eyeballed in a single Read instead of N.
 *
 * Usage:  node scripts/contact-sheet.mjs [--cols=3] [--w=520]
 * Input:  render/smoke/ch<N>-step<M>.png     (from smoke --shots)
 * Output: render/sheets/ch<N>.png
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split("=")[1] : d;
};
const COLS = parseInt(arg("cols", "3"), 10);
const CW = parseInt(arg("w", "520"), 10);
const CH = Math.round((CW * 1080) / 1920);

const IN = path.join(process.cwd(), "render", "smoke");
const OUT = path.join(process.cwd(), "render", "sheets");
fs.mkdirSync(OUT, { recursive: true });

const files = fs.readdirSync(IN).filter((f) => /^ch\d+-step\d+\.png$/.test(f));
const byCh = new Map();
for (const f of files) {
  const [, c, s] = f.match(/^ch(\d+)-step(\d+)\.png$/);
  if (!byCh.has(+c)) byCh.set(+c, []);
  byCh.get(+c).push({ step: +s, file: path.join(IN, f) });
}

const browser = await chromium.launch();
for (const [ch, list] of [...byCh.entries()].sort((a, b) => a[0] - b[0])) {
  list.sort((a, b) => a.step - b.step);
  const rows = Math.ceil(list.length / COLS);
  const cells = list
    .map(
      (x) =>
        `<figure><img src="data:image/png;base64,${fs.readFileSync(x.file).toString("base64")}"><figcaption>step ${x.step}</figcaption></figure>`,
    )
    .join("");
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#20242a;font:600 13px/1.4 ui-monospace,monospace;color:#cfd5db}
    .g{display:grid;grid-template-columns:repeat(${COLS},${CW}px);gap:10px;padding:10px}
    figure{margin:0}
    img{width:${CW}px;height:${CH}px;display:block;border:1px solid #444}
    figcaption{padding:3px 2px}
  </style><div class="g">${cells}</div>`;
  const page = await browser.newPage({
    viewport: { width: COLS * (CW + 10) + 10, height: rows * (CH + 30) + 10 },
  });
  await page.setContent(html);
  await page.screenshot({ path: path.join(OUT, `ch${ch}.png`), fullPage: true });
  await page.close();
  console.log(`✓ render/sheets/ch${ch}.png  (${list.length} steps)`);
}
await browser.close();
