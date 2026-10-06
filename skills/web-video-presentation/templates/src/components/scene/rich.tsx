// rich.tsx — 规格里字符串的轻量标记：**强调** → accent；`等宽` → mono；\n → 换行。
// 只做这三样：规格是数据，不该长成另一种模板语言。
// 另外两件兜底（20 篇视觉评审里 raw-tex 25 条）：
//   - 字面的「\n」（JSON 里转义了两次，画面上出现反斜杠 n）也当换行；后面紧跟英文字母的不算（\nabla、\neq 是 TeX）
//   - 普通文字里的 TeX 片段（$\pi$、\beta、c_{t+1}）交给 texLite 转成能读的字；反引号里的等宽文字不动
import { Fragment, type ReactNode } from "react";
import { texLite } from "./tex-lite";

const TOKEN = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;

/**
 * 长标识符（find_signal_in_scope(moduleA)、a.b.c.d、路径）没有断行点，窄栏里整串伸出去被裁（2610.06790 第 4 章）。
 * ≥16 个字符的无空格串，在 _ . / ( : 后面插零宽空格 —— 要折时折在符号后（find_signal_ / in_scope(），不够宽时照常一行。
 * 不用 overflow-wrap: anywhere：它把 min-content 压到一个字宽，栏会被挤窄、普通英文单词也被拦腰切开。
 */
const LONG = /[^\s\u200b]{16,}/g;
export function softBreak(s: string): string {
  return s.includes("_") || s.includes(".") || s.includes("/") || s.includes("(") || s.includes(":")
    ? s.replace(LONG, (w) => w.replace(/([_./(:])(?=[^\s])/g, "$1\u200b"))
    : s;
}
const plain = (s: string, key: string): ReactNode => { const t = texLite(s, key); return typeof t === "string" ? softBreak(t) : t; };

export function rich(s: string | undefined | null): ReactNode {
  if (s === undefined || s === null || s === "") return null;
  const lines = String(s).split(/\n|\\n(?![A-Za-z])/);
  return lines.map((line, li) => (
    <Fragment key={li}>
      {li > 0 && <br />}
      {line.split(TOKEN).map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) return <em key={i} className="sc-em">{plain(part.slice(2, -2), `${li}-${i}e`)}</em>;
        if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="sc-mono">{softBreak(part.slice(1, -1))}</code>;
        return part ? <Fragment key={i}>{plain(part, `${li}-${i}`)}</Fragment> : null;
      })}
    </Fragment>
  ));
}

/** 一段里用 \n 分开的行各自成块：text-wrap: balance 才能逐行均分（整段 + <br> 时它管不到单行，
 *  「模型对自己产出警惕性低」照样折成「…警惕性 / 低」）。空行留一点间距 */
function lineBlocks(t: string): ReactNode {
  const lines = String(t).split(/\n|\\n(?![A-Za-z])/);
  if (lines.length === 1) return rich(t);
  return lines.map((l, i) => (l.trim() ? <span key={i} className="sc-line">{rich(l)}</span> : <span key={i} className="sc-line sc-line-gap" />));
}

/** string | string[] → 段落列表 */
export function paragraphs(x: string | string[] | undefined, className = "sc-p"): ReactNode {
  if (x === undefined) return null;
  const arr = Array.isArray(x) ? x : [x];
  return arr.map((t, i) => <p key={i} className={className}>{lineBlocks(t)}</p>);
}
