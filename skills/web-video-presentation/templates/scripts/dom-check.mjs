/**
 * dom-check.mjs — 页面里跑的确定性画面检查（smoke-render --dom 用）。
 *
 * 视觉评审（LLM 看截图）报的问题里，大部分其实不用看图：在浏览器里量一下就知道。
 * 这里只查 DOM 能确定的几类，结果和 visual:review 用同一套规则名，方便对照：
 *   overlap           文字被别的元素盖住（每行取 3 个点 elementFromPoint，最上层不是这行字自己）
 *   clipped           文字超出 overflow 不可见的祖先 / 舞台边界（有意的省略号截断除外）
 *   cjk-narrow-column 中文被挤成窄列（≥8 字、≥3 行、平均每行 ≤5 字）；最后一行只剩 1~2 字记 warn
 *   raw-tex           画面上出现 TeX 源码 / [object Object] / 字面 \n / undefined / NaN（代码块和 KaTeX 除外）
 *   broken-image      图片没加载出来（fail）；采样几乎全白（warn）
 *   top-heavy         下方空白 >30% 舞台高度且 ≥ 上方空白的 2 倍（warn）
 *
 * 用法：page.evaluate(DOM_CHECK) → [{ rule, sev: "fail"|"warn", what }]
 * 只在 .stage-frame 里查；背景层（.sc-spec-bg）、aria-hidden、透明度很低的（ghost / dim）跳过。
 */
export const DOM_CHECK = () => {
  const stage = document.querySelector(".stage-frame");
  if (!stage) return [];
  const out = [];
  const add = (rule, sev, what) => { if (out.length < 40) out.push({ rule, sev, what: what.replace(/\s+/g, " ").slice(0, 160) }); };
  const S = stage.getBoundingClientRect();
  const short = (t) => (t.length > 18 ? t.slice(0, 18) + "…" : t);
  const label = (el) => short(((el && (el.innerText || el.textContent)) || el?.className?.baseVal || el?.className || el?.tagName || "?").toString().trim());

  // 有效透明度（祖先相乘）和可见性
  const op = (el) => { let o = 1; for (let e = el; e && e !== stage; e = e.parentElement) { const s = getComputedStyle(e); if (s.visibility === "hidden" || s.display === "none") return 0; o *= Number(s.opacity); } return o; };
  const skip = (el) => !el || el.closest(".sc-spec-bg, [aria-hidden='true'], script, style, .katex-mathml") || op(el) < 0.2;

  // ── 收集文字行 ──
  const lines = []; // { el, rect, text }
  const blocks = new Map(); // el → { text, rects }
  const nodes = []; // 每个文字节点自己折成的行（<br> 分开的是好几个节点，不算折行）
  const tw = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const t = n.nodeValue.trim();
    if (!t) continue;
    const el = n.parentElement;
    if (skip(el)) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter((r) => r.width > 2 && r.height > 6);
    if (!rects.length) continue;
    for (const r of rects) lines.push({ el, rect: r, text: t });
    nodes.push({ el, text: t, rects });
    const b = blocks.get(el) || { text: "", rects: [] }; b.text += t; b.rects.push(...rects); blocks.set(el, b);
  }

  // ── overlap：每行取 3 个采样点，从上往下看这一点上叠着的元素（elementsFromPoint），在碰到这行字自己之前
  //    有「看得见的」东西挡着才算被盖住：图片 / svg / 有背景色的块 / 这一点上正好有字的元素。透明的包装层跳过
  //    （标题区的外层容器罩在出处行上方，elementFromPoint 只看最上层会误报）
  const related = (a, b) => a === b || a.contains(b) || b.contains(a);
  const textAt = (el, x, y) => {
    for (const c of el.childNodes) {
      if (c.nodeType !== 3 || !c.nodeValue.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(c);
      for (const r of rg.getClientRects()) if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
    }
    return false;
  };
  const opaque = (el, x, y) => {
    if (/^(IMG|CANVAS|VIDEO)$/.test(el.tagName) || el instanceof SVGGraphicsElement && el.tagName !== "svg" && el.tagName !== "g") return true;
    const s = getComputedStyle(el);
    if (s.backgroundImage !== "none") return true;
    const m = s.backgroundColor.match(/rgba?\(([^)]+)\)/); if (m) { const a = m[1].split(",").map(Number); if ((a[3] ?? 1) > 0.05) return true; }
    return textAt(el, x, y);
  };
  const seen = new Set();
  for (const L of lines) {
    const r = L.rect;
    if (r.width * r.height < 120) continue;
    const y = r.top + r.height / 2;
    let hit = 0, by = null;
    for (const fx of [0.2, 0.5, 0.8]) {
      const x = r.left + r.width * fx;
      if (x < S.left || x > S.right || y < S.top || y > S.bottom) continue;
      for (const top of document.elementsFromPoint(x, y)) {
        if (!stage.contains(top) || related(top, L.el)) break;            // 先碰到了自己（或自己的祖先 / 后代）：没被盖
        if (top.parentElement && related(top.parentElement, L.el) && getComputedStyle(top).display.startsWith("inline")) break; // <sub>、<em>
        if (opaque(top, x, y)) { hit++; by = top; break; }
      }
    }
    if (hit >= 2) {
      const onImg = /^(IMG|CANVAS)$/.test(by.tagName);
      const key = `${label(L.el)}|${onImg ? "img" : label(by)}`;
      if (!seen.has(key)) { seen.add(key); add("overlap", "fail", onImg ? `「${label(L.el)}」压在原图上，盖住图里的内容` : `「${label(L.el)}」被「${label(by)}」盖住`); }
    }
  }

  // ── clipped：文字行超出 overflow 不可见的祖先，或超出舞台 ──
  const clipBoxes = new Map();
  const clipOf = (el) => {
    if (clipBoxes.has(el)) return clipBoxes.get(el);
    const res = [];
    for (let e = el.parentElement; e && e !== stage.parentElement; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (e === stage || /hidden|clip|auto|scroll/.test(s.overflowX + s.overflowY)) res.push(e);
    }
    clipBoxes.set(el, res); return res;
  };
  const clippedSeen = new Set();
  for (const L of lines) {
    if (getComputedStyle(L.el).textOverflow === "ellipsis") continue;
    for (const c of clipOf(L.el)) {
      const b = c.getBoundingClientRect();
      const dx = Math.max(b.left - L.rect.left, L.rect.right - b.right), dy = Math.max(b.top - L.rect.top, L.rect.bottom - b.bottom);
      // 纵向容差按字号：文字选区含字形上下的留白，200px 的大数字天然比 line-height 0.95 的行框高一截，不是被裁
      const fs = parseFloat(getComputedStyle(L.el).fontSize) || 20;
      if (dx > 4 || dy > Math.max(4, fs * 0.25)) {
        const k = label(L.el);
        if (!clippedSeen.has(k)) { clippedSeen.add(k); add("clipped", "fail", `「${k}」超出${c === stage ? "画面" : "容器"}${dx > 4 ? ` ${Math.round(dx)}px（横向）` : ` ${Math.round(dy)}px（纵向）`}`); }
        break;
      }
    }
  }

  // ── narrow：一个文字节点自己折成 ≥3 行、平均每行不到 5.5 个字号宽 = 被挤成窄列；最后一行不到 2.2 个字号宽 = 孤字 ──
  // 按像素宽度 ÷ 字号算（中英混排也准），只看单个节点的折行（\n / <br> 主动分开的行不算）
  const cjk = (t) => (t.match(/[㐀-鿿豈-﫿]/g) || []).length;
  const narrowSeen = new Set();
  for (const N of nodes) {
    if (cjk(N.text) < 4 || narrowSeen.has(N.el)) continue;
    const byLine = new Map();
    for (const r of N.rects) { const k = Math.round(r.top / 4); byLine.set(k, (byLine.get(k) || 0) + r.width); }
    const widths = [...byLine.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
    const fs = parseFloat(getComputedStyle(N.el).fontSize) || 20, n = widths.length;
    if (n < 2) continue;
    const avg = widths.reduce((a, b) => a + b, 0) / n / fs;
    if (n >= 3 && avg < 5.5) { narrowSeen.add(N.el); add("cjk-narrow-column", "fail", `「${short(N.text)}」折成 ${n} 行，每行约 ${avg.toFixed(1)} 个字宽`); }
    else if (widths[n - 1] < fs * 2.2 && widths[0] > fs * 6) { narrowSeen.add(N.el); add("cjk-narrow-column", "warn", `「${short(N.text)}」最后一行只剩一两个字`); }
  }

  // ── raw-tex：画面上的源码痕迹 ──
  // undefined / NaN / null 只在整段就是它时才算（正文里讲「loss 变成 NaN」是内容，不是残留）
  const RAW = /\\[a-zA-Z]{2,}|[_^]\{[^}]*\}|\$\\|\[object Object\]|(?<![A-Za-z])\\n(?![A-Za-z])|^(undefined|NaN|null)$/i;
  const rawSeen = new Set();
  for (const [el, b] of blocks) {
    if (el.closest("pre, code, .sc-code, .katex, .sc-mono")) continue;
    const m = b.text.match(RAW);
    if (m && !rawSeen.has(m[0])) { rawSeen.add(m[0]); add("raw-tex", "fail", `画面上出现源码「${m[0]}」：「${short(b.text)}」`); }
  }

  // ── broken-image ──
  for (const img of stage.querySelectorAll("img")) {
    if (skip(img) || img.closest(".fl-mini")) continue;
    const r = img.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    if (img.complete && img.naturalWidth === 0) { add("broken-image", "fail", `图片没加载出来：${img.getAttribute("src")}`); continue; }
    try {
      const cv = document.createElement("canvas"); cv.width = 48; cv.height = 48;
      const g = cv.getContext("2d"); g.drawImage(img, 0, 0, 48, 48);
      const d = g.getImageData(0, 0, 48, 48).data; let ink = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 16 && (d[i] + d[i + 1] + d[i + 2]) / 3 < 235) ink++;
      if (ink / (48 * 48) < 0.006) add("broken-image", "warn", `图片几乎是空白：${img.getAttribute("src")}`);
    } catch { /* 跨域图读不了像素，跳过 */ }
  }

  // ── top-heavy（只提醒）──
  const sc = stage.querySelector(".sc-scene"), head = sc?.querySelector(".sc-scene-head"), body = sc?.querySelector(".sc-body");
  if (sc && body) {
    const parts = [...body.querySelectorAll(".sc-spec-cell, .sc-spec-ann > *, .sc-body > :not(.sc-spec-fit)")].map((e) => e.getBoundingClientRect()).filter((r) => r.height > 4);
    if (parts.length) {
      const top = Math.min(...parts.map((r) => r.top)), bot = Math.max(...parts.map((r) => r.bottom));
      const R = sc.getBoundingClientRect(), padB = parseFloat(getComputedStyle(sc).paddingBottom) || 0;
      const above = top - (head ? head.getBoundingClientRect().bottom : R.top), below = R.bottom - padB - bot;
      if (below > 0.3 * R.height && below > 2 * Math.max(above, 1)) add("top-heavy", "warn", `内容集中在上方，下方空白约 ${Math.round((below / R.height) * 100)}%`);
    }
  }
  return out;
};
