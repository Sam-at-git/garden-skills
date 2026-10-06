// RevealList — 列表逐项揭示：shown 控制已显示几项，前面的项灰化保留（不消失）。
//
//   <RevealList items={[{ title: "第一", body: "…" }, "第二", …]} shown={step - 2} role="primary" />
import type { ReactNode } from "react";
import type { RoleProps } from "./common";
import { cx, delayStyle, focusClass, focusStyle } from "./common";
import type { FocusAt } from "./common";

export type RevealItem = string | { title: ReactNode; body?: ReactNode };

export function RevealList({
  items, shown, ghost = true, numbered = true, reserve = true, focusAt, role, delay, className,
}: RoleProps & {
  focusAt?: FocusAt;
  items: RevealItem[];
  /** 已显示的项数（1 起）；step 推进时 +1 */
  shown: number;
  /** 已显示但不是当前项的灰化 */
  ghost?: boolean;
  numbered?: boolean;
  /** 未显示的项占位（布局不跳动）；false 则不渲染 */
  reserve?: boolean;
}) {
  const n = Math.max(0, Math.min(items.length, shown));
  return (
    <ol className={cx("sc-list", className)} data-role={role} style={delayStyle(delay)}>
      {items.map((it, i) => {
        const visible = i < n;
        if (!visible && !reserve) return null;
        const cur = i === n - 1;
        const t = typeof it === "string" ? { title: it, body: undefined } : it;
        return (
          <li key={i} className={cx("sc-list-item", !visible && "sc-hidden", visible && cur && "sc-current sc-in", visible && !cur && ghost && "sc-ghost", visible && focusClass(focusAt, i))} style={visible ? focusStyle(focusAt, i) : undefined}>
            <span className="sc-list-num">{numbered ? String(i + 1).padStart(2, "0") : "·"}</span>
            <div>
              <div className="sc-list-title">{t.title}</div>
              {t.body && <div className="sc-list-body">{t.body}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
