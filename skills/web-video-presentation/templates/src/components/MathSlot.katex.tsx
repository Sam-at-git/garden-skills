// MathSlot（KaTeX 版）— 脚手架 --math 时复制为 src/components/scene/MathSlot.tsx，替换无 KaTeX 的桩。
// 注意：import 路径按**复制后的位置**（scene/）写，这个文件在 templates 里不参与编译。
// 导出与桩完全一致：FormulaSlot / FORMULA_COLORS。
//
// 两种用法：
//   1. 分部揭示（parts + shown）：整式全部弱化预览 → 逐部分点亮（固定色）→ 代入微数字。PAPER-INTERPRETATION.md §7
//   2. 逐符号讲解（tex + symbols + active）：整式不拆，当前讲的符号在式子里点亮、其余退后，
//      下方词表逐行出现「符号 · 叫什么 · 管什么」；idea / significance 两行给「它在说什么」「为什么重要」。§7
//      同 id 跨步只换 active，高亮在式子里平移，式子本身不重排。
// 着色走 CSS（.sc-fx 段按 data-act / data-done 选中 \htmlClass 包出来的 fx-s-i），不走 \textcolor（KaTeX 不认 var()）。
import katex from "katex";
import { useRef } from "react";
import { useFitZoom } from "./fit";
import type { RoleProps } from "./common";
import { cx, delayStyle } from "./common";
import { rich } from "./rich";
import { activeList, glossaryRows, looksTex, markSymbols, symbolState } from "./formula-marks";
import type { FormulaSymbol } from "./formula-marks";

export const FORMULA_COLORS: Record<string, string> = {
  accent: "var(--accent)", fact: "var(--ev-fact, var(--text))", supported: "var(--ev-supported, var(--accent))", infer: "var(--ev-infer, var(--text-mute))",
};

// \htmlClass 需要 trust；只放行它一个，别的 \href / \url 照旧拦住
const render = (tex: string, display: boolean) =>
  katex.renderToString(tex, { throwOnError: false, displayMode: display, output: "html", strict: "ignore", trust: (c: { command: string }) => c.command === "\\htmlClass" });

export function FormulaSlot({
  tex, parts, shown, caption, symbols, active, idea, significance, role, delay, className,
}: RoleProps & {
  tex?: string; parts?: { tex: string; color?: string }[]; shown?: number; caption?: string;
  symbols?: FormulaSymbol[]; active?: number | number[]; idea?: string; significance?: string;
}) {
  // 式子比所在的栏宽就整体等比缩小（首跑：60% 栏里的长式子左右两头被裁掉）
  const bodyRef = useRef<HTMLDivElement>(null);
  useFitZoom(bodyRef, "width", 0.4, [tex, parts?.length]);
  // name 写成了 TeX（"\\beta"）就按公式渲染，别把源码打上屏
  const nameNode = (n: string) => (looksTex(n) ? <span dangerouslySetInnerHTML={{ __html: render(n.replace(/^\$|\$$/g, ""), false) }} /> : rich(n));
  if (symbols?.length && tex) {
    const act = activeList(active, symbols.length);
    const rows = glossaryRows(symbols.length, act, shown);
    const st = symbolState(act, rows);
    return (
      <div className={cx("sc-formula sc-fx sc-in", className)} data-role={role} style={delayStyle(delay)}
           data-act={st.act || undefined} data-done={st.done || undefined} data-focus={act.length ? "" : undefined}>
        <div className="sc-formula-fit"><div ref={bodyRef} className="sc-formula-body math-display" dangerouslySetInnerHTML={{ __html: render(markSymbols(tex, symbols), true) }} /></div>
        <dl className={cx("sc-fx-gloss", symbols.length > 4 && "sc-fx-gloss-2")}>
          {symbols.map((s, i) => (
            <div key={i} className={cx("sc-fx-row", `fx-row-${i}`, i >= rows && "sc-fx-hidden", act.includes(i) && "sc-fx-on")}>
              <dt className="sc-fx-sym" dangerouslySetInnerHTML={{ __html: render(s.tex, false) }} />
              <dd><span className="sc-fx-name">{nameNode(s.name)}</span>{s.meaning && <span className="sc-fx-meaning">{rich(s.meaning)}</span>}</dd>
            </div>
          ))}
        </dl>
        {(idea || significance) && (
          <div className="sc-fx-notes">
            {idea && <p><span className="sc-fx-tag">思想</span>{rich(idea)}</p>}
            {significance && <p><span className="sc-fx-tag">意义</span>{rich(significance)}</p>}
          </div>
        )}
        {caption && <div className="sc-formula-caption">{rich(caption)}</div>}
      </div>
    );
  }
  const n = shown ?? (parts?.length ?? 0);
  return (
    <div className={cx("sc-formula sc-in", className)} data-role={role} style={delayStyle(delay)}>
      <div className="sc-formula-fit"><div ref={bodyRef} className="sc-formula-body math-display">
        {parts
          ? parts.map((p, i) => (
              <span key={i} className={cx("sc-formula-part", i >= n && "sc-formula-muted")}
                    style={i < n && p.color ? { color: FORMULA_COLORS[p.color] ?? p.color } : undefined}
                    dangerouslySetInnerHTML={{ __html: render(markSymbols(p.tex, [], true), false) }} />
            ))
          : <span dangerouslySetInnerHTML={{ __html: render(markSymbols(tex ?? "", [], true), true) }} />}
      </div></div>
      {(idea || significance) && (
        <div className="sc-fx-notes">
          {idea && <p><span className="sc-fx-tag">思想</span>{rich(idea)}</p>}
          {significance && <p><span className="sc-fx-tag">意义</span>{rich(significance)}</p>}
        </div>
      )}
      {caption && <div className="sc-formula-caption">{rich(caption)}</div>}
    </div>
  );
}
