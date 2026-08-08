// Math.tsx — KaTeX rendering for paper-mode formula reveals (opt-in `--math`).
//
// Pulled into a project only when scaffolded with `--math`. Two exports:
//
//   <Math tex="a^2+b^2=c^2" />                       // one TeX string, inline
//   <Math tex="..." display />                       // block, centered hero
//   <Formula step={s} parts={[                       // step-keyed 4-step reveal
//     { tex: "Q",                  at: 1, color: "var(--ev-supported)" },
//     { tex: "K^T",                at: 2, color: "var(--accent)" },
//     { tex: "\\Rightarrow \\text{score}", at: 3 },
//   ]} />
//
// The 4-step method (references/PAPER-INTERPRETATION.md §7):
//   1. show the PROBLEM the formula solves       (plain language, no math yet)
//   2. show the whole formula, all parts muted   (structural preview)
//   3. un-mute one part at a time per step, each  in a FIXED color that also
//      lights the matching object in the diagram  (color-code via `color`)
//   4. plug a micro-number so the result visibly changes
//
// Color-coding goes through the `color` prop, NOT through TeX's \textcolor:
// KaTeX only accepts #rgb / #rrggbb / named colors there, so
// `\textcolor{var(--accent)}{Q}` raises "Invalid color" and — because we pass
// throwOnError:false — renders the TeX source verbatim in KaTeX's hard-coded
// #cc0000. Coloring the wrapping span instead keeps theme tokens working and
// keeps this file free of hard-coded hex.

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

/** Render a single TeX string. Use `display` for a centered block (hero formula).
 *  `color` takes any CSS color — pass a theme token such as `var(--accent)`. */
export function Math({
  tex,
  display = false,
  color,
  style,
}: {
  tex: string;
  display?: boolean;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={display ? "math-display" : "math-inline"}
      style={color ? { color, ...style } : style}
      dangerouslySetInnerHTML={{ __html: render(tex, display) }}
    />
  );
}

/** A formula composed of independent TeX PARTS, each revealed (un-muted) when
 *  `step` reaches its `at`. Good for "Q · K / √d ⇒ score" style splits where
 *  each part is a standalone sub-expression. For tightly connected equations,
 *  render the whole thing with <Math> and hand-author the per-symbol dimming.
 *
 *  Give a part a `color` (a theme token such as `var(--accent)`) to tie it to
 *  the matching object in the diagram. The color only applies once the part is
 *  revealed, so muted parts stay uniformly recessed.
 *
 *  Unrevealed parts get the `.muted` class (see styles/math.css). */
export function Formula({
  parts,
  step,
  display = false,
  separator = " ",
}: {
  parts: { tex: string; at: number; color?: string }[];
  step: number;
  display?: boolean;
  separator?: string;
}) {
  return (
    <span className={display ? "math-display" : "math-inline"}>
      {parts.map((p, i) => {
        const revealed = step >= p.at;
        return (
          <Fragment key={i}>
            <span
              className={revealed ? "" : "muted"}
              style={revealed && p.color ? { color: p.color } : undefined}
              dangerouslySetInnerHTML={{ __html: render(p.tex, false) }}
            />
            {i < parts.length - 1 ? (
              <span className="math-sep">{separator}</span>
            ) : null}
          </Fragment>
        );
      })}
    </span>
  );
}
