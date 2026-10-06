// spec-types.ts — 规格驱动章节（SpecChapter）的数据格式。
//
// 一章 = spec.json：每一步一段数据，说清「什么构图、标题是什么、放哪些积木、谁是主角」。
// 渲染由 SpecChapter.tsx 统一完成，章节里没有手写的 TSX / CSS。
//
// 为什么是数据而不是代码：让模型写整章 React 时，99% 的 token 花在 agent 循环里重读上下文，
// 产出的又是每章一套的 bespoke 代码，质量全看当天状态。改成写规格，一章只是一次几千 token
// 的补全，校验是 schema 而不是 tsc，画面质量由渲染器一次做好、所有章共享。
//
// 文本里的轻量标记（所有 string 字段都支持）：
//   **强调**  → accent 色强调      `等宽`  → mono 字体      换行用 \n

import type { Composition, Role } from "./common";

export type ClaimType = "fact" | "supported" | "infer" | "background";

export interface StepEvidence {
  type: ClaimType;
  /** fact / supported 必填（§3.1 / Fig 2 / Table 1 / Eq 3）；infer / background 必须 null */
  locator: string | null;
  note?: string;
}

interface BlockBase {
  /** 同一 id 在相邻步之间保留 DOM（不重播入场动画）——列表逐项揭示、流程逐段点亮都靠它 */
  id?: string;
  /** 每步恰好一个 primary */
  role?: Role;
  /** 入场延迟 ms；primary ≤150 */
  delay?: number;
  /** 并排时的份额（flex-grow），默认由构图决定。注意 Diagram / BarChart / Placeholder 自己的 width 是像素，不是这个 */
  span?: number;
  /** 作者用这块（表 / 图 / 柱图）想证明什么，一句话，渲染在积木下方「作者想说明」 */
  intent?: string;
}

export interface CalloutBlock extends BlockBase {
  type: "Callout";
  kicker?: string;
  title?: string;
  /** 字符串 = 一段；数组 = 多段（每段一行） */
  body?: string | string[];
  tone?: "base" | "accent" | "muted" | "plain";
}
export interface BigNumberBlock extends BlockBase {
  type: "BigNumber";
  value: number | string;
  unit?: string;
  label?: string;
  sub?: string;
  size?: "h1" | "d2" | "d1";
  countUp?: boolean;
  accent?: boolean;
}
export interface StatsBlock extends BlockBase {
  type: "Stats";
  items: Omit<BigNumberBlock, "type" | keyof BlockBase>[];
}
export interface RevealListBlock extends BlockBase {
  type: "RevealList";
  items: (string | { title: string; body?: string })[];
  /** 已显示的项数（1 起）。逐项揭示 = 相邻步同 id、shown 递增 */
  shown: number;
  ghost?: boolean;
  numbered?: boolean;
  reserve?: boolean;
}
export interface CodeBlockBlock extends BlockBase {
  type: "CodeBlock";
  code: string | string[];
  lang?: string;
  title?: string;
  /** 1 起的行号 */
  highlight?: number[];
  dimOthers?: boolean;
  wrap?: boolean;
  /** 逐段解读：每条 = 行号区间 [起, 止]（1 起）+ 这几行在干什么 */
  notes?: { lines: number[]; title?: string; text: string }[];
  /** 当前讲第几条 note（0 起）。同 id 跨步递增 = 一段一段往下讲 */
  active?: number;
  /** 用小例子走一遍时的变量快照；同 id 跨步只改值 */
  vars?: { name: string; value: string | number }[];
  varsTitle?: string;
}
export interface BarChartBlock extends BlockBase {
  type: "BarChart";
  items: { label: string; value: number; sub?: string; accent?: boolean; dim?: boolean; delta?: string; err?: [number, number] }[];
  unit?: string;
  max?: number;
  title?: string;
  decimals?: number;
  reference?: { value: number; label?: string };
  orientation?: "vertical" | "horizontal";
  height?: number;
}
export interface CompareBlock extends BlockBase {
  type: "Compare";
  columns: { title: string; body: string | string[]; tone?: "base" | "accent" | "muted" }[];
  verdict?: string;
}
export interface PipelineBlock extends BlockBase {
  type: "Pipeline";
  stages: { label: string; sub?: string }[];
  active?: number;
  states?: ("idle" | "active" | "done" | "todo")[];
}
export interface DataTableBlock extends BlockBase {
  type: "DataTable";
  columns: string[];
  rows: (string | number)[][];
  shownRows?: number;
  highlight?: { row?: number; col?: number };
  /** 多处高亮：{row} 整行 / {col} 整列 / {row, col} 单格（0 起，行号不含表头）；note 是格子旁的小注 */
  marks?: { row?: number; col?: number; note?: string }[];
  /** 有 marks 时其余格退后 */
  dimOthers?: boolean;
  caption?: string;
}
export interface DiagramBlock extends BlockBase {
  type: "Diagram";
  nodes: { id: string; label: string; sub?: string; x?: number; y?: number; w?: number; h?: number; kind?: "box" | "pill" | "circle"; state?: "idle" | "active" | "done" | "dim" }[];
  edges?: { from: string; to: string; label?: string; kind?: "arrow" | "line" | "loop"; state?: "idle" | "active" | "dim"; dashed?: boolean; bend?: number }[];
  width?: number;
  height?: number;
  draw?: boolean;
}
export interface PlaceholderBlock extends BlockBase {
  type: "Placeholder";
  label: string;
  note?: string;
  width?: number;
  ratio?: number;
}
export interface FigureBlock extends BlockBase {
  type: "Figure";
  /** public/paper/ 下的路径，如 /paper/fig-01.png */
  src: string;
  /** "Fig 1" / "Table 2" */
  label: string;
  /** 图里画了什么（不是「这是一张图」） */
  alt: string;
  credit?: string;
  variant?: "original" | "redraw" | "animated";
  /** 放大局部：原图百分比（旧写法；讲局部优先用 regions + active） */
  focus?: { x: number; y: number; w: number; h?: number };
  height?: number;
  /** 图上的区域（原图百分比 0~100）。给了就走 FigureLens：非重点区淡出 / 推镜 / 切子图 */
  regions?: Record<string, { x: number; y: number; w: number; h: number; label?: string }>;
  /** 当前讲的区域 id（可多个）；null / 不给 = 整图。同 id 跨步只换 active = 镜头在区域间滑动 */
  active?: string | string[] | null;
  mode?: "spotlight" | "zoom" | "crop";
  /** zoom / crop 时角落的位置小地图 */
  minimap?: "tl" | "tr" | "bl" | "br";
  /** 多个 active 时标 1 2 3 */
  numbered?: boolean;
}
export interface ProseBlock extends BlockBase {
  type: "Prose";
  text: string | string[];
  size?: "body" | "large" | "display";
  align?: "left" | "center";
  /** 每段之间做 stagger 入场 */
  stagger?: boolean;
}
export interface QuoteBlock extends BlockBase {
  type: "Quote";
  text: string;
  by?: string;
}
export interface ChipsBlock extends BlockBase {
  type: "Chips";
  items: (string | { label: string; sub?: string; state?: "idle" | "active" | "done" | "dim" })[];
  /** 点亮的下标（0 起），可多个；给了它就不用逐项写 state */
  active?: number | number[];
  /** 已「处理过」的下标（done） */
  done?: number[];
  size?: "md" | "lg";
  /** 相邻 chip 之间画箭头（token 序列 / 时间线） */
  arrows?: boolean;
}
export interface FormulaBlock extends BlockBase {
  type: "Formula";
  /** 整式（KaTeX）。给 parts 时忽略 */
  tex?: string;
  /** 分部揭示：shown 之前的部分点亮，其余弱化 */
  parts?: { tex: string; color?: "accent" | "fact" | "supported" | "infer" }[];
  shown?: number;
  caption?: string;
  /** 逐符号讲解：式子里的每个符号 → 叫什么 · 管什么。tex 里用 [[ ]] 圈出符号（内容和 symbols[i].tex 一致） */
  symbols?: { tex: string; name: string; meaning?: string }[];
  /** 当前讲第几个符号（0 起，可多个）；词表显示到这里为止。同 id 跨步递增 = 一个一个讲 */
  active?: number | number[];
  /** 这条式子在说什么（一句大白话） */
  idea?: string;
  /** 为什么重要 / 带来了什么 */
  significance?: string;
}

/** 同一张网格跨步扩大点亮范围：层级（thread → warp → block → grid）。蓝图 scope-expand */
export interface GridBlock extends BlockBase {
  type: "Grid";
  /** 几组（如 8 个 block）、组按 groupCols 列排 */
  groups?: number;
  groupCols?: number;
  /** 每组几行几列（如 8 行 × 32 列 = 8 个 warp） */
  rows?: number;
  cols: number;
  /** 按阅读顺序（组 → 行 → 列）点亮几格。同 id 跨步增大 = 扩圈 */
  lit: number;
  /** 之前讲过的范围（更淡的同色），通常写上一步的 lit */
  done?: number;
  /** 当前状态的名字，写成「数量 = 名字」：「32 个线程 = 1 个 warp」 */
  label?: string;
  sub?: string;
}
/** 数据包沿轨道一趟趟跑：把访存 / 往返次数做成能数的事件。蓝图 trip-count */
export interface FlowBlock extends BlockBase {
  type: "Flow";
  lanes: {
    from: string;
    to: string;
    label?: string;
    /** 包的宽度 1~4：带宽。演「延迟 vs 带宽」时两条轨道速度一样、只有 width 不同 */
    width?: number;
    /** 每一趟：字符串 = 包上的标签（from → to）；{ label, back: true } = 从 to 回 from */
    trips: (string | { label?: string; back?: boolean })[];
    /** 跑完后的计数文字，默认「N 趟」 */
    count?: string;
    dim?: boolean;
  }[];
  tripMs?: number;
}
/** 输入一档档变大（正方形边长 ∝ value/max，面积 ∝ value²）+ 有上限的容器。蓝图 scale-sweep */
export interface GaugeBlock extends BlockBase {
  type: "Gauge";
  input?: { value: number; max: number; label?: string; caption?: string; shape?: "square" | "bar" };
  /** 输入到读数的换算因子（「× 32 个头 × 2 字节」） */
  factors?: string;
  value: number;
  capacity: number;
  unit?: string;
  /** 容器叫什么（「HBM 显存」） */
  label?: string;
  decimals?: number;
  size?: number;
}

export type Block =
  | CalloutBlock | BigNumberBlock | StatsBlock | RevealListBlock | CodeBlockBlock | BarChartBlock
  | CompareBlock | PipelineBlock | DataTableBlock | DiagramBlock | PlaceholderBlock | FigureBlock
  | ProseBlock | QuoteBlock | ChipsBlock | FormulaBlock | GridBlock | FlowBlock | GaugeBlock;

export type BlockType = Block["type"];

export interface StepSpec {
  composition: Composition;
  /** 已退役：不上屏，别写（老 spec 里有也无害） */
  kicker?: string;
  title?: string;
  lead?: string;
  titleSize?: "h1" | "h2";
  align?: "center" | "top";
  /** 有意的连续同构图（对照 / 消融系列） */
  stable?: boolean;
  /** 积木怎么排：auto 按构图；row 一行；stack 一列 */
  arrange?: "auto" | "row" | "stack";
  /**
   * 步内焦点：口播推进时高亮依次移到哪些东西上（按本步时长均分时间）。
   *   "blockId"                      → 整块点亮
   *   { "id": "chips", "items": [0,1,2] } → 该块的第 0/1/2 项依次点亮（Chips / Pipeline / RevealList / Compare 栏 / Stats 数字 / DataTable 行）
   * 不写 = 自动：≥2 块主内容按顺序扫；单块的多项条目按项扫。false = 关掉。
   */
  focus?: false | (string | { id: string; items?: number[] })[];
  blocks: Block[];
  evidence?: StepEvidence;
  /** 这一拍口播的开头 6~10 个字（原样抄），机器用来核对画面和口播没有错位；不渲染 */
  say?: string;
  /** 备注：这步的动效蓝图 / 设计意图，不渲染 */
  note?: string;
}

export interface ChapterSpec {
  version: 1;
  steps: StepSpec[];
}
