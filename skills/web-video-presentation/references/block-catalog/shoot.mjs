// 积木样张截图：起 vite preview → 跳到第 2 章（样张章）→ 逐步截 .stage-fitter
// 每步一张定格图；MID 里列的步额外在动画进行中截一张
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
const require = createRequire(process.cwd() + "/package.json");
const { chromium } = require("playwright");
const OUT = process.argv[2];
const keys = JSON.parse(fs.readFileSync("keys.json", "utf8"));
const MID = { bignumber: 350, grid1: 450, grid2: 650, flow1: 1500, flow2: 1100, gauge2: 450, fig2: 450, reveal2: 120 };
fs.mkdirSync(OUT, { recursive: true });
const port = await new Promise((r) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const srv = spawn("node_modules/.bin/vite", ["preview", "--port", String(port), "--strictPort"], { stdio: "ignore", detached: true });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1 });
await page.goto(`http://localhost:${port}/`);
await page.waitForTimeout(1500);
const cursor = () => page.evaluate(() => window.__presentationCursor?.());
await page.keyboard.press("Home"); await page.waitForTimeout(400);
await page.keyboard.press("2"); await page.waitForTimeout(400);
const stage = page.locator(".stage-fitter");
for (let i = 0; i < keys.length; i++) {
  const c = await cursor();
  if (c.chapter !== 1 || c.step !== i) { console.error("光标错位", c, i); break; }
  const k = keys[i];
  if (MID[k]) { await page.waitForTimeout(MID[k]); await stage.screenshot({ path: `${OUT}/${k}-mid.png` }); await page.waitForTimeout(5000 - MID[k]); }
  else await page.waitForTimeout(5000);
  await stage.screenshot({ path: `${OUT}/${k}.png` });
  console.log("✓", i, k);
  await page.keyboard.press("ArrowRight");
}
await browser.close();
process.kill(-srv.pid);
