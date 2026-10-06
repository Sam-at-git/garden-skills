// Intent — 「作者想用这张图 / 表说明什么」的一行结论，挂在图表下面。
//
// 论文里的表和图不是数据堆，是论据：作者放它是为了证明某句话。讲的时候先说「看哪里」（DataTable marks /
// FigureLens active / BarChart accent），再用这一行把那句话写出来。PAPER-INTERPRETATION.md §6.4。
//
//   <Intent>难题上涨最多：收益主要来自复杂查询</Intent>
//   <Intent label="但要注意">只在 Spider 上测过，没有跨库</Intent>     // 讲者补的保留意见用别的 label
import type { ReactNode } from "react";
import { cx } from "./common";

export function Intent({ children, label = "作者想说明", tone = "claim", className }: { children: ReactNode; label?: string; tone?: "claim" | "caveat"; className?: string }) {
  return (
    <div className={cx("sc-intent", tone === "caveat" && "sc-intent-caveat", className)}>
      <span className="sc-intent-label">{label}</span>
      <span className="sc-intent-text">{children}</span>
    </div>
  );
}
