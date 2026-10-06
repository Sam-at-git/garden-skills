// Scene — 一步的根元素。带 data-composition、安全区内边距、垂直居中（grid/flex 内容贴顶那个坑在这里一次解决）。
//
//   <Scene composition="split-screen" title="为什么要条件边">
//     <Compare … />
//   </Scene>
//
// layout=true 时把布局交给 composition.css 的 [data-composition-layout] 网格（子元素按 data-role 落位）。
import type { CSSProperties, ReactNode } from "react";
import type { Composition } from "./common";
import { cx } from "./common";

export function Scene({
  composition, kicker, title, lead, titleSize = "h2", children, layout = false, stable = false, align = "center",
  className, style, headKey,
}: {
  composition: Composition;
  /** 已退役：标题上方的小标签不再上屏（左上角只留标题）。保留字段只为老章节能编译 */
  kicker?: ReactNode;
  title?: ReactNode;
  lead?: ReactNode;
  titleSize?: "h1" | "h2";
  children?: ReactNode;
  /** 交给 composition.css 的网格布局（子元素需带 data-role） */
  layout?: boolean;
  /** 有意的连续同构图（消融/对照系列）时标记，免 composition-variety fail */
  stable?: boolean;
  align?: "center" | "top";
  className?: string;
  style?: CSSProperties;
  /** 标题区的 key：变了就重新入场。kicker/title 是 ReactNode 时（SpecChapter）由调用方给 */
  headKey?: string;
}) {
  const attrs: Record<string, string> = { "data-composition": composition };
  if (layout) attrs["data-composition-layout"] = "";
  if (stable) attrs["data-composition-stable"] = "true";
  // key 跟着文字走：同构图的相邻步换了标题，标题重新入场；没换就原地不动（SpecChapter 的同 id 积木保留靠这个）
  const head = (title || lead) && (
    <header key={headKey ?? `${typeof kicker === "string" ? kicker : ""}|${typeof title === "string" ? title : ""}`} className="sc-scene-head sc-in" data-role={layout ? "annotation" : undefined}>
      {title && <h2 className={cx("sc-title", titleSize === "h1" && "sc-title-lg")}>{title}</h2>}
      {lead && <p className="sc-lead">{lead}</p>}
    </header>
  );
  if (layout) {
    return <div {...attrs} className={cx("sc-scene-layout", className)} style={style}>{head}{children}</div>;
  }
  return (
    <div {...attrs} className={cx("sc-scene", align === "top" && "sc-scene-top", className)} style={style}>
      {head}
      <div className="sc-body">{children}</div>
    </div>
  );
}
