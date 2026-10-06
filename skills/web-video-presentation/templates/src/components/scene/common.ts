// 场景组件共用的小类型与工具。
import type { CSSProperties } from "react";

export type Role = "primary" | "secondary" | "background" | "annotation";
export type Composition =
  | "centered-hero" | "asymmetric-60-40" | "split-screen" | "rule-of-thirds"
  | "full-width-strip" | "layered-depth" | "triptych" | "diagram-canvas";

export interface RoleProps {
  /** data-role：每步一个 primary */
  role?: Role;
  /** 入场延迟 ms。primary 请保持 ≤150（smoke 采样只等 220ms） */
  delay?: number;
  className?: string;
}

/** 条目级焦点：第 i 项的 [on, off]（占本步时长比例）；undefined = 该项不参与 */
export type FocusAt = ([number, number] | undefined)[];
export const focusStyle = (f: FocusAt | undefined, i: number, extra?: CSSProperties): CSSProperties => {
  const t = f?.[i];
  return t ? ({ ...extra, "--on": t[0], "--off": t[1] } as CSSProperties) : (extra ?? {});
};
export const focusClass = (f: FocusAt | undefined, i: number) => (f?.[i] ? "sc-focus" : "");

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");
export const delayStyle = (delay?: number, extra?: CSSProperties): CSSProperties =>
  ({ ...(delay ? { "--sc-delay": `${delay}ms` } : {}), ...extra } as CSSProperties);
