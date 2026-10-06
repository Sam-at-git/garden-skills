// Prose — 一段或几段文字。size 决定字号档：body 24px / large 40px / display 60px（结论句）。
// 论文步的主文字 44~64px 走 large / display；别拿它当 PPT 正文堆字。
import type { RoleProps } from "./common";
import { cx, delayStyle } from "./common";
import { rich } from "./rich";

export function Prose({
  text, size = "body", align = "left", stagger = false, role, delay, className,
}: RoleProps & {
  text: string | string[];
  size?: "body" | "large" | "display";
  align?: "left" | "center";
  stagger?: boolean;
}) {
  const arr = Array.isArray(text) ? text : [text];
  return (
    <div className={cx("sc-prose", `sc-prose-${size}`, align === "center" && "sc-prose-center", stagger ? "sc-stagger" : "sc-in", className)} data-role={role} style={delayStyle(delay)}>
      {arr.map((t, i) => <p key={i} style={{ "--i": i } as any}>{rich(t)}</p>)}
    </div>
  );
}

/** Quote — 金句 / 论文原话：大号衬线 + 出处行。 */
export function Quote({ text, by, role, delay, className }: RoleProps & { text: string; by?: string }) {
  return (
    <blockquote className={cx("sc-quote sc-in", className)} data-role={role} style={delayStyle(delay)}>
      <p className="sc-quote-text">{rich(text)}</p>
      {by && <footer className="sc-quote-by">{rich(by)}</footer>}
    </blockquote>
  );
}
