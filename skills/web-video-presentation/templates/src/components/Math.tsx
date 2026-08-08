// Math.tsx — KaTeX rendering for paper-mode formula reveals (opt-in `--math`).
//
// Pulled into a project only when scaffolded with `--math`. Two exports:
//
//   <Math tex="a^2+b^2=c^2" />                       // one TeX string, inline
//   <Math tex="..." display />                       // block, centered hero
//   <Formula step={s} parts={[                       // step-keyed 4-step reveal
//     { tex: "\\textcolor{var(--ev-supported)}{Q}", at: 2 },
//     { tex: "\\textcolor{var(--accent)}{K^T}",      at: 3 },
//     { tex: "\\Rightarrow \\text{score}",           at: 4 },
//   ]} />
//
// The 4-step method (references/PAPER-INTERPRETATION.md §7):
//   1. show the PROBLEM the formula solves       (plain language, no math yet)
//   2. show the whole formula, all parts muted   (structural preview)
//   3. un-mute one part at a time per step, each  in a FIXED color that also
//      lights the matching object in the diagram  (color-code via \textcolor)
//   4. plug a micro-number so the result visibly changes
//
// Color-coding reuses evidence/theme tokens inside the TeX
// (\\textcolor{var(--accent)}{...}) — no hard-coded hex, tracks every theme.

// `katex` ships no bundled TypeScript types; declare the slice we use so this
// file typechecks out of the box (scaffold's `npx tsc --noEmit` gate). If a
// project later installs @types/katex it can delete this block.
declare module "katex" {
  const katex: {
    renderToString(
      tex: string,
      options?: {
        throwOnError?: boolean;
        displayMode?: boolean;
        output?: "html" | "mathml" | "htmlAndMathml";
      }
    ): string;
  };
  export default katex;
}

import { Fragment } from "react";
import katex from "katex";
import type { CSSProperties } from "react";

function render(tex: string, display: boolean): string {
  return katex.renderToString(tex, {
    throwOnError: false,
    displayMode: display,
    output: "html",
  });
}

/** Render a single TeX string. Use `display` for a centered block (hero formula). */
export function Math({
  tex,
  display = false,
  style,
}: {
  tex: string;
  display?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      className={display ? "math-display" : "math-inline"}
      style={style}
      dangerouslySetInnerHTML={{ __html: render(tex, display) }}
    />
  );
}

/** A formula composed of independent TeX PARTS, each revealed (un-muted) when
 *  `step` reaches its `at`. Good for "Q · K / √d ⇒ score" style splits where
 *  each part is a standalone sub-expression. For tightly connected equations,
 *  render the whole thing with <Math> and hand-author the per-symbol dimming.
 *
 *  Unrevealed parts get the `.muted` class (see styles/math.css). */
export function Formula({
  parts,
  step,
  display = false,
  separator = " ",
}: {
  parts: { tex: string; at: number }[];
  step: number;
  display?: boolean;
  separator?: string;
}) {
  return (
    <span className={display ? "math-display" : "math-inline"}>
      {parts.map((p, i) => (
        <Fragment key={i}>
          <span
            className={step >= p.at ? "" : "muted"}
            dangerouslySetInnerHTML={{ __html: render(p.tex, false) }}
          />
          {i < parts.length - 1 ? (
            <span className="math-sep">{separator}</span>
          ) : null}
        </Fragment>
      ))}
    </span>
  );
}
