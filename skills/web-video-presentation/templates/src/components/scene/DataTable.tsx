// DataTable — 结果表：逐行揭示、高亮某行 / 某列 / 某格。数字列自动右对齐 + tabular。
//
//   <DataTable columns={["模型", "Easy", "Hard"]} rows={[["基线", 71.2, 40.1], ["DualSQL", 84.0, 61.5]]}
//     shownRows={step} highlight={{ row: 1, col: 2 }} caption="Table 3 · 执行准确率 %" role="primary" />
//
// 讲作者意图：marks 圈出作者要你看的格子（{row} 整行 / {col} 整列 / {row, col} 单格，可多个），
// dimOthers 让其余格退后；intent 一句话写「作者用这几格想证明什么」，渲染在表下（<Intent>）。
//
//   <DataTable … marks={[{ row: 3 }, { row: 3, col: 2, note: "+21.4" }]} dimOthers
//     intent="难题上涨得最多：方法的收益主要来自复杂查询" />
import type { ReactNode } from "react";
import type { RoleProps } from "./common";
import { cx, delayStyle, focusClass, focusStyle } from "./common";
import type { FocusAt } from "./common";
import { Intent } from "./Intent";

export interface TableMark { row?: number; col?: number; /** 格子右上角的小注（「+21.4」「最好」） */ note?: string }

export function DataTable({
  columns, rows, shownRows, highlight, marks, dimOthers = false, intent, caption, focusAt, role, delay, className,
}: RoleProps & {
  /** 行级焦点 */
  focusAt?: FocusAt;
  columns: ReactNode[];
  rows: (ReactNode | number)[][];
  /** 已显示的行数；未给则全显示 */
  shownRows?: number;
  highlight?: { row?: number; col?: number };
  /** 多处高亮：行 / 列 / 格（0 起，行号不含表头） */
  marks?: TableMark[];
  /** 有 marks 时其余格退后 */
  dimOthers?: boolean;
  /** 作者用这张表想说明什么（一句话） */
  intent?: ReactNode;
  caption?: ReactNode;
}) {
  const isNum = (c: number) => rows.every((r) => typeof r[c] === "number" || r[c] === undefined);
  const n = shownRows ?? rows.length;
  const ms: TableMark[] = [...(marks ?? []), ...(highlight && (highlight.row !== undefined || highlight.col !== undefined) ? [highlight] : [])];
  const rowHl = (i: number) => ms.some((m) => m.row === i && m.col === undefined);
  const colHl = (j: number) => ms.some((m) => m.col === j && m.row === undefined);
  const cellMark = (i: number, j: number) => ms.find((m) => m.row === i && m.col === j);
  const lit = (i: number, j: number) => rowHl(i) || colHl(j) || !!cellMark(i, j);
  const dim = dimOthers && ms.length > 0;
  return (
    <div className={cx("sc-in", className)} data-role={role} style={delayStyle(delay)}>
      <table className={cx("sc-table", dim && "sc-table-dim")}>
        <thead><tr>{columns.map((c, j) => <th key={j} className={cx(isNum(j) && "sc-num", colHl(j) && "sc-hl-colhead")}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={cx(i >= n && "sc-hidden", rowHl(i) && "sc-hl-row", i < n && i === n - 1 && "sc-in", i < n && focusClass(focusAt, i))} style={i < n ? focusStyle(focusAt, i) : undefined}>
              {r.map((cell, j) => {
                const m = cellMark(i, j);
                return (
                  <td key={j} className={cx(isNum(j) && "sc-num", colHl(j) && "sc-hl-col", m && "sc-hl-cell", dim && !lit(i, j) && "sc-dim-cell")}>
                    {cell}
                    {m?.note && <span className="sc-cell-note">{m.note}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {caption && <div className="sc-table-caption">{caption}</div>}
      {intent && <Intent>{intent}</Intent>}
    </div>
  );
}
