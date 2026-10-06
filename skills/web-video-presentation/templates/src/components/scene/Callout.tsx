// Callout — 卡片式要点：kicker + 标题 + 正文。tone 决定强调程度。
import type { ReactNode } from "react";
import type { RoleProps } from "./common";
import { cx, delayStyle } from "./common";

export function Callout({
  kicker, title, children, tone = "base", role, delay, className,
}: RoleProps & { kicker?: ReactNode; title?: ReactNode; children?: ReactNode; tone?: "base" | "accent" | "muted" | "plain" }) {
  return (
    <div className={cx("sc-callout sc-in", tone !== "base" && `sc-callout-${tone}`, className)} data-role={role} style={delayStyle(delay)}>
      {kicker && <div className="sc-kicker">{kicker}</div>}
      {title && <div className="sc-callout-title">{title}</div>}
      {children && <div className="sc-callout-body">{children}</div>}
    </div>
  );
}
