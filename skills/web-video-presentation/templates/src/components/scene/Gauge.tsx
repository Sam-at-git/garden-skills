// Gauge — 一个输入一档档变大，另一个量按真实比例跟着涨，旁边是一个有上限的容器。蓝图 scale-sweep。
//
//   <Gauge role="primary"
//     input={{ value: 9216, max: 32768, label: "N = `9,216` tokens", caption: "一个头的 N × N 分数" }}
//     factors="× 32 个头 × 2 字节"
//     value={5.1} capacity={80} unit="GB" label="HBM 显存" />
//
// input 画成正方形：**边长 ∝ value / max**，所以面积 ∝ value² —— 平方增长看得见，不被压成线性。
// shape: "bar" 时画成横条（长度 ∝ value / max，线性量用这个）。
// 容器是空心竖条：填充 = value / capacity；超过上限时填满并标出「超出」。
// 同 id 相邻步保留 DOM，边长 / 填充高度用 transition 平滑过去（同一个 max / capacity 才能比，
// 规格驱动里 normalizeSpec 会把同 id 序列的 max / capacity 统一）。
import type { ReactNode } from "react";
import type { RoleProps } from "./common";
import { cx, delayStyle } from "./common";

export function Gauge({
  input, factors, value, capacity, unit = "", label, decimals, size = 380, role, delay, className,
}: RoleProps & {
  input?: { value: number; max: number; label?: ReactNode; caption?: ReactNode; shape?: "square" | "bar" };
  /** 从输入到读数的换算因子，写在两者之间（「× 32 个头 × 2 字节」）：屏幕上的派生数字要能验算 */
  factors?: ReactNode;
  value: number;
  capacity: number;
  unit?: string;
  /** 容器叫什么（「HBM 显存」） */
  label?: ReactNode;
  decimals?: number;
  /** 正方形框 / 容器的高度（px） */
  size?: number;
}) {
  const ratio = (v: number, m: number) => (m > 0 && Number.isFinite(v) ? Math.max(0, Math.min(1, v / m)) : 0);
  const fill = ratio(value, capacity), over = capacity > 0 && value > capacity;
  const fmt = (v: number, d = decimals ?? (Math.abs(v) >= 100 || Number.isInteger(v) ? 0 : 1)) =>
    v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  // 容量是固定上限（80 GB），不跟读数的小数位走
  const fmtCap = (v: number) => fmt(v, Number.isInteger(v) ? 0 : Math.min(2, String(v).split(".")[1]?.length ?? 0));
  const inR = input ? ratio(input.value, input.max) : 0;
  const bar = input?.shape === "bar";
  return (
    <div className={cx("sc-gauge sc-in", over && "sc-gauge-over", className)} data-role={role} style={delayStyle(delay, { "--sc-g": `${size}px` } as any)}>
      {input && (
        <div className="sc-gauge-input">
          {input.caption && <div className="sc-gauge-cap">{input.caption}</div>}
          <div className={cx("sc-gauge-box", bar && "sc-gauge-box-bar")}>
            <div className={bar ? "sc-gauge-bar" : "sc-gauge-sq"} style={{ "--r": inR } as any} />
          </div>
          {input.label && <div className="sc-gauge-in-label">{input.label}</div>}
        </div>
      )}
      {factors && <div className="sc-gauge-factors">{factors}</div>}
      <div className="sc-gauge-tank-col">
        <div className="sc-gauge-cap">{label}{label ? " · " : ""}<span className="sc-mono">{fmtCap(capacity)} {unit}</span></div>
        <div className="sc-gauge-tank">
          <div className="sc-gauge-fill" style={{ "--f": fill } as any} />
        </div>
        <div className="sc-gauge-read" key={value}>
          <span className="sc-mono">{fmt(value)} {unit}</span>
          {over && <span className="sc-gauge-over-tag">超出上限</span>}
        </div>
      </div>
    </div>
  );
}
