// BigNumber — 大数字 + 单位 + 说明。countUp 时整数部分从 0 数到目标值（CSS 计数，暂停时会停）。
//
//   <BigNumber value={83.7} unit="%" label="执行准确率" sub="Table 2 · Hard" countUp role="primary" />
//   <Stats>{…多个 BigNumber…}</Stats>
import { useRef, type ReactNode } from "react";
import { useFitZoom } from "./fit";
import type { RoleProps } from "./common";
import { cx, delayStyle, focusStyle } from "./common";

export function BigNumber({
  value, unit, label, sub, size = "d2", countUp = false, accent = false, focus, role, delay, className,
}: RoleProps & {
  /** 步内焦点 [on, off]（占本步时长比例） */
  focus?: [number, number];
  value: number | string;
  unit?: ReactNode;
  label?: ReactNode;
  sub?: ReactNode;
  size?: "h1" | "d2" | "d1";
  countUp?: boolean;
  accent?: boolean;
}) {
  let body: ReactNode = value;
  if (countUp && typeof value === "number") {
    const int = Math.trunc(Math.abs(value));
    const frac = String(Math.abs(value)).split(".")[1];
    body = (
      <>
        {value < 0 && "−"}
        {/* 按终值位数占宽：从 0 数起时只有一位，fit 量到的是窄的，数完 3 个数字一排就伸出窄栏（2610.06790 第 3 章） */}
        <span className="sc-bignum-count" style={{ "--sc-to": int, minWidth: `${String(int).length}ch` } as any} />
        {frac !== undefined && `.${frac}`}
      </>
    );
  }
  return (
    <div className={cx("sc-bignum sc-in", `sc-bignum-${size}`, accent && "sc-bignum-accent", focus && "sc-focus", className)} data-role={role} style={focus ? focusStyle([focus], 0, delayStyle(delay)) : delayStyle(delay)}>
      <div className="sc-bignum-value">
        <span>{body}</span>
        {unit && <span className="sc-bignum-unit">{unit}</span>}
      </div>
      {label && <div className="sc-bignum-label">{label}</div>}
      {sub && <div className="sc-bignum-sub">{sub}</div>}
    </div>
  );
}

/** 一排数字并列（等宽列） */
// 列宽至少按内容（数字 + 单位不换行）：以前等宽 1fr，「±1.25」「0.05」「mmHg」伸进隔壁列叠在一起。
// 整排放不下就整体等比缩小（和 Diagram 一样按宽度 zoom），不会伸出画面
export function Stats({ children, role, className }: RoleProps & { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useFitZoom(ref, "width", 0.6, [children], { cls: "sc-stats-col", below: 0.8 }); // 窄栏放不下一排：改竖排（3 项在 40% 栏里缩到 0.6 还被裁）
  return <div className="sc-stats-fit" data-role={role}><div ref={ref} className={cx("sc-stats sc-stagger", className)}>{children}</div></div>;
}
