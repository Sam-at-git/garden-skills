// Chips — 一排药丸：token 序列 / 模块清单 / 时间线节点。active 点亮、done 变淡、dim 弱化；
// arrows 在相邻 chip 之间画箭头（序列感）。用 id 在相邻步保留，只改 active，就是「逐个点亮」。
//
//   <Chips items={["The", "cat", "sat"]} active={step - 1} arrows role="primary" />
import { Fragment } from "react";
import type { RoleProps } from "./common";
import { cx, delayStyle, focusClass, focusStyle } from "./common";
import type { FocusAt } from "./common";
import { rich } from "./rich";

type ChipState = "idle" | "active" | "done" | "dim";

export function Chips({
  items, active, done = [], size = "md", arrows = false, focusAt, role, delay, className,
}: RoleProps & {
  focusAt?: FocusAt;
  items: (string | { label: string; sub?: string; state?: ChipState })[];
  active?: number | number[];
  done?: number[];
  size?: "md" | "lg";
  arrows?: boolean;
}) {
  const act = new Set(active === undefined ? [] : Array.isArray(active) ? active : [active]);
  const dn = new Set(([] as number[]).concat(done ?? []));
  return (
    <div className={cx("sc-chips", `sc-chips-${size}`, className)} data-role={role} style={delayStyle(delay)}>
      {items.map((it, i) => {
        const c = typeof it === "string" ? { label: it } : it;
        const st: ChipState = c.state ?? (act.has(i) ? "active" : dn.has(i) ? "done" : "idle");
        return (
          <Fragment key={i}>
            <div className={cx("sc-chip sc-in", st !== "idle" && `sc-chip-${st}`, focusClass(focusAt, i))} style={focusStyle(focusAt, i, { "--sc-delay": `${Math.min(150, i * 30)}ms` } as any)}>
              <div className="sc-chip-label">{rich(c.label)}</div>
              {c.sub && <div className="sc-chip-sub">{rich(c.sub)}</div>}
            </div>
            {arrows && i < items.length - 1 && (
              <svg className="sc-chip-arrow" viewBox="0 0 32 24" fill="none" aria-hidden><path d="M2 12 H22" /><polygon points="22,5 30,12 22,19" /></svg>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
