// formula-marks.ts — 公式逐符号讲解的共用逻辑（KaTeX 版和无 KaTeX 版的 MathSlot 都用它）。
//
// 符号怎么在整式里被认出来（两种写法，前者优先）：
//   1. 显式标记：tex 里用 [[ ]] 圈出符号，里面的内容和 symbols[i].tex 相同就归第 i 个符号
//        "\\mathrm{softmax}\\left(\\frac{[[Q]][[K^\\top]]}{[[\\sqrt{d_k}]]}\\right)[[V]]"
//   2. 自动匹配：没有 [[ ]] 时，按 symbols[i].tex 原样在整式里找（长的先找；前后是字母或反斜杠命令的不算，
//      免得 "d" 命中 \mathrm{d}、"x" 命中 \exp）
// 被认出的符号包成 \htmlClass{fx-s-i}{…}，CSS 按 data-act / data-done 给它上色（scene.css 的 .sc-fx 段）。

export interface FormulaSymbol {
  /** 符号本身（KaTeX），和整式里写法一致，如 "K^\\top"、"\\sqrt{d_k}" */
  tex: string;
  /** 叫什么：「查询矩阵」「缩放因子」 */
  name: string;
  /** 是什么 / 管什么：「每个词拿去问别人的问题，n×d_k」 */
  meaning?: string;
}

/** 符号上限：CSS 预生成了 12 个下标的规则 */
export const MAX_SYMBOLS = 12;

const norm = (s: string) => s.replace(/\s+/g, "");

/** 把整式里的符号包成 \htmlClass{fx-s-i}{…}；stripOnly=true 只去掉 [[ ]]（无 KaTeX 的桩用） */
export function markSymbols(tex: string, symbols: FormulaSymbol[] = [], stripOnly = false): string {
  const syms = symbols.slice(0, MAX_SYMBOLS);
  const wrap = (i: number, inner: string) => (stripOnly || i < 0 ? `{${inner}}` : `\\htmlClass{fx-s-${i}}{${inner}}`);
  if (tex.includes("[[")) {
    return tex.replace(/\[\[([\s\S]+?)\]\](?!\])/g, (_, inner: string) => wrap(syms.findIndex((s) => norm(s.tex) === norm(inner)), inner));
  }
  if (stripOnly || !syms.length) return tex;
  // 自动匹配：先把命中位置换成占位符，全部找完再展开，避免短符号钻进已经包过的长符号里
  const order = syms.map((s, i) => ({ t: s.tex.trim(), i })).filter((x) => x.t).sort((a, b) => b.t.length - a.t.length);
  let out = tex;
  const slots: string[] = [];
  for (const { t, i } of order) {
    const guard = protectedRanges(out);
    let from = 0, res = "";
    for (;;) {
      const k = out.indexOf(t, from);
      if (k < 0) { res += out.slice(from); break; }
      const e = k + t.length;
      // 数学模式里 QK 是两个变量相乘，字母挨着字母不算单词；真正要躲的是命令名（\exp 里的 x）
      // 和 \mathrm{…} / \text{…} 这类文字参数（softmax 里的 x）
      const inCommand = /\\[A-Za-z]*$/.test(out.slice(0, k)) || (/^[A-Za-z]/.test(t) && /\\[A-Za-z]+$/.test(out.slice(0, k)));
      const splitsCommand = /^\\[A-Za-z]+$/.test(t.match(/^\\[A-Za-z]+/)?.[0] ?? "") && /[A-Za-z]/.test(out[e] ?? "") && /[A-Za-z]$/.test(t);
      if (inCommand || splitsCommand || guard.some(([a, b]) => k < b && e > a)) { res += out.slice(from, e); from = e; continue; }
      res += out.slice(from, k) + `\u0000${slots.length}\u0000`;
      slots.push(wrap(i, t));
      from = e;
    }
    out = res;
  }
  return out.replace(/\u0000(\d+)\u0000/g, (_, n) => slots[+n]);
}

/** \mathrm{…} \text{…} \operatorname{…} 等「文字参数」的范围：自动匹配不进去 */
function protectedRanges(tex: string): [number, number][] {
  const out: [number, number][] = [];
  const re = /\\(?:mathrm|text|textrm|textbf|textit|operatorname|mathit|mathsf|mathtt|mbox)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tex))) {
    let depth = 1, j = m.index + m[0].length;
    while (j < tex.length && depth) { if (tex[j] === "{") depth++; else if (tex[j] === "}") depth--; j++; }
    out.push([m.index, j]);
  }
  return out;
}

/** active → 数组（去掉越界的） */
export const activeList = (a: number | number[] | undefined, n: number): number[] =>
  (a === undefined ? [] : Array.isArray(a) ? a : [a]).filter((i) => Number.isInteger(i) && i >= 0 && i < n);

/** 词表显示几行：给了 shown 用 shown；有 active 就显示到最大的 active 为止（逐个揭示）；都没给全显示 */
export const glossaryRows = (n: number, act: number[], shown?: number) =>
  Math.max(0, Math.min(n, shown ?? (act.length ? Math.max(...act) + 1 : n)));

/** data-act / data-done 属性值：「讲过的」= 词表里已显示、但不是当前的符号 */
export function symbolState(act: number[], rows: number) {
  const done = Array.from({ length: rows }, (_, i) => i).filter((i) => !act.includes(i));
  return { act: act.map((i) => `s${i}`).join(" "), done: done.map((i) => `s${i}`).join(" ") };
}

/** 名字 / 说明里混进了 TeX（模型常把 name 写成 "\\beta"）：有反斜杠命令、或 x_{…} / x^{…} 这种下上标 */
export const looksTex = (t?: string) => !!t && (/\\[A-Za-z]+/.test(t) || /[A-Za-z0-9}]\s*[_^]\s*[{A-Za-z0-9\\]/.test(t));

/** 无 KaTeX 时把常见 TeX 转成可读文字：\\beta → β，\\pi_\\theta → π_θ，去掉 \\text{} / \\mathrm{} 外壳 */
const GREEK: Record<string, string> = { alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω", Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Omega: "Ω", cdot: "·", times: "×", sum: "Σ", infty: "∞", le: "≤", ge: "≥", ne: "≠", approx: "≈", to: "→", mid: "|", top: "ᵀ", log: "log", exp: "exp" };
export const texToText = (t: string) =>
  t.replace(/\\(?:text|mathrm|mathbf|mathit|operatorname|mathcal|mathbb)\s*\{([^{}]*)\}/g, "$1")
   .replace(/\\([A-Za-z]+)/g, (_m, w) => GREEK[w] ?? w)
   .replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
