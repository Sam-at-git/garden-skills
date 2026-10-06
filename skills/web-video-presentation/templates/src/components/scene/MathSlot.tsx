// MathSlot（无 KaTeX 版）— 项目没带 --math 时的公式槽：把 TeX 当等宽文本显示，不崩、不引入 katex。
// 脚手架 --math 时会用 components/MathSlot.katex.tsx 覆盖这个文件（同名同导出、同 props）。
// 逐符号讲解（symbols / active）在这里退化成：式子等宽原样显示，词表照常逐行出现、当前行点亮。
import type { RoleProps } from "./common";
import { cx, delayStyle } from "./common";
import { rich } from "./rich";
import { activeList, glossaryRows, looksTex, texToText } from "./formula-marks";
import type { FormulaSymbol } from "./formula-marks";

export const FORMULA_COLORS: Record<string, string> = {
  accent: "var(--accent)", fact: "var(--ev-fact, var(--text))", supported: "var(--ev-supported, var(--accent))", infer: "var(--ev-infer, var(--text-mute))",
};

export function FormulaSlot({
  tex, parts, shown, caption, symbols, active, idea, significance, role, delay, className,
}: RoleProps & {
  tex?: string; parts?: { tex: string; color?: string }[]; shown?: number; caption?: string;
  symbols?: FormulaSymbol[]; active?: number | number[]; idea?: string; significance?: string;
}) {
  const strip = (t: string) => t.replace(/\[\[([\s\S]+?)\]\](?!\])/g, "$1");
  const notes = (idea || significance) && (
    <div className="sc-fx-notes">
      {idea && <p><span className="sc-fx-tag">思想</span>{rich(idea)}</p>}
      {significance && <p><span className="sc-fx-tag">意义</span>{rich(significance)}</p>}
    </div>
  );
  if (symbols?.length && tex) {
    const act = activeList(active, symbols.length);
    const rows = glossaryRows(symbols.length, act, shown);
    return (
      <div className={cx("sc-formula sc-fx sc-in", className)} data-role={role} style={delayStyle(delay)}>
        <div className="sc-formula-body sc-mono">{strip(tex)}</div>
        <dl className={cx("sc-fx-gloss", symbols.length > 4 && "sc-fx-gloss-2")}>
          {symbols.map((s, i) => (
            <div key={i} className={cx("sc-fx-row", i >= rows && "sc-fx-hidden", act.includes(i) && "sc-fx-on")}>
              <dt className="sc-fx-sym sc-mono">{s.tex}</dt>
              <dd><span className="sc-fx-name">{looksTex(s.name) ? texToText(s.name) : rich(s.name)}</span>{s.meaning && <span className="sc-fx-meaning">{rich(s.meaning)}</span>}</dd>
            </div>
          ))}
        </dl>
        {notes}
        {caption && <div className="sc-formula-caption">{rich(caption)}</div>}
      </div>
    );
  }
  const n = shown ?? (parts?.length ?? 0);
  return (
    <div className={cx("sc-formula sc-in", className)} data-role={role} style={delayStyle(delay)}>
      <div className="sc-formula-body sc-mono">
        {parts
          ? parts.map((p, i) => (
              <span key={i} className={cx("sc-formula-part", i >= n && "sc-formula-muted")} style={i < n && p.color ? { color: FORMULA_COLORS[p.color] ?? p.color } : undefined}>{strip(p.tex)} </span>
            ))
          : strip(tex ?? "")}
      </div>
      {notes}
      {caption && <div className="sc-formula-caption">{rich(caption)}</div>}
    </div>
  );
}
