// Flow — 数据包沿轨道一趟一趟地跑：把「搬了几次」做成能数的事件。蓝图 trip-count；
// 也用来演「延迟 vs 带宽」（两条轨道速度相同、包的宽度不同）。
//
//   <Flow role="primary" lanes={[
//     { from: "显存", to: "片上", label: "两个 kernel", trips: [{ label: "a" }, { label: "b" }, { label: "t", back: true }, { label: "t" }, { label: "y", back: true }] },
//     { from: "显存", to: "片上", label: "融合成一个", trips: [{ label: "a" }, { label: "b" }, { label: "y", back: true }] },
//   ]} />
//
// 规格（spec.json）里 trips 可以直接写字符串（= 包上的标签），SpecChapter 会转成 { label }。
//
// 所有轨道共用一个时钟：第 k 趟在 k × tripMs 出发，趟数少的那条先跑完 —— 差了几趟一眼看得见。
// 每跑完一趟，右侧计数区留一道刻度；全部跑完后出现计数（默认「N 趟」，count 可改写）。
// 同 id 相邻步保留 DOM：trips 变长时只有新加的那几趟会跑，旧的直接显示成刻度。
// 一步内所有动画在 ~3.6s 内跑完然后定格，最后一趟的包停在终点，不循环。
import { useState, type ReactNode } from "react";
import type { RoleProps } from "./common";
import { cx, delayStyle } from "./common";

export interface FlowTrip { label?: ReactNode; back?: boolean }
export interface FlowLane {
  from: ReactNode;
  to: ReactNode;
  /** 轨道下方的一行说明 */
  label?: ReactNode;
  /** 每个包的宽度（1~4 格并排）：带宽。延迟 vs 带宽 = 速度一样、宽度不同 */
  width?: number;
  /** 每一趟：字符串 = 包上的标签（从 from 到 to）；back: true = 从 to 回到 from */
  trips: FlowTrip[];
  /** 跑完后显示的计数，默认「N 趟」 */
  count?: ReactNode;
  /** 弱化这条轨道（对照组） */
  dim?: boolean;
}

export function Flow({
  lanes, tripMs, role, delay, className,
}: RoleProps & {
  lanes: FlowLane[];
  /** 每一趟的时长（ms）；默认按最多趟数把整步压在 ~3.6s 内（单趟 450~900ms） */
  tripMs?: number;
}) {
  const norm = lanes.map((l) => ({ ...l, trips: (l.trips || []).map((t) => t || {}) }));
  // 每条轨道在之前的步里已经跑过几趟：只让新增的趟数动起来。基线只在趟数真的变了才挪 ——
  // 同一步里父组件重渲染不能把正在飞的包抹掉
  const lens = norm.map((l) => l.trips.length), sig = lens.join(",");
  // （React 的「prop 变了就在渲染时调整 state」写法）
  const [mem, setMem] = useState(() => ({ sig, lens, before: lens.map(() => 0) }));
  const before = mem.sig === sig ? mem.before : lens.map((n, i) => Math.min(mem.lens[i] ?? 0, n));
  if (mem.sig !== sig) setMem({ sig, lens, before });
  const fresh = Math.max(1, ...norm.map((l, i) => l.trips.length - before[i]));
  const T = Math.round(tripMs ?? Math.max(450, Math.min(900, 3600 / fresh)));

  return (
    <div className={cx("sc-flow sc-in", className)} data-role={role} style={delayStyle(delay, { "--sc-trip": `${T}ms` } as any)}>
      {norm.map((l, i) => {
        const w = Math.max(1, Math.min(4, Math.floor(l.width ?? 1)));
        const n = l.trips.length, b0 = before[i];
        const end = (n - b0) * T; // 本步这条轨道跑完的时刻（相对 --sc-delay）
        return (
          <div key={i} className={cx("sc-flow-lane", l.dim && "sc-flow-dim")}>
            <div className="sc-flow-end sc-flow-from">{l.from}</div>
            <div className="sc-flow-track-wrap">
              <div className="sc-flow-track">
                {l.trips.map((t, k) => {
                  if (k < b0) return null; // 之前步跑过的趟：不再跑，只留刻度
                  const last = k === n - 1;
                  return (
                    <div key={k} className={cx("sc-flow-packet", t.label ? "sc-flow-tagged" : `sc-flow-w${w}`, t.back && "sc-flow-back", last && "sc-flow-rest")}
                         style={{ animationDelay: `calc(var(--sc-delay, 0ms) + ${(k - b0) * T}ms)` }}>
                      {t.label ? <span>{t.label}</span> : Array.from({ length: w }, (_, q) => <i key={q} />)}
                    </div>
                  );
                })}
              </div>
              {l.label && <div className="sc-flow-label">{l.label}</div>}
            </div>
            <div className="sc-flow-end sc-flow-to">{l.to}</div>
            <div className="sc-flow-count">
              <div className="sc-flow-ticks">
                {l.trips.map((_, k) => (
                  <i key={k} className={k >= b0 ? "sc-flow-tick-new" : undefined}
                     style={k >= b0 ? { animationDelay: `calc(var(--sc-delay, 0ms) + ${(k - b0 + 1) * T}ms)` } : undefined} />
                ))}
              </div>
              <div className={cx("sc-flow-total", n > b0 && "sc-flow-total-new")} key={n}
                   style={n > b0 ? { animationDelay: `calc(var(--sc-delay, 0ms) + ${end}ms)` } : undefined}>
                {l.count ?? `${n} 趟`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
