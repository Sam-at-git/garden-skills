// Diagram — 节点 + 连线图。节点是 HTML（吃 token、字号 ≥20px），连线画在下层 SVG 里，坐标由组件算。
// 支持直线箭头、回环（loop）、虚线、按步骤点亮 / 弱化、描线动画。
//
//   <Diagram role="primary" width={1400} height={600}
//     nodes={[
//       { id: "gen", label: "Query Generator", x: 20, y: 50, state: step >= 1 ? "active" : "idle" },
//       { id: "val", label: "Validator", sub: "EXPLAIN", x: 55, y: 50 },
//       { id: "end", label: "回答", x: 88, y: 50, kind: "pill" },
//     ]}
//     edges={[
//       { from: "gen", to: "val", label: "SQL" },
//       { from: "val", to: "gen", kind: "loop", label: "fail → 重试", state: step >= 3 ? "active" : "idle", dashed: true },
//       { from: "val", to: "end" },
//     ]}
//     draw={step === 1} />
//
// x / y 是容器百分比（节点中心）；不给就按顺序排成一行。
import { useRef, type ReactNode } from "react";
import { useFitZoom } from "./fit";
import type { RoleProps } from "./common";
import { cx, delayStyle } from "./common";

export interface DiagramNode {
  id: string;
  label: ReactNode;
  sub?: ReactNode;
  /** 中心位置，百分比 0..100 */
  x?: number;
  y?: number;
  /** 像素尺寸，默认 240×96 */
  w?: number;
  h?: number;
  kind?: "box" | "pill" | "circle";
  state?: "idle" | "active" | "done" | "dim";
}
export interface DiagramEdge {
  from: string;
  to: string;
  label?: ReactNode;
  kind?: "arrow" | "line" | "loop";
  state?: "idle" | "active" | "dim";
  dashed?: boolean;
  /** loop 的弯曲方向与幅度（像素，正 = 向下/右弯） */
  bend?: number;
  /** 标签的估计宽度（px）。给了就用来判断两节点之间放不放得下，放不下挪到节点上方 / 右侧 */
  labelWidth?: number;
}

export function Diagram({
  nodes, edges = [], width = 1400, height = 600, draw = false, nodeFont, role, delay, className,
}: RoleProps & {
  /** 节点主文字字号（px）；节点被收小时跟着收，免得字撑破框 */
  nodeFont?: number;
  nodes: DiagramNode[];
  edges?: DiagramEdge[];
  width?: number;
  height?: number;
  /** 本步连线描线入场 */
  draw?: boolean;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  useFitZoom(canvasRef, "width", 0.45, [width, height, nodes.length]);
  // 缺坐标的节点排成一行
  const missing = nodes.filter((n) => n.x === undefined || n.y === undefined);
  const pos = new Map<string, { cx: number; cy: number; w: number; h: number }>();
  nodes.forEach((n) => {
    const idx = missing.indexOf(n);
    const x = n.x ?? ((idx + 0.5) / missing.length) * 100;
    const y = n.y ?? 50;
    pos.set(n.id, { cx: (x / 100) * width, cy: (y / 100) * height, w: n.w ?? 240, h: n.h ?? 96 });
  });
  // 从节点边框出发：按方向裁到矩形边界
  const border = (p: { cx: number; cy: number; w: number; h: number }, tx: number, ty: number) => {
    const dx = tx - p.cx, dy = ty - p.cy;
    if (!dx && !dy) return { x: p.cx, y: p.cy };
    const sx = Math.abs(dx) / (p.w / 2), sy = Math.abs(dy) / (p.h / 2);
    const k = 1 / Math.max(sx, sy);
    return { x: p.cx + dx * k, y: p.cy + dy * k };
  };
  const paths = edges.map((e, i) => {
    const a = pos.get(e.from), b = pos.get(e.to);
    if (!a || !b) return null;
    let d: string, mid: { x: number; y: number }, endAngle: number, end: { x: number; y: number };
    if (e.kind === "loop" || e.from === e.to) {
      const bend = e.bend ?? 160;
      const p1 = { x: a.cx, y: a.cy + Math.sign(bend) * a.h / 2 };
      const p2 = { x: b.cx, y: b.cy + Math.sign(bend) * b.h / 2 };
      const c = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 + bend };
      d = `M${p1.x},${p1.y} Q${c.x},${c.y} ${p2.x},${p2.y}`;
      mid = { x: (p1.x + 2 * c.x + p2.x) / 4, y: (p1.y + 2 * c.y + p2.y) / 4 };
      end = p2; endAngle = Math.atan2(p2.y - c.y, p2.x - c.x);
    } else {
      const s = border(a, b.cx, b.cy), t = border(b, a.cx, a.cy);
      d = `M${s.x},${s.y} L${t.x},${t.y}`;
      mid = { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 };
      // 标签放不进两节点之间的空隙，就挪到节点外面：横向连线放到两个节点上方，竖向的放到右侧。
      // 以前一律放在中点，空隙短时被节点盖住半截（「1000 行问题」只剩「000 行问题」）
      if (e.label && e.labelWidth) {
        const gap = Math.hypot(t.x - s.x, t.y - s.y), LH = 40;
        if (Math.abs(t.x - s.x) >= Math.abs(t.y - s.y)) {
          if (e.labelWidth + 16 > gap) {
            const above = Math.min(a.cy - a.h / 2, b.cy - b.h / 2) - LH / 2 - 6;
            mid = { x: mid.x, y: above >= LH / 2 ? above : Math.max(a.cy + a.h / 2, b.cy + b.h / 2) + LH / 2 + 6 }; // 顶上没地方就放下面
          }
        } else if (LH + 8 > gap) {
          mid = { x: Math.max(a.cx + a.w / 2, b.cx + b.w / 2) + 10 + e.labelWidth / 2, y: mid.y };
        }
      }
      end = t; endAngle = Math.atan2(t.y - s.y, t.x - s.x);
    }
    const head = e.kind === "line" ? null : (() => {
      const L = 18, W = 9;
      const bx = end.x - Math.cos(endAngle) * L, by = end.y - Math.sin(endAngle) * L;
      const nx = -Math.sin(endAngle) * W, ny = Math.cos(endAngle) * W;
      return `${end.x},${end.y} ${bx + nx},${by + ny} ${bx - nx},${by - ny}`;
    })();
    // 描线时线要在箭头前停一点
    return { e, i, d, mid, head };
  });
  // 连线标签之间互相避让：后画的撞上前面的就往下挪一行（挪开节点后，两条短边的标签常挤到同一处）
  const placed: { x: number; y: number; w: number }[] = [];
  for (const p of paths) {
    if (!p || !p.e.label) continue;
    const w = p.e.labelWidth ?? 120;
    for (let k = 0; k < 4 && placed.some((q) => Math.abs(q.x - p.mid.x) < (q.w + w) / 2 + 8 && Math.abs(q.y - p.mid.y) < 40); k++) p.mid = { ...p.mid, y: p.mid.y + 42 };
    placed.push({ x: p.mid.x, y: p.mid.y, w });
  }
  return (
    // 画布按原始像素尺寸排版，外层量出可用宽度后整体 zoom —— 框、字、线一起等比缩，被压窄时不会框缩字不缩而重叠
    <div className="sc-diagram-fit" data-role={role}>
    <div ref={canvasRef} className={cx("sc-diagram", className)} style={delayStyle(delay, { width, height, ...(nodeFont ? { "--sc-node-fs": `${nodeFont}px` } : {}) } as any)}>
      <svg className="sc-diagram-svg" viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden>
        {paths.map((p) => p && (
          <g key={p.i} style={{ "--i": p.i } as any}>
            <path d={p.d} pathLength={1} className={cx("sc-edge", p.e.state === "active" && "sc-edge-active", p.e.state === "dim" && "sc-edge-dim", p.e.dashed && "sc-edge-dashed", draw && "sc-edge-draw")} />
            {p.head && <polygon points={p.head} className={cx("sc-edge-head", p.e.state === "active" && "sc-edge-head-active", p.e.state === "dim" && "sc-edge-dim")} />}
          </g>
        ))}
      </svg>
      {nodes.map((n, i) => {
        const p = pos.get(n.id)!;
        return (
          <div key={n.id} className={cx("sc-node sc-in", n.kind === "pill" && "sc-node-pill", n.kind === "circle" && "sc-node-circle", n.state && n.state !== "idle" && `sc-node-${n.state}`)}
               style={{ left: p.cx - p.w / 2, top: p.cy, width: p.w, minHeight: p.h, "--sc-delay": `${Math.min(150, i * 40)}ms` } as any}>
            <div className="sc-node-label">{n.label}</div>
            {n.sub && <div className="sc-node-sub">{n.sub}</div>}
          </div>
        );
      })}
      {/* 连线标签在节点之后画（上层）：以前先画标签，节点框把它盖住半截 */}
      {paths.map((p) => p && p.e.label && (
        <div key={`l${p.i}`} className={cx("sc-edge-label", p.e.state === "active" && "sc-edge-label-active")} style={{ left: p.mid.x, top: p.mid.y }}>{p.e.label}</div>
      ))}
    </div>
    </div>
  );
}
