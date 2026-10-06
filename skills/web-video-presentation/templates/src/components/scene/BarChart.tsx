// BarChart — 柱图。基线永远在 0；标签在独立行里，不会把柱子顶离零线；数字 tabular；柱子从 0 长起。
//
//   <BarChart title="Table 2 · 执行准确率 (%)" unit="%" role="primary"
//     items={[{ label: "基线", value: 61.2 }, { label: "DualSQL", value: 83.7, accent: true, delta: "+22.5" }]}
//     reference={{ value: 70, label: "GPT-4 参考" }} />
//   横向：<BarChart orientation="horizontal" … />
import type { ReactNode } from "react";
import type { RoleProps } from "./common";
import { cx, delayStyle } from "./common";

export interface BarItem {
  label: ReactNode;
  value: number;
  /** 标签下的小字（模型名 / 条件） */
  sub?: ReactNode;
  accent?: boolean;
  dim?: boolean;
  /** 柱顶的差值标记，如 "+22.5" */
  delta?: ReactNode;
  /** 误差范围（绝对值），画成 whisker */
  err?: [number, number];
}

export function BarChart({
  items, max, unit = "", title, decimals = 1, showValues = true, reference, orientation = "vertical", height = 520,
  role, delay, className,
}: RoleProps & {
  items: BarItem[];
  /** 纵轴最大值；默认最大值的 1.12 倍（含误差上界） */
  max?: number;
  unit?: string;
  title?: ReactNode;
  decimals?: number;
  showValues?: boolean;
  reference?: { value: number; label?: ReactNode };
  orientation?: "vertical" | "horizontal";
  height?: number;
}) {
  // 负值：零线按比例上移，负值柱向下画。以前一律夹到 0，-0.62 / -2.3pp 的柱子直接消失（bar-baseline 4 条）
  const lowest = Math.min(0, ...items.map((b) => Math.min(b.value, b.err?.[0] ?? b.value)));
  const neg = lowest < 0 && orientation === "vertical";
  const top = max ?? Math.max(...items.map((b) => Math.max(b.value, b.err?.[1] ?? b.value)), reference?.value ?? 0) * 1.12;
  const bottom = neg ? lowest * 1.12 : 0;
  const span = top - bottom || 1;
  const fmt = (v: number) => `${typeof v === "number" && Number.isFinite(v) ? v.toFixed(decimals) : "—"}${unit}`;
  // 高度占比（相对整个绘图区），以及从哪里起画（--b，零线位置或负值柱的底）
  const v = (x: number) => Math.max(0, Math.min(1, (neg ? Math.abs(x) : x) / (neg ? span : top)));
  const zero = neg ? -bottom / span : 0;
  const at = (x: number) => Math.max(0, Math.min(1, (x - bottom) / span)); // 某个数值在绘图区里的高度位置
  const styleOf = (b: BarItem, i: number) => ({ "--v": v(b.value), "--i": i, "--top": neg ? at(Math.max(b.value, b.err?.[1] ?? b.value, 0)) : v(Math.max(b.value, b.err?.[1] ?? b.value)),
    ...(neg ? { "--b": b.value < 0 ? at(b.value) : zero, "--bot": at(Math.min(b.value, b.err?.[0] ?? b.value, 0)) } : {}),
    ...(b.err ? { "--lo": neg ? at(b.err[0]) : v(b.err[0]), "--hi": neg ? at(b.err[1]) : v(b.err[1]) } : {}) }) as any;

  if (orientation === "horizontal") {
    return (
      <div className={cx("sc-bars-h sc-in", className)} data-role={role} style={delayStyle(delay)}>
        {title && <div className="sc-bars-title">{title}</div>}
        {items.map((b, i) => (
          <div key={i} className={cx("sc-hbar-row", b.accent && "sc-bar-accent", b.dim && "sc-bar-dim")} style={styleOf(b, i)}>
            <div className="sc-hbar-label">{b.label}{b.sub && <small> {b.sub}</small>}</div>
            <div className="sc-hbar-track"><div className="sc-hbar" style={b.accent ? { background: "var(--accent)" } : undefined} /></div>
            <div className="sc-hbar-value">{showValues && fmt(b.value)}{b.delta && <span className="sc-bar-delta-inline"> {b.delta}</span>}</div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={cx("sc-bars sc-in", reference && "sc-bars-has-ref", neg && "sc-bars-neg", className)} data-role={role} style={delayStyle(delay, { "--sc-chart-h": `${height}px`, "--z": zero } as any)}>
      <div className="sc-bars-title">{title}</div>
      <div className="sc-bars-plot">
        {reference && (
          <div className="sc-bars-ref" style={{ "--v": neg ? at(reference.value) : v(reference.value) } as any}><span>{reference.label ?? fmt(reference.value)}</span></div>
        )}
        {items.map((b, i) => (
          <div key={i} className={cx("sc-bar-col", b.accent && "sc-bar-accent", b.dim && "sc-bar-dim", neg && b.value < 0 && "sc-bar-negv")} style={styleOf(b, i)}>
            {b.delta && <div className="sc-bar-delta">{b.delta}</div>}
            {showValues && <div className="sc-bar-value">{fmt(b.value)}</div>}
            <div className="sc-bar" />
            {b.err && <div className="sc-bar-whisker" />}
          </div>
        ))}
      </div>
      <div className="sc-bars-labels">
        {items.map((b, i) => <div key={i} className="sc-bar-label">{b.label}{b.sub && <small>{b.sub}</small>}</div>)}
      </div>
    </div>
  );
}
