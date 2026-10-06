// Grid — 同一张网格从头用到底，跨步只扩大点亮范围：讲「小单元组成大单元」的层级
// （thread → warp → block → grid、字 → 词 → 句、样本 → batch）。蓝图 scope-expand。
//
//   <Grid id="threads" groups={8} groupCols={4} rows={8} cols={32} lit={32} done={1}
//         label="32 threads = 1 warp" role="primary" />
//
// lit  = 按阅读顺序（组 → 行 → 列）点亮的格数；done = 之前讲过的层级（同色更淡），通常就是上一步的 lit。
// 同 id 相邻步保留 DOM：lit 变大时只有新点亮的那些格按顺序依次填上（逐格填充），不重播入场。
// 标签随状态换（「数量 = 名字」），换的时候淡入。
import { useState, type ReactNode } from "react";
import type { RoleProps } from "./common";
import { cx, delayStyle } from "./common";

const CELL = 1, GAP = 0.28, GROUP_GAP = 2.4;

export function Grid({
  groups = 1, groupCols, rows = 1, cols, lit = 0, done = 0, label, sub, width = 1400, height = 460, role, delay, className,
}: RoleProps & {
  /** 几组（block）；组按 groupCols 列排 */
  groups?: number;
  groupCols?: number;
  /** 每组几行几列 */
  rows?: number;
  cols: number;
  lit?: number;
  done?: number;
  label?: ReactNode;
  sub?: ReactNode;
  /** 网格最大像素尺寸（按比例缩放到不超过它） */
  width?: number;
  height?: number;
}) {
  const g = Math.max(1, Math.floor(groups)), r = Math.max(1, Math.floor(rows)), c = Math.max(1, Math.floor(cols));
  const gc = Math.max(1, Math.min(g, Math.floor(groupCols ?? (g <= 4 ? g : Math.ceil(g / 2)))));
  const gr = Math.ceil(g / gc);
  const total = g * r * c;
  const L = Math.max(0, Math.min(total, Math.floor(lit))), D = Math.max(0, Math.min(total, Math.floor(done)));

  // 只给「这一步新点亮」的格加填充动画。基线只在 lit 真的变了才挪 —— 同一步里父组件重渲染不能把正在填的格打断
  // （React 的「prop 变了就在渲染时调整 state」写法）
  const [mem, setMem] = useState({ L, from: 0 });
  const from = mem.L === L ? mem.from : Math.min(mem.L, L);
  if (mem.L !== L) setMem({ L, from });
  const fresh = Math.max(0, L - from);
  const fillMs = Math.min(1400, 240 + fresh * 12);

  const gw = c * CELL + (c - 1) * GAP, gh = r * CELL + (r - 1) * GAP;
  const W = gc * gw + (gc - 1) * GROUP_GAP, H = gr * gh + (gr - 1) * GROUP_GAP;
  const scale = Math.min(width / W, height / H);

  const cells: ReactNode[] = [];
  for (let k = 0; k < total; k++) {
    const gi = Math.floor(k / (r * c)), ri = Math.floor((k % (r * c)) / c), ci = k % c;
    const x = (gi % gc) * (gw + GROUP_GAP) + ci * (CELL + GAP);
    const y = Math.floor(gi / gc) * (gh + GROUP_GAP) + ri * (CELL + GAP);
    const st = k < L ? "lit" : k < D ? "done" : "idle";
    const isNew = st === "lit" && k >= from;
    cells.push(
      <rect key={k} x={x} y={y} width={CELL} height={CELL} rx={0.12}
            className={cx("sc-grid-cell", `sc-grid-${st}`, isNew && "sc-grid-new")}
            style={isNew ? ({ animationDelay: `calc(var(--sc-delay, 0ms) + ${Math.round(((k - from) / Math.max(1, fresh)) * fillMs)}ms)` } as any) : undefined} />,
    );
  }
  return (
    <div className={cx("sc-grid sc-in", className)} data-role={role} style={delayStyle(delay)}>
      <svg className="sc-grid-svg" viewBox={`0 0 ${W} ${H}`} width={Math.round(W * scale)} height={Math.round(H * scale)} fill="none" aria-hidden>
        {cells}
      </svg>
      {(label || sub) && (
        <div className="sc-grid-caption" key={String(typeof label === "string" ? label : L)}>
          {label && <div className="sc-grid-label">{label}</div>}
          {sub && <div className="sc-grid-sub">{sub}</div>}
        </div>
      )}
    </div>
  );
}
