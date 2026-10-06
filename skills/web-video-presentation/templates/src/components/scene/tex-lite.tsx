// tex-lite.tsx — 普通文字（Callout / Chips / Pipeline / 列表 …）里的 TeX 片段转成能读的字。
//
// 规格里只有 Formula 积木走 KaTeX；模型常在别的字符串里顺手写 `$\pi$`、`\beta`、`c_{t+1}`、`h^f_t`，
// 以前原样上屏（20 篇里 raw-tex 25 条）。这里不追求排版，只保证读得出来：
//   - `$…$` 里的内容按公式处理：命令换成 Unicode，`_x` / `_{…}` / `^x` / `^{…}` 渲染成 <sub> / <sup>
//   - `$` 之外只动「明确是 TeX」的：反斜杠命令（\beta、\times、\frac{a}{b}…）、`_{…}` / `^{…}`、
//     「单个字母 + _ + 单个字符」（c_t、x_i），以及紧跟字母或数字的 `^x`（h^f、x^2）。tool_use、__history__
//     这类代码标识符不碰（反引号里的等宽文字由 rich() 跳过，根本不进这里）
import { Fragment, type ReactNode } from "react";

const SYM: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", vartheta: "ϑ",
  iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ",
  phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  times: "×", cdot: "·", div: "÷", pm: "±", mp: "∓", le: "≤", leq: "≤", ge: "≥", geq: "≥", ne: "≠", neq: "≠",
  approx: "≈", sim: "∼", simeq: "≃", equiv: "≡", propto: "∝", ll: "≪", gg: "≫",
  to: "→", rightarrow: "→", leftarrow: "←", Rightarrow: "⇒", Leftarrow: "⇐", leftrightarrow: "↔", mapsto: "↦", gets: "←",
  in: "∈", notin: "∉", subset: "⊂", subseteq: "⊆", supset: "⊃", cup: "∪", cap: "∩", emptyset: "∅", varnothing: "∅",
  forall: "∀", exists: "∃", neg: "¬", land: "∧", lor: "∨", wedge: "∧", vee: "∨", oplus: "⊕", otimes: "⊗", circ: "∘", star: "⋆",
  sum: "Σ", prod: "Π", int: "∫", infty: "∞", partial: "∂", nabla: "∇", sqrt: "√",
  ldots: "…", cdots: "⋯", dots: "…", mid: "|", langle: "⟨", rangle: "⟩", lfloor: "⌊", rfloor: "⌋", lceil: "⌈", rceil: "⌉",
  top: "⊤", perp: "⊥", prime: "′", degree: "°", ell: "ℓ", hbar: "ℏ",
};
// 只取内容的包装命令
const WRAP = /\\(?:text|mathrm|mathbf|mathit|mathcal|mathbb|mathsf|operatorname|boldsymbol|bm|textbf|textit|hat|bar|tilde|vec|overline|underline)\{([^{}]*)\}/g;

/** 命令 → Unicode（字符串层面） */
function commands(s: string, mathMode: boolean): string {
  let t = s;
  for (let i = 0; i < 3; i++) t = t.replace(WRAP, "$1");                    // 嵌套几层也剥掉
  t = t.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, (_m, a, b) => `${/^\w+$/.test(a) ? a : `(${a})`}/${/^\w+$/.test(b) ? b : `(${b})`}`);
  t = t.replace(/\\(left|right|big|Big|bigg|Bigg)(?![A-Za-z])/g, "");
  t = t.replace(mathMode ? /\\[,;:!]|\\quad|\\qquad|~/g : /\\[,;:!]|\\quad|\\qquad/g, " "); // 正文里的 ~ 是「约」，不动
  t = t.replace(/\\([{}_%#&$|])/g, "$1");
  t = t.replace(/\\([A-Za-z]+)/g, (m, name) => SYM[name] ?? m);
  return t;
}

/** 上下标 → <sub> / <sup>；mathMode=false 时只认明确的写法 */
function scripts(s: string, mathMode: boolean, key: string): ReactNode[] {
  const re = mathMode
    ? /([_^])(\{([^{}]*)\}|([^\s{}]))/g
    : /(?:(?<=[A-Za-z0-9)\]α-ωΑ-Ω′])([_^])\{([^{}]*)\})|(?:(?<=(?<![A-Za-z0-9_])[A-Za-zα-ωΑ-Ω])(_)([A-Za-z0-9α-ω])(?![A-Za-z0-9_]))|(?:(?<=[A-Za-z0-9)α-ω])(\^)([A-Za-z0-9*+′-]{1,4})(?![A-Za-z0-9]))/g;
  const out: ReactNode[] = [];
  let last = 0, k = 0, m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const op = mathMode ? m[1] : m[1] ?? m[3] ?? m[5];
    const body = mathMode ? (m[3] ?? m[4]) : (m[2] ?? m[4] ?? m[6]);
    if (op === undefined || body === undefined) continue;
    out.push(s.slice(last, m.index));
    out.push(op === "_" ? <sub key={`${key}-${k++}`}>{body}</sub> : <sup key={`${key}-${k++}`}>{body}</sup>);
    last = m.index + m[0].length;
  }
  out.push(s.slice(last));
  return out;
}

const looksTex = /\$[^$\n]+\$|\\[A-Za-z]+|[_^]\{|(?<![A-Za-z0-9_])[A-Za-z]_[A-Za-z0-9](?![A-Za-z0-9_])|[A-Za-z0-9)]\^[A-Za-z0-9]/;

/** 一段普通文字 → ReactNode。没有 TeX 痕迹时原样返回字符串（绝大多数情况） */
export function texLite(s: string, key = "t"): ReactNode {
  if (!looksTex.test(s)) return s;
  const parts = s.split(/(\$[^$\n]+\$)/g);
  // 「$0.01 → $0.001」是价格不是公式：$…$ 里有 \ ^ _，或者只是单个字母变量（$x$、$\pi$）才按公式处理
  const isMath = (p: string) => p.length > 2 && p.startsWith("$") && p.endsWith("$") && /[\\^_]|^\$[A-Za-z]\$$/.test(p);
  return parts.map((p, i) => {
    if (isMath(p)) {
      return <Fragment key={i}>{scripts(commands(p.slice(1, -1), true), true, `${key}${i}`)}</Fragment>;
    }
    return <Fragment key={i}>{scripts(commands(p, false), false, `${key}${i}`)}</Fragment>;
  });
}
