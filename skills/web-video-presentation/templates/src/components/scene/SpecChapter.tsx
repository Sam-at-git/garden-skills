// SpecChapter — 把一章的 spec.json 渲染成画面。章节目录里只剩 spec.json + narrations.ts + evidence.ts + 一个三行的壳。
//
//   import spec from "./spec.json";
//   export default function Foo({ step }: ChapterStepProps) {
//     return <SpecChapter spec={spec as ChapterSpec} step={step} marks={evidence} citation={citation} />;
//   }
//
// 排布规则（arrange=auto 时由构图决定，见 ARRANGE）：
//   row   —— 主/辅积木并排，primary 的份额由构图定（60-40 / 1-1 / 2-1 / 三等分）
//   stack —— 从上到下一列（全宽带 / 图示画布 / 英雄）
//   background 角色的积木铺在下层（layered-depth 用），annotation 角色的积木落在底部一行
//
// 同 id 的积木在相邻步之间保留 DOM：入场动画只播一次，props（shown / active / highlight）变化即「推进」。
// 构图变了整屏重挂，所有积木重新入场 —— 这就是「每一步独占整屏」。
import { Component, useRef, type ReactNode } from "react";
import { useFitZoom } from "./fit";
import { Evidence, type EvidenceMark, type Citation } from "../Evidence";
import { PaperFigure } from "../PaperFigure";
import { FigureLens } from "../FigureLens";
import { Intent } from "./Intent";
import { Scene } from "./Scene";
import { Callout } from "./Callout";
import { BigNumber, Stats } from "./BigNumber";
import { RevealList } from "./RevealList";
import { CodeBlock } from "./CodeBlock";
import { Placeholder } from "./Placeholder";
import { BarChart } from "./BarChart";
import { Compare } from "./Compare";
import { Pipeline } from "./Pipeline";
import { DataTable } from "./DataTable";
import { Diagram } from "./Diagram";
import { Prose, Quote } from "./Prose";
import { Chips } from "./Chips";
import { FormulaSlot } from "./MathSlot";
import { Grid } from "./Grid";
import { Flow } from "./Flow";
import { Gauge } from "./Gauge";
import { cx } from "./common";
import type { Composition } from "./common";
import { rich, paragraphs } from "./rich";
import type { Block, ChapterSpec, StepSpec } from "./spec-types";
import type { FocusAt } from "./common";

const ARRANGE: Record<Composition, { mode: "row" | "stack"; primary: number; secondary: number; center?: boolean }> = {
  "centered-hero":    { mode: "stack", primary: 1, secondary: 1, center: true },
  "asymmetric-60-40": { mode: "row",   primary: 6, secondary: 4 },
  "split-screen":     { mode: "row",   primary: 1, secondary: 1 },
  "rule-of-thirds":   { mode: "row",   primary: 2, secondary: 1 },
  "full-width-strip": { mode: "stack", primary: 1, secondary: 1 },
  "layered-depth":    { mode: "stack", primary: 1, secondary: 1, center: true },
  "triptych":         { mode: "row",   primary: 1, secondary: 1 },
  "diagram-canvas":   { mode: "stack", primary: 1, secondary: 1 },
};

const clampDelay = (b: Block) => (b.role === "primary" ? Math.min(150, b.delay ?? 0) : b.delay);
// 模型常把 reference 写成裸数字；数字 / {value,label} 都收，别的丢掉
const normRef = (r: unknown): { value: number; label?: ReactNode } | undefined => {
  if (typeof r === "number") return { value: r };
  if (r && typeof r === "object" && typeof (r as any).value === "number") return { value: (r as any).value, label: rich((r as any).label) };
  return undefined;
};

// 模型常把 JSON 里的反斜杠双写（"\\\\frac" 解析后成了 \\frac = 换行 + frac）。单行公式里 `\\` 后面紧跟字母 / 标点几乎
// 一定是过度转义，收成一个；真正的换行（`\\` 后是空格或行尾）保留。
export const fixTex = (t: string) => t.replace(/\\\\(?=[A-Za-z,;:!|{}()[\]<>=+\-^_])/g, "\\");

// focus 模型有时写成 [x, y, w] 数组或漏掉 w；不合法就当没有（整图显示），别让 scale(NaN) 把图弄没
const normFocus = (f: unknown): { x: number; y: number; w: number; h?: number } | undefined => {
  if (Array.isArray(f) && f.length >= 3 && f.slice(0, 3).every((n) => typeof n === "number")) return { x: f[0], y: f[1], w: f[2], h: f[3] };
  if (f && typeof f === "object") { const o = f as any; if ([o.x, o.y, o.w].every((n) => typeof n === "number") && o.w > 0) return { x: o.x, y: o.y, w: o.w, h: o.h }; }
  return undefined;
};

/** 单块错误边界：一块积木的数据再离谱也只坏它自己，不许整屏白掉（smoke 会当白屏 fail 掉整章） */
class BlockBoundary extends Component<{ children: ReactNode; label: string }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: unknown) { return { err: e instanceof Error ? e.message : String(e) }; }
  render() {
    if (this.state.err) return <Placeholder label={`积木渲染失败 · ${this.props.label}`} note={this.state.err} width={700} ratio={3} />;
    return this.props.children;
  }
}

/** Diagram 节点默认尺寸：从 400×160 起，按节点间距收缩到不相撞（模型给的坐标常是按小节点算的） */
/** 节点字号：按高度的 0.3 倍，但也不超过宽度的 1/6（只缩了宽、没缩高时，36px 的字挤在 120px 的框里，「叶子节点 0」也折两行） */
const nodeFontFor = (W: number, H: number) => Math.round(Math.max(20, Math.min(36, H * 0.3, W / 6)));

/** 公式大致有多少个「看得见的字符」：去掉命令名、花括号和 [[ ]] 标记 */
const texLen = (t: string) => t.replace(/\[\[|\]\]/g, "").replace(/\\[A-Za-z]+/g, "x").replace(/[{}\s^_]/g, "").length;

/** 估一段文字的显示宽度（px）：中文按 1 个字号，西文 / 数字按 0.58 个字号 */
const textWidth = (t: unknown, fs: number) => [...String(t ?? "")].reduce((w, ch) => w + (/[\u2e80-\uffff]/.test(ch) ? fs : fs * 0.58), 0);

function diagramNodeSize(nodes: { x?: number; y?: number; w?: number; h?: number; label?: unknown; sub?: unknown }[], width: number, height: number) {
  let W = 400, H = 150;
  const pts = nodes.map((n, i) => ({ x: ((n.x ?? ((i + 0.5) / nodes.length) * 100) / 100) * width, y: ((n.y ?? 50) / 100) * height, w: n.w, h: n.h, label: n.label, sub: n.sub }));
  // 节点只设 minHeight：标签长了会折行变高。按当前尺寸估实际高度再判碰撞（以前按 H 判，折行后上下叠在一起）
  const realH = (p: (typeof pts)[number]) => {
    if (p.h) return p.h;
    const fs = nodeFontFor(W, H), inner = (p.w ?? W) - 20;
    const lines = Math.max(1, Math.ceil(textWidth(p.label, fs) / inner)), subLines = p.sub ? Math.max(1, Math.ceil(textWidth(p.sub, fs * 0.72) / inner)) : 0;
    return Math.max(H, lines * fs * 1.2 + subLines * fs * 0.72 * 1.2 + 16);
  };
  // 每对相撞的节点：左右挪开要缩多少宽（占自身宽的比例）vs 上下挪开要缩多少高，哪边小就只缩哪边。
  // 以前宽高一起缩：竖排的节点只是上下挤，宽度也被缩到 120px，长标签折成每行两三个字、节点反而更高
  // （2610.06790 第 2 章第 8 步：「任意不透明 EDA 工件」三行、每行不到 3 个字宽，DOM 检查报 overlap + 窄列）
  const clashes = () => {
    let needW = false, needH = false;
    pts.forEach((a, i) => pts.forEach((b, j) => {
      if (j <= i) return;
      const wa = a.w ?? W, wb = b.w ?? W, ha = realH(a), hb = realH(b);
      const ox = (wa + wb) / 2 + 24 - Math.abs(a.x - b.x), oy = (ha + hb) / 2 + 16 - Math.abs(a.y - b.y);
      if (ox <= 0 || oy <= 0) return;
      if (ox / Math.min(wa, wb) <= oy / Math.min(ha, hb)) needW = true; else needH = true;
    }));
    return { needW, needH };
  };
  // 下限 120×56：层级多、同层节点密的树图（05 章第 8 步 10 个节点 4 层）按旧下限 240×96 收不开，框叠在一起
  for (let k = 0; k < 60; k++) {
    const { needW, needH } = clashes();
    if (!needW && !needH) break;
    const w0 = W, h0 = H;
    if (needW) W = Math.max(120, W * 0.9);
    if (needH) H = Math.max(56, H * 0.9);
    if (W === w0 && H === h0) break; // 该缩的方向都到下限了
  }
  const c = clashes();
  return { W: Math.round(W), H: Math.round(H), stuck: c.needW || c.needH };
}

/** 缩到最小还撞（坐标给得太挤）：按原来的高度分行（相差 <12% 算同一行），行内按 x 均匀铺开，
 *  一行太多就折到下一行 —— 保住「谁在谁左边 / 上面」，宁可换布局也不叠框 */
function gridLayout<T extends { x?: number; y?: number }>(nodes: T[], width: number, height: number): T[] {
  const items = nodes.map((n, i) => ({ i, y: n.y ?? 50, x: n.x ?? (i * 100) / nodes.length })).sort((a, b) => a.y - b.y);
  const bands: (typeof items)[] = [];
  for (const it of items) { const b = bands[bands.length - 1]; if (b && it.y - b[0].y < 12) b.push(it); else bands.push([it]); }
  const perRow = Math.max(2, Math.round(Math.sqrt(nodes.length * (width / height))) + 1);
  const rows: (typeof items)[] = [];
  for (const b of bands) { b.sort((p, q) => p.x - q.x); for (let k = 0; k < b.length; k += perRow) rows.push(b.slice(k, k + perRow)); }
  const at = new Map<number, { x: number; y: number }>();
  rows.forEach((row, r) => row.forEach((it, k) => at.set(it.i, { x: 8 + (84 * (k + 0.5)) / row.length, y: rows.length === 1 ? 50 : 14 + (72 * (r + 0.5)) / rows.length })));
  return nodes.map((n, i) => ({ ...n, ...at.get(i)! }));
}

/**
 * 自动分层布局：边构成森林（每个节点至多一个父）、至少 3 层、至少 5 个节点时，不用模型给的坐标，
 * 按层均匀铺开（层内按模型的 x 排序保留左右关系，父节点放在子节点中间）。树图最怕的就是同层挤在一起。
 */
function treeLayout(nodes: { id: string; x?: number; y?: number }[], edges: { from: string; to: string; kind?: string }[]) {
  if (nodes.length < 5) return null;
  const ids = new Set(nodes.map((n) => n.id));
  const parent = new Map<string, string>();
  for (const e of edges) {
    if (e.kind === "loop" || e.from === e.to || !ids.has(e.from) || !ids.has(e.to)) continue;
    if (parent.has(e.to) && parent.get(e.to) !== e.from) return null; // 多个父：不是树
    parent.set(e.to, e.from);
  }
  const depth = new Map<string, number>();
  const d = (id: string, seen = new Set<string>()): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (seen.has(id)) return 0; seen.add(id);
    const p = parent.get(id); const v = p ? d(p, seen) + 1 : 0; depth.set(id, v); return v;
  };
  nodes.forEach((n) => d(n.id));
  const levels = Math.max(...depth.values()) + 1;
  if (levels < 3 || parent.size < nodes.length - 3) return null;
  // 单链（没有任何节点有两个以上的孩子）不是树：按层排会把「从左到右的流程」竖成一列，保留模型给的坐标
  const kids = new Map<string, number>();
  for (const pId of parent.values()) kids.set(pId, (kids.get(pId) ?? 0) + 1);
  if (Math.max(0, ...kids.values()) < 2) return null;
  const byLevel: string[][] = Array.from({ length: levels }, () => []);
  const xOf = new Map(nodes.map((n, i) => [n.id, n.x ?? i]));
  nodes.forEach((n) => byLevel[depth.get(n.id)!].push(n.id));
  byLevel.forEach((row) => row.sort((a, b) => xOf.get(a)! - xOf.get(b)!));
  // 叶子层（最宽的一层）均匀铺满，其它层：有孩子的放在孩子中间，没孩子的均匀插空
  const pos = new Map<string, { x: number; y: number }>();
  const widest = Math.max(...byLevel.map((r) => r.length));
  const even = (k: number, n: number) => 8 + (84 * (k + 0.5)) / n;
  for (let L = levels - 1; L >= 0; L--) {
    const row = byLevel[L], y = 12 + (76 * L) / (levels - 1);
    row.forEach((id, k) => {
      const kids = byLevel[L + 1]?.filter((c) => parent.get(c) === id) || [];
      const x = kids.length ? kids.reduce((a, c) => a + pos.get(c)!.x, 0) / kids.length : even(k, row.length === widest ? widest : row.length);
      pos.set(id, { x, y });
    });
    // 同层按 x 排后若太挤（间距 < 84/widest），整体均匀化
    const xs = row.map((id) => pos.get(id)!.x).sort((a, b) => a - b);
    if (xs.some((v, i) => i && v - xs[i - 1] < 84 / widest * 0.9)) row.forEach((id, k) => { pos.get(id)!.x = even(k, row.length); });
  }
  return pos;
}

interface RenderCtx { siblings: number; itemFocus?: FocusAt }
/** 同屏纵向堆几块，图 / 图示 / 柱图最多能有多高：模型写的 height 再大也不许越界（舞台 1080，扣掉安全区和标题约剩 600~700） */
const heightCap = (siblings: number, solo: number) => (siblings >= 3 ? 300 : siblings === 2 ? 460 : solo);

/**
 * 步内焦点计划：把 step.focus（或自动规则）展开成「哪块 / 哪项在本步的哪一段时间点亮」。
 * 时间按目标个数均分，首个目标从 6% 开始（等入场落定），最后一个不退。
 */
function focusPlan(s: StepSpec, main: Block[]): { blocks: Map<string, [number, number]>; items: Map<string, FocusAt> } {
  const blocks = new Map<string, [number, number]>(), items = new Map<string, FocusAt>();
  if (s.focus === false) return { blocks, items };
  const keyOf = (b: Block, i: number) => b.id ?? `${b.type}-${i}`;
  const itemCount = (b: Block) => (b.type === "Chips" || b.type === "RevealList" ? (b.type === "RevealList" ? Math.min(b.items.length, b.shown) : b.items.length)
    : b.type === "Pipeline" ? b.stages.length : b.type === "Compare" ? b.columns.length : b.type === "Stats" ? b.items.length
    : b.type === "DataTable" ? Math.min(b.rows.length, b.shownRows ?? b.rows.length) : 0);
  const itemBlocks = new Set(["Chips", "RevealList", "Pipeline", "Compare", "Stats", "DataTable"]);
  let targets: { key: string; item?: number }[] = [];
  if (Array.isArray(s.focus)) {
    for (const f of s.focus) {
      if (typeof f === "string") { const i = main.findIndex((b, k) => keyOf(b, k) === f); if (i >= 0) targets.push({ key: keyOf(main[i], i) }); }
      else { const i = main.findIndex((b, k) => keyOf(b, k) === f.id); if (i < 0) continue; const b = main[i]; const n = itemCount(b);
        for (const it of (f.items ?? Array.from({ length: n }, (_, k) => k))) if (it >= 0 && it < n) targets.push({ key: keyOf(b, i), item: it }); }
    }
  } else if (main.length >= 2) {
    targets = main.map((b, i) => ({ key: keyOf(b, i) }));
  } else if (main.length === 1 && itemBlocks.has(main[0].type) && itemCount(main[0]) >= 2) {
    const n = itemCount(main[0]);
    targets = Array.from({ length: n }, (_, k) => ({ key: keyOf(main[0], 0), item: k }));
  }
  if (targets.length < 2) return { blocks, items };
  const start = 0.06, span = 0.94 / targets.length;
  targets.forEach((t, k) => {
    const on = start + k * span, off = k === targets.length - 1 ? 2 : start + (k + 1) * span;
    if (t.item === undefined) blocks.set(t.key, [on, off]);
    else { const arr = items.get(t.key) ?? []; arr[t.item] = [on, off]; items.set(t.key, arr); }
  });
  return { blocks, items };
}

/** intent（作者想说明）：DataTable / Figure 自己渲染，其余积木（柱图 / 图示 / 公式…）在下面补一行 */
function renderBlock(b: Block, ctx: RenderCtx = { siblings: 1 }): ReactNode {
  const node = renderBlockInner(b, ctx);
  if (!b.intent || b.type === "DataTable" || b.type === "Figure") return node;
  return <div className="sc-with-intent">{node}<Intent>{rich(b.intent)}</Intent></div>;
}

function renderBlockInner(b: Block, ctx: RenderCtx = { siblings: 1 }): ReactNode {
  const common = { role: b.role, delay: clampDelay(b) };
  const fa = ctx.itemFocus;
  switch (b.type) {
    case "Callout":
      return <Callout {...common} kicker={rich(b.kicker)} title={rich(b.title)} tone={b.tone}>{paragraphs(b.body)}</Callout>;
    case "BigNumber":
      // 规格章里数字默认从 0 跳到目标（countUp: false 可关）；≥10 的整数部分才有跳动感
      return <BigNumber {...common} value={b.value} unit={b.unit} label={rich(b.label)} sub={rich(b.sub)} size={b.size} countUp={b.countUp ?? (typeof b.value === "number" && Math.abs(b.value) >= 10)} accent={b.accent} />;
    case "Stats":
      return (
        <Stats {...common}>
          {b.items.map((it, i) => (
            <BigNumber key={i} value={it.value} unit={it.unit} label={rich(it.label)} sub={rich(it.sub)} size={it.size ?? "h1"} countUp={it.countUp ?? (typeof it.value === "number" && Math.abs(it.value) >= 10)} accent={it.accent} focus={fa?.[i]} />
          ))}
        </Stats>
      );
    case "RevealList":
      return <RevealList {...common} items={b.items.map((it) => (typeof it === "string" ? { title: rich(it) } : { title: rich(it.title), body: rich(it.body) }))} shown={b.shown} ghost={b.ghost ?? false} numbered={b.numbered} reserve={b.reserve} focusAt={fa} />;
    case "CodeBlock":
      return <CodeBlock {...common} lines={Array.isArray(b.code) ? b.code : b.code.split("\n")} lang={b.lang} title={b.title} highlight={b.highlight} dimOthers={b.dimOthers} wrap={b.wrap}
                        notes={Array.isArray(b.notes) ? b.notes.filter((x) => x && Array.isArray(x.lines) && typeof x.text === "string") : undefined}
                        active={typeof b.active === "number" ? b.active : undefined} vars={Array.isArray(b.vars) ? b.vars : undefined} varsTitle={b.varsTitle} />;
    case "BarChart":
      return <BarChart {...common} items={b.items.map((it) => ({ ...it, label: rich(it.label), sub: rich(it.sub), delta: rich(it.delta) }))} unit={b.unit} max={b.max} title={rich(b.title)} decimals={b.decimals} reference={normRef(b.reference)} orientation={b.orientation} height={Math.min(b.height ?? 600, heightCap(ctx.siblings, 600))} />;
    case "Compare":
      return <Compare {...common} columns={b.columns.map((c) => ({ title: rich(c.title), body: paragraphs(c.body), tone: c.tone }))} verdict={rich(b.verdict)} focusAt={fa} />;
    case "Pipeline":
      return <Pipeline {...common} stages={b.stages.map((s) => ({ label: rich(s.label), sub: rich(s.sub) }))} active={b.active} states={b.states} focusAt={fa} />;
    case "DataTable": {
      // 表头 / 格子偶尔是 {key, label} 对象：取 label，别让 [object Object] 上屏
      const cellText = (c: unknown) => (c && typeof c === "object" ? String((c as any).label ?? (c as any).title ?? (c as any).name ?? (c as any).text ?? "") : c);
      return <DataTable {...common} columns={b.columns.map((c) => rich(cellText(c) as string))} rows={b.rows.map((r) => r.map((c) => (typeof c === "number" ? c : rich(cellText(c) as string))))} shownRows={b.shownRows} highlight={b.highlight}
                        marks={Array.isArray(b.marks) ? b.marks.map((m) => ({ ...m, note: m?.note })) : undefined} dimOthers={b.dimOthers} intent={rich(b.intent)} caption={rich(b.caption)} focusAt={fa} />;
    }
    case "Diagram":
    {
      // 规格章里图示是整屏主角：节点默认 400×160 起步、按间距收缩；有同伴积木时图矮一点，免得撑出安全区
      const dw = b.width ?? 1500, dh = Math.min(b.height ?? 640, heightCap(ctx.siblings, 640));
      // 模型给的坐标常挤在画布中间一小块（05 章第 8 步横向只用了三成宽），节点只能收得很小。先把坐标线性铺开到可用范围
      const spread = (vals: (number | undefined)[], lo: number, hi: number) => {
        const v = vals.filter((x): x is number => typeof x === "number");
        if (v.length < 2) return (x?: number) => x;
        const a = Math.min(...v), z = Math.max(...v);
        if (z - a < 1 || z - a >= (hi - lo) * 0.9) return (x?: number) => x;
        return (x?: number) => (x === undefined ? x : lo + ((x - a) / (z - a)) * (hi - lo));
      };
      const sx = spread(b.nodes.map((n) => n.x), 10, 90), sy = spread(b.nodes.map((n) => n.y), 14, 86);
      let nodesSpread = b.nodes.map((n) => ({ ...n, x: sx(n.x), y: sy(n.y) }));
      const tree = treeLayout(b.nodes, b.edges || []);
      if (tree) nodesSpread = b.nodes.map((n) => ({ ...n, ...tree.get(n.id)! }));
      let size = diagramNodeSize(nodesSpread, dw, dh);
      if (size.stuck) { nodesSpread = gridLayout(nodesSpread, dw, dh); size = diagramNodeSize(nodesSpread, dw, dh); }
      const { W, H } = size;
      // 顶层 / 底层节点中心别贴着画布边（半个框会伸出去压住标题）
      const padY = (H / 2 + 8) / dh * 100, clampY = (y?: number) => (y === undefined ? y : Math.max(padY, Math.min(100 - padY, y)));
      return <Diagram {...common} nodeFont={nodeFontFor(W, H)} nodes={nodesSpread.map((n) => ({ w: W, h: H, ...n, y: clampY(n.y), label: rich(n.label), sub: rich(n.sub) }))} edges={b.edges?.map((e) => ({ ...e, label: rich(e.label), labelWidth: e.label ? textWidth(e.label, 26) + 16 : undefined }))} width={dw} height={dh} draw={b.draw} />;
    }
    case "Placeholder":
      return <Placeholder {...common} label={b.label} note={b.note} width={b.width} ratio={b.ratio} />;
    case "Figure":
      if (b.regions && typeof b.regions === "object" && Object.keys(b.regions).length) {
        // 讲局部：FigureLens。宽度跟所在单元走（fit），高度受同屏积木数约束
        const regions = Object.fromEntries(Object.entries(b.regions).filter(([, g]) => g && [g.x, g.y, g.w, g.h].every((v) => typeof v === "number")));
        return (
          <div className="sc-figure sc-in" data-role={b.role} style={b.delay ? ({ "--sc-delay": `${clampDelay(b)}ms` } as any) : undefined}>
            <FigureLens src={b.src} label={b.label} alt={b.alt} credit={b.credit} variant={b.variant} fit width={1640}
                        height={Math.min(b.height ?? 680, heightCap(ctx.siblings, 680))} regions={regions} active={b.active ?? null}
                        mode={b.mode === "zoom" || b.mode === "crop" ? b.mode : "spotlight"} minimap={b.minimap} numbered={b.numbered}
                        intent={b.intent ? rich(b.intent) : undefined} />
          </div>
        );
      }
      return (
        <div className="sc-figure sc-in" data-role={b.role} style={b.delay ? ({ "--sc-delay": `${clampDelay(b)}ms` } as any) : undefined}>
          <PaperFigure src={b.src} label={b.label} alt={b.alt} credit={b.credit} variant={b.variant} focus={normFocus(b.focus)} height={Math.min(b.height ?? 640, heightCap(ctx.siblings, 640))} />
          {b.intent && <Intent>{rich(b.intent)}</Intent>}
        </div>
      );
    case "Prose":
      return <Prose {...common} text={b.text} size={b.size} align={b.align} stagger={b.stagger} />;
    case "Quote":
      return <Quote {...common} text={b.text} by={b.by} />;
    case "Chips":
      return <Chips {...common} items={b.items} active={b.active} done={b.done} size={b.size} arrows={b.arrows} focusAt={fa} />;
    case "Formula":
      return <FormulaSlot {...common} tex={b.tex && fixTex(b.tex)} parts={b.parts?.map((p) => ({ ...p, tex: fixTex(p.tex) }))} shown={b.shown} caption={b.caption}
                          symbols={Array.isArray(b.symbols) ? b.symbols.filter((x) => x && typeof x.tex === "string").map((x) => ({ ...x, tex: fixTex(x.tex) })) : undefined}
                          active={b.active} idea={b.idea} significance={b.significance} />;
    case "Grid":
      return <Grid {...common} groups={b.groups} groupCols={b.groupCols} rows={b.rows} cols={b.cols} lit={b.lit} done={b.done} label={rich(b.label)} sub={rich(b.sub)}
                   height={Math.min(460, heightCap(ctx.siblings, 460))} />;
    case "Flow":
      return <Flow {...common} tripMs={b.tripMs} lanes={(b.lanes || []).map((l) => ({
        from: rich(l.from), to: rich(l.to), label: rich(l.label), width: l.width, count: l.count === undefined ? undefined : rich(l.count), dim: l.dim,
        trips: (Array.isArray(l.trips) ? l.trips : []).map((t) => (typeof t === "string" ? { label: rich(t) } : { label: rich(t?.label), back: !!t?.back })),
      }))} />;
    case "Gauge":
      return <Gauge {...common} input={b.input && typeof b.input.value === "number" ? { ...b.input, label: rich(b.input.label), caption: rich(b.input.caption) } : undefined}
                    factors={rich(b.factors)} value={b.value} capacity={b.capacity} unit={b.unit} label={rich(b.label)} decimals={b.decimals}
                    size={Math.min(b.size ?? 380, ctx.siblings >= 3 ? 240 : 380)} />;
    default:
      return <Placeholder label={`未知积木 ${(b as Block).type}`} />;
  }
}

function StepView({ s }: { s: StepSpec }) {
  const a = ARRANGE[s.composition] ?? ARRANGE["centered-hero"];
  const mode = s.arrange && s.arrange !== "auto" ? s.arrange : a.mode;
  const bg = s.blocks.filter((b) => b.role === "background");
  const ann = s.blocks.filter((b) => b.role === "annotation");
  const main = s.blocks.filter((b) => b.role !== "background" && b.role !== "annotation");
  // 并排规则：
  //   - 「宽积木」（流程条 / 表格 / 图示 / ≥4 项的药丵 / 横向柱图）天生要整宽，不和别的积木并排，整宽堆叠
  //   - 其余积木并排最多 2 块（triptych 3 块），多出来的整宽堆在下面 —— 三块硬挤一行会把第三块压成一列字
  //   - 并排候选不足 2 块就全部堆叠
  const wide = (b: Block) => b.type === "Pipeline" || b.type === "DataTable" || b.type === "Diagram" || b.type === "CodeBlock" || b.type === "Grid" || b.type === "Flow"
    || (b.type === "Chips" && b.items.length >= 4) || (b.type === "BarChart" && (b.orientation === "horizontal" || b.items.length >= 5))
    // 4 个以上数字挤在 60% / 2/3 的格子里，每个数字下面的标签只剩窄窄一列（cjk-narrow-column）
    || (b.type === "Stats" && b.items.length >= 4)
    // 3 栏对照和别的积木并排时只分到一半宽，每栏 150px 左右，英文词被拆成「taxonom / y」
    || (b.type === "Compare" && b.columns.length >= 3)
    // 长公式不和别人并排：KaTeX 不换行，挤在 60% 的格子里缩到下限还是被裁、或压到旁边的卡片（20 篇里 13 条）
    || (b.type === "Formula" && texLen(b.tex ?? (b.parts || []).map((p) => p.tex).join(" ")) > 30);
  const rowCap = s.composition === "triptych" ? 3 : 2;
  const narrow = main.filter((b) => !wide(b));
  const rowMode = mode === "row" && narrow.length >= 2;
  const rowSet = new Set(rowMode ? narrow.slice(0, rowCap) : []);
  const rowBlocks = rowMode ? main.filter((b) => rowSet.has(b)) : main;
  const restBlocks = rowMode ? main.filter((b) => !rowSet.has(b)) : [];
  // 份额只认 span：模型常把 Diagram 的像素 width 写进来，拿它当 flex-grow 会把旁边的块挤成一列字
  const share = (b: Block) => b.span ?? (b.role === "primary" ? a.primary : b.role === "secondary" ? a.secondary : 1);
  const keyOf = (b: Block, i: number) => b.id ?? `${b.type}-${i}`;
  const plan = focusPlan(s, main);
  const fitRef = useRef<HTMLDivElement>(null);
  // 内容总高超过标题下方的可用高度就整体等比缩小（首跑：05 章第 8/12 步、06 章第 8 步底部被裁）
  useFitZoom(fitRef, "height", 0.5, [s]); // 下限 0.6 时内容多的步缩到头还被底边裁（回放 2501.09223 两处）
  const cellFocus = (b: Block, i: number) => { const t = plan.blocks.get(keyOf(b, i)); return t ? { cls: "sc-focus", style: { "--on": t[0], "--off": t[1] } as any } : { cls: "", style: undefined }; };
  return (
    <Scene composition={s.composition} kicker={rich(s.kicker)} title={rich(s.title)} lead={rich(s.lead)} titleSize={s.titleSize} stable={s.stable} align={s.align}
           headKey={`${s.kicker ?? ""}|${s.title ?? ""}|${s.lead ?? ""}`}
           className={cx("sc-spec", a.center && "sc-spec-center", main.length + ann.length >= 3 && "sc-spec-dense")}>
      {bg.length > 0 && <div className="sc-spec-bg">{bg.map((b, i) => <div key={keyOf(b, i)} className="sc-spec-bg-item"><BlockBoundary label={b.type}>{renderBlock(b)}</BlockBoundary></div>)}</div>}
      <div ref={fitRef} className="sc-spec-fit">
      <div className={cx("sc-spec-main", rowMode ? "sc-spec-row" : "sc-spec-stack", rowMode && rowBlocks.length >= 3 && "sc-spec-row-n3")}>
        {rowBlocks.map((b, i) => (
          <div key={keyOf(b, i)} className={cx("sc-spec-cell", b.role && `sc-spec-${b.role}`, cellFocus(b, i).cls)} style={{ ...(rowMode ? { flex: `${share(b)} 1 0` } : {}), ...(cellFocus(b, i).style ?? {}) }}>
            <BlockBoundary label={b.type}>{renderBlock(b, { siblings: main.length + ann.length, itemFocus: plan.items.get(keyOf(b, i)) })}</BlockBoundary>
          </div>
        ))}
      </div>
      {restBlocks.length > 0 && (
        <div className="sc-spec-main sc-spec-stack sc-spec-rest">
          {restBlocks.map((b, i) => (
            <div key={keyOf(b, rowCap + i)} className={cx("sc-spec-cell", b.role && `sc-spec-${b.role}`, cellFocus(b, rowCap + i).cls)} style={cellFocus(b, rowCap + i).style}>
              <BlockBoundary label={b.type}>{renderBlock(b, { siblings: main.length + ann.length, itemFocus: plan.items.get(keyOf(b, rowCap + i)) })}</BlockBoundary>
            </div>
          ))}
        </div>
      )}
      {ann.length > 0 && <div className="sc-spec-ann">{ann.map((b, i) => <div key={keyOf(b, i)}><BlockBoundary label={b.type}>{renderBlock(b)}</BlockBoundary></div>)}</div>}
      </div>
    </Scene>
  );
}

export function SpecChapter({
  spec, step, marks,
}: {
  spec: ChapterSpec;
  step: number;
  marks?: EvidenceMark[];
  citation?: Citation;
}) {
  const s = spec.steps[Math.max(0, Math.min(step, spec.steps.length - 1))];
  if (!s) return null;
  return (
    <>
      {/* 构图变了整屏重挂（所有积木重新入场）；同构图的相邻步只更新 props */}
      <StepView key={s.composition} s={s} />
      {marks && <Evidence step={step} marks={marks} />}
    </>
  );
}
