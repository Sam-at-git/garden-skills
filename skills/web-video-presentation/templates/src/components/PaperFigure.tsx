// PaperFigure.tsx — put the paper's OWN figure on screen, with honest provenance.
//
// A paper's Figure 1 is the most recognisable thing it has. Redrawing everything
// throws that recognition away, and for qualitative artifacts (attention maps,
// sample outputs, failure cases) an honest redraw is impossible — you would be
// inventing data. So: show the original, and say that it is the original.
//
// The viewer must always be able to tell three things apart:
//
//   original  the paper's own image, unmodified          → "Fig 3 · 论文原图"
//   redraw    we rebuilt it (usually to fix axes/density) → "按 Fig 3 重画"
//   animated  we rebuilt it as a process animation       → "按 Fig 2 演示"
//
// That distinction is the figure-level twin of the evidence layer
// (components/Evidence.tsx). See references/PAPER-INTERPRETATION.md §6.
//
// Full paper figures are usually too dense for a 1920×1080 frame, so
// `focus` zooms to a region (percentages of the natural image) — this is how
// you do the whole → local-zoom pattern on a real figure instead of a redraw.
//
//   <PaperFigure src="/paper/fig-01.png" label="Fig 1"
//                credit="Vaswani et al., 2017" alt="Transformer 架构总览"
//                height={760} />
//
//   <PaperFigure src="/paper/fig-03.png" label="Fig 3" credit="…"
//                alt="第 5 层某个头把 making 连到 more difficult"
//                focus={{ x: 38, y: 0, w: 40, h: 100 }} height={620} />
//
//   {/* chapter drew its own chart — credit it anyway */}
//   <FigureCredit label="Table 2" variant="redraw" credit="Vaswani et al., 2017" />

import type { CSSProperties } from "react";

export type FigureVariant = "original" | "redraw" | "animated";

/** Region of the natural image to fill the frame with, in percent. */
export interface FigureFocus {
  x: number;
  y: number;
  w: number;
  /** Kept for readability at the call site; the frame's own height governs
   *  what is visible vertically. */
  h?: number;
}

const VERB: Record<FigureVariant, (l: string) => string> = {
  original: (l) => `${l} · 论文原图`,
  redraw: (l) => `按 ${l} 重画`,
  animated: (l) => `按 ${l} 演示`,
};

/** Just the provenance line — use it under a chart the chapter drew itself. */
export function FigureCredit({
  label,
  variant = "original",
  credit,
  className,
}: {
  label: string;
  variant?: FigureVariant;
  /** Author-year etc. Attribution is not optional for `original`. */
  credit?: string;
  className?: string;
}) {
  return (
    <figcaption
      className={className ? `pf-credit ${className}` : "pf-credit"}
      data-figure-source={variant}
    >
      <span className="pf-credit-label">{VERB[variant](label)}</span>
      {credit && <span className="pf-credit-by">{credit}</span>}
    </figcaption>
  );
}

/** The paper's own image, framed and credited. */
export function PaperFigure({
  src,
  label,
  alt,
  credit,
  variant = "original",
  focus,
  height,
  className,
  style,
}: {
  src: string;
  label: string;
  /** Describe what the figure SHOWS, not that it is a figure. Also read by
   *  the ?layout=1 overlay when auditing a step. */
  alt: string;
  credit?: string;
  variant?: FigureVariant;
  focus?: FigureFocus;
  /** Frame height in stage px. Give one — an unconstrained paper figure will
   *  happily blow past the 1080px stage. */
  height?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const scale = focus ? 100 / focus.w : 1;
  const imgStyle: CSSProperties = focus
    ? { transform: `scale(${scale}) translate(${-focus.x}%, ${-focus.y}%)` }
    : {};
  // 论文图放在 public/paper/，章节里写的是根路径 "/paper/fig-01.png"。部署到子路径（vite base = /p/<paper>/vN/）时
  // 根路径会指到站点根 → 404，图整张不显示。这里按 BASE_URL 补前缀；base 为 "/" 时原样。
  const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
  const resolved = src.startsWith("/") && base !== "/" && !src.startsWith(base) ? `${base.replace(/\/$/, "")}${src}` : src;

  return (
    <figure
      className={className ? `pf-figure ${className}` : "pf-figure"}
      data-figure-source={variant}
      style={style}
    >
      <div className="pf-frame" style={height ? { height } : undefined}>
        <img className="pf-img" src={resolved} alt={alt} style={imgStyle} />
      </div>
      <FigureCredit label={label} variant={variant} credit={credit} />
    </figure>
  );
}
