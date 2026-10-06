// CodeBlock — 代码 / 伪代码 / SQL / prompt 片段。highlight 点亮若干行，其余行可 dim。
//
//   <CodeBlock lang="sql" title="生成的查询" code={sql} highlight={[3, 4]} dimOthers role="primary" />
//
// 逐段解读（论文里的 Algorithm / 代码清单）：给 notes（每段一条：哪几行 + 这几行在干什么），
// active 指向当前讲的那一条 —— 那几行点亮、其余退后，注释框贴在右侧、和被讲的行对齐。
// vars 是「用一个小例子走一遍」时的变量快照（代码下方一条），同 id 跨步只换值，变了的值会闪一下。
//
//   <CodeBlock title="Algorithm 1 · 两两比较 + Elo" code={algo} role="primary"
//     notes={[{ lines: [1, 3], title: "初始化", text: "每个候选先给 1000 分" },
//             { lines: [4, 8], title: "打一场", text: "抽一对，让模型判谁更好，按结果调分" }]}
//     active={1} vars={[{ name: "R_A", value: "1016" }, { name: "R_B", value: "984" }]} />
import { useLayoutEffect, useRef, useState } from "react";
import type { RoleProps } from "./common";
import { cx, delayStyle } from "./common";
import { rich } from "./rich";

export interface CodeNote {
  /** 1 起的行号：[起, 止] 闭区间，或逐个列出的行号（≥3 个数就按列表处理） */
  lines: number[];
  title?: string;
  text: string;
}
export interface CodeVar { name: string; value: string | number }

/** [3, 6] → 3..6；[3, 5, 9] → 原样 */
export const noteLines = (l: number[] | undefined): number[] =>
  !Array.isArray(l) || !l.length ? [] : l.length === 2 && l[1] >= l[0] ? range(l[0], l[1]) : l.filter((n) => Number.isInteger(n));

export function CodeBlock({
  code, lines, lang, title, highlight = [], dimOthers = false, numbers = true, wrap = false,
  notes, active, vars, varsTitle = "变量", role, delay, className,
}: RoleProps & {
  code?: string;
  lines?: string[];
  lang?: string;
  title?: string;
  /** 1 起的行号；[a, b] 连续区间用 range() 展开 */
  highlight?: number[];
  dimOthers?: boolean;
  numbers?: boolean;
  wrap?: boolean;
  /** 逐段解读：每条 = 一段行 + 一句解释 */
  notes?: CodeNote[];
  /** 当前讲第几条 note（0 起）；不给 = 只显示代码 */
  active?: number;
  /** 走例子时的变量快照 */
  vars?: CodeVar[];
  varsTitle?: string;
}) {
  const ls = lines ?? (code ?? "").replace(/\n$/, "").split("\n");
  const note = notes && active !== undefined ? notes[active] : undefined;
  const noteHl = noteLines(note?.lines);
  const hl = new Set(([] as number[]).concat(highlight ?? [], noteHl));
  const dim = dimOthers || noteHl.length > 0;
  const rail = !!(notes?.length || vars?.length);

  // 注释框对齐到被讲的第一行（行和注释区都以 .sc-codewalk 为定位基准）；放不下就往上推，别压到变量表
  const preRef = useRef<HTMLPreElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  const first = noteHl.length ? Math.min(...noteHl) : 0;
  useLayoutEffect(() => {
    const pre = preRef.current, box = noteRef.current, area = areaRef.current;
    if (!pre || !box || !area || !first) return;
    const line = pre.querySelectorAll<HTMLElement>(".sc-code-line")[first - 1];
    if (!line) return;
    setTop(Math.max(0, Math.min(line.offsetTop - area.offsetTop, area.clientHeight - box.offsetHeight)));
  }, [first, note?.text, ls.length]);

  // 变了的变量闪一下
  const prevVars = useRef<Record<string, string>>({});
  const changed = new Set((vars ?? []).filter((v) => prevVars.current[v.name] !== undefined && prevVars.current[v.name] !== String(v.value)).map((v) => v.name));
  useLayoutEffect(() => { prevVars.current = Object.fromEntries((vars ?? []).map((v) => [v.name, String(v.value)])); });

  const body = (
    <figure className={cx("sc-code", !rail && "sc-in", wrap && "sc-code-wrap", !rail && className)} data-role={rail ? undefined : role} style={rail ? undefined : delayStyle(delay)}>
      {(title || lang) && (
        <div className="sc-code-head"><span>{title}</span><span>{lang}</span></div>
      )}
      <pre ref={preRef}>
        {ls.map((l, i) => (
          <div key={i} className={cx("sc-code-line", hl.has(i + 1) && "sc-hl", dim && hl.size > 0 && !hl.has(i + 1) && "sc-dim")}>
            <span className="sc-code-ln">{numbers ? i + 1 : ""}</span>
            <span>{l || " "}</span>
          </div>
        ))}
      </pre>
    </figure>
  );
  if (!rail) return body;
  return (
    <div className={cx("sc-codewalk sc-in", className)} data-role={role} style={delayStyle(delay)}>
      {body}
      {vars && vars.length > 0 && (
          <div className="sc-code-vars">
            <div className="sc-code-vars-head">{varsTitle}</div>
            {vars.map((v) => (
              <div key={v.name} className={cx("sc-code-var", changed.has(v.name) && "sc-changed")}>
                <span className="sc-code-var-name">{v.name}</span>
                <span className="sc-code-var-val" key={String(v.value)}>{v.value}</span>
              </div>
            ))}
          </div>
        )}

      <div className="sc-code-rail">
        <div ref={areaRef} className="sc-code-notes">
        {note && (
          <div ref={noteRef} key={active} className="sc-code-note" style={{ top }}>
            <div className="sc-code-note-lines">{noteHl.length > 1 ? `L${Math.min(...noteHl)}–${Math.max(...noteHl)}` : `L${noteHl[0] ?? ""}`}{notes && notes.length > 1 ? ` · ${active! + 1}/${notes.length}` : ""}</div>
            {note.title && <div className="sc-code-note-title">{rich(note.title)}</div>}
            <div className="sc-code-note-text">{rich(note.text)}</div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

/** range(3, 6) → [3,4,5,6] */
export const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
