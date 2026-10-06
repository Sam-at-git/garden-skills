// Compare — 两栏 / 三栏对照（同尺度并排）。tone 决定强调，verdict 是底部结论。
//
//   <Compare role="primary" verdict="多轮 + 工具 = 少 30% 的失败"
//     columns={[{ title: "单次生成", body: <RevealList … /> }, { title: "DualSQL", body: …, tone: "accent" }]} />
import type { ReactNode } from "react";
import type { RoleProps } from "./common";
import { cx, delayStyle, focusClass, focusStyle } from "./common";
import type { FocusAt } from "./common";

export function Compare({
  columns, verdict, focusAt, role, delay, className,
}: RoleProps & {
  focusAt?: FocusAt;
  columns: { title: ReactNode; body: ReactNode; tone?: "base" | "accent" | "muted" }[];
  verdict?: ReactNode;
}) {
  return (
    <div className={cx("sc-compare sc-stagger", className)} data-role={role} style={delayStyle(delay, { "--sc-cols": columns.length } as any)}>
      {columns.map((c, i) => (
        <div key={i} className={cx("sc-compare-col", c.tone === "accent" && "sc-compare-accent", c.tone === "muted" && "sc-compare-muted", focusClass(focusAt, i))} style={focusStyle(focusAt, i, { "--i": i } as any)}>
          <div className="sc-compare-head">{c.title}</div>
          <div className="sc-compare-body">{c.body}</div>
        </div>
      ))}
      {verdict && <div className="sc-compare-verdict sc-in" style={{ "--sc-delay": "600ms" } as any}>{verdict}</div>}
    </div>
  );
}
