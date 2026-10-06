// FigureLens.tsx — walk the viewer through a paper's OWN figure, region by region.
//
// A dense Figure 1 on screen is a wall; the narration says "look at the left
// box" and the viewer hunts. FigureLens puts the eye where the voice is, on
// the unmodified original, in three modes:
//
//   spotlight  whole figure stays; everything outside the active region(s)
//              is washed out, the region gets a ring; its label goes to the legend under the frame
//   zoom       same, plus a camera move: the frame pans/zooms onto the union
//              of the active regions, and back out when `active` is empty
//   crop       sub-figure: the frame becomes the region alone (frame aspect =
//              region aspect), with an optional minimap showing where it sits
//
// Regions are percentages of the NATURAL image (x/y/w/h, 0–100), so they
// survive any frame size. All geometry is computed in frame pixels from the
// image aspect ratio — no object-fit letterbox, so rings land on the pixels
// they name (the classic "highlight is one row off" bug can't happen).
//
// Sequencing = keep ONE FigureLens mounted across steps and change `active`.
// The ring / hole / camera glide from region to region (CSS transitions),
// which reads as one continuous camera, not a slideshow:
//
//   const R = {
//     gen:  { x: 0,  y: 4,  w: 22, h: 93, label: "① 生成候选" },
//     cmp:  { x: 24, y: 4,  w: 48, h: 93, label: "② 两两比较" },
//     elo:  { x: 73, y: 4,  w: 26, h: 93, label: "③ Elo 排名" },
//   };
//   const TOUR = [null, "gen", "cmp", "elo", ["gen", "elo"]];   // index = step - 2
//   if (step >= 2 && step <= 6) return (
//     <div className="scene-pad" data-composition="centered-hero">
//       <FigureLens src="/paper/fig-01.png" ratio={1307 / 732} width={1500} height={780}
//                   label="Fig 1" credit="Author et al., 2026" alt="三阶段流水线"
//                   regions={R} active={TOUR[step - 2]} mode="zoom" role="primary" />
//     </div>
//   );
//
// Several regions inside ONE beat: pass them all and a `stagger` — each hole
// and ring comes in `stagger` ms after the previous one (spotlight / zoom).
//
// Provenance is still the paper's: the caption reads "Fig 1 · 论文原图 · 局部"
// when a region is active. Washing out and cropping are highlighting, not
// editing — no pixel of the figure is redrawn. PAPER-INTERPRETATION.md §6.1.1.

import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { FigureCredit } from "./PaperFigure";
import type { FigureVariant } from "./PaperFigure";

/** A region of the natural image, in percent (0–100). */
export interface FigureRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Chip text shown on the ring (keep it ≤ 8 CJK chars). */
  label?: string;
}

export type LensMode = "spotlight" | "zoom" | "crop";
type Corner = "tl" | "tr" | "bl" | "br";
interface Box { x: number; y: number; w: number; h: number }

const EMPTY: string[] = [];
const toList = (a: string | readonly string[] | null | undefined): readonly string[] =>
  a == null ? EMPTY : typeof a === "string" ? [a] : a;

function union(rs: Box[]): Box | null {
  if (!rs.length) return null;
  const x0 = Math.min(...rs.map((r) => r.x));
  const y0 = Math.min(...rs.map((r) => r.y));
  const x1 = Math.max(...rs.map((r) => r.x + r.w));
  const y1 = Math.max(...rs.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function FigureLens({
  src,
  label,
  alt,
  credit,
  variant = "original",
  ratio,
  width,
  height,
  regions,
  active,
  mode = "spotlight",
  numbered = false,
  stagger = 0,
  pad,
  maxZoom = 3.5,
  minimap,
  duration = 700,
  debug = false,
  fit = false,
  intent,
  role,
  className,
  style,
}: {
  src: string;
  label: string;
  /** What the figure SHOWS. Read by the ?layout=1 overlay. */
  alt: string;
  credit?: string;
  variant?: FigureVariant;
  /** Natural width / height. Pass it (`file public/paper/*.png` prints the
   *  size) — otherwise the frame is measured on load and can jump once. */
  ratio?: number;
  /** Max box the figure may occupy, stage px. Give at least one. The frame
   *  shrinks to the image's aspect inside this box — never letterboxes. */
  width?: number;
  height?: number;
  regions: Record<string, FigureRegion>;
  /** Region id(s) to bring forward now. null / [] = whole figure, no wash. */
  active?: string | readonly string[] | null;
  mode?: LensMode;
  /** Number the regions 1, 2, 3… in `active` order (markers in the gutter + legend), even for one region. */
  numbered?: boolean;
  /** ms between successive active regions appearing within one step. */
  stagger?: number;
  /** Breathing room around the target when zooming/cropping, fraction of its
   *  size. Default 0.08 for zoom, 0.05 for crop. 0.02 used to cut the first /
   *  last letter of labels sitting on the region edge ("orkers", "ross-attention"). */
  pad?: number;
  /** Cap on zoom. Past ~3× a 1300px-wide raster goes soft — re-render the
   *  PDF page at higher dpi instead of raising this. */
  maxZoom?: number;
  /** Corner for the "where am I" minimap (zoom / crop). Omit for none. */
  minimap?: Corner;
  /** Camera / ring transition, ms. */
  duration?: number;
  /** Outline EVERY region with its id — calibrate coordinates with one
   *  screenshot, then remove. Never ship it. */
  debug?: boolean;
  /** Shrink to the parent's width when it is narrower than `width` (spec
   *  chapters, where the figure may sit in a 60% column). */
  fit?: boolean;
  /** What the authors use this figure to show — one line under the credit. */
  intent?: ReactNode;
  role?: "primary" | "secondary" | "background" | "annotation";
  className?: string;
  style?: CSSProperties;
}) {
  // ── natural aspect: prop, or measured once ──
  const [measured, setMeasured] = useState<number | null>(null);
  const maskId = `fl-m${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const r = ratio ?? measured ?? 16 / 10;

  // ── available width of the parent (fit mode only) ──
  const figRef = useRef<HTMLElement>(null);
  const [avail, setAvail] = useState<number | null>(null);
  useEffect(() => {
    const box = fit ? figRef.current?.parentElement : null;
    if (!box) return;
    const measure = () => {
      const w = box.clientWidth;
      // ±2px dead band: the fit-zoom wrapper can nudge widths while it settles
      if (w > 0) setAvail((a) => (a !== null && Math.abs(a - w) < 3 ? a : w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [fit]);

  // ── number markers (several regions) live in a gutter OUTSIDE the image:
  //    regions spread left-right → gutter on top, aligned with each ring's x;
  //    stacked top-bottom → gutter on the left, aligned with y. A badge on the
  //    ring corner sat on the paper's own text ("Workers" read "1orkers") ──
  const idsAll = toList(active).filter((id) => regions[id]);
  const markers = mode !== "crop" && (idsAll.length > 1 || (numbered && idsAll.length > 0));
  const cx = idsAll.map((id) => regions[id]!.x + regions[id]!.w / 2), cy = idsAll.map((id) => regions[id]!.y + regions[id]!.h / 2);
  const minGap = (v: number[]) => { const a = [...v].sort((p, q) => p - q); let g = Infinity; for (let i = 1; i < a.length; i++) g = Math.min(g, a[i] - a[i - 1]); return g; };
  const gutter: "top" | "left" | null = !markers ? null : (idsAll.length < 2 || minGap(cx) >= 8 || minGap(cx) >= minGap(cy)) ? "top" : "left";
  const G = 44; // gutter px
  const RING_OUT = 2; // ring + hole sit 4px outside the region: text on the region edge isn't struck through

  // ── box → whole-figure canvas (W×H) with the image's exact aspect ──
  const boxW = Math.min(width ?? (height ? height * r : 1200), avail ?? Infinity) - (gutter === "left" ? G : 0);
  const boxH = (height ?? boxW / r) - (gutter === "top" ? G : 0);
  const W = boxW / boxH > r ? boxH * r : boxW;
  const H = W / r;

  const ids = idsAll;
  const pct = ids.map((id) => regions[id]!);
  // regions in canvas px
  const px = pct.map((g) => ({ x: (g.x / 100) * W, y: (g.y / 100) * H, w: (g.w / 100) * W, h: (g.h / 100) * H }));
  const U = union(px);

  // ── camera: frame size + transform (canvas px → frame px) ──
  let FW = W, FH = H, s = 1, tx = 0, ty = 0;
  if (U && mode !== "spotlight") {
    const p = pad ?? (mode === "crop" ? 0.05 : 0.08);
    const uw = U.w * (1 + 2 * p), uh = U.h * (1 + 2 * p);
    if (mode === "crop") {
      // frame takes the region's aspect, as large as the box allows
      const ua = uw / uh;
      FW = boxW / boxH > ua ? boxH * ua : boxW;
      FH = FW / ua;
      s = Math.min(FW / uw, maxZoom);
      FW = uw * s; FH = uh * s; // if capped, shrink the frame rather than show outside
    } else {
      s = clamp(Math.min(W / uw, H / uh), 1, maxZoom);
    }
    tx = FW / 2 - s * (U.x + U.w / 2);
    ty = FH / 2 - s * (U.y + U.h / 2);
    // keep the image covering the frame — no empty margins at the edges
    tx = clamp(tx, Math.min(0, FW - s * W), 0);
    ty = clamp(ty, Math.min(0, FH - s * H), 0);
  }
  const toFrame = (b: Box): Box => ({ x: tx + s * b.x, y: ty + s * b.y, w: s * b.w, h: s * b.h });

  // ── slots: ring/hole i follows active[i]; a slot that loses its region
  //    fades out where it was instead of snapping to 0,0 ──
  const last = useRef<Box[]>([]);
  const slots: Box[] = px.map(toFrame).map((b) => ({ x: b.x - RING_OUT, y: b.y - RING_OUT, w: b.w + 2 * RING_OUT, h: b.h + 2 * RING_OUT }));
  const n = Math.max(slots.length, last.current.length);
  const shown = Array.from({ length: n }, (_, i) => slots[i] ?? last.current[i]!);
  useEffect(() => {
    last.current = shown;
  });

  const wash = mode !== "crop" && slots.length > 0;
  // Labels NEVER sit on the figure: a chip above / below the ring still covered the paper's
  // own text (45 of 132 overlap fails across 20 papers). They all go to the legend under the
  // frame; with several regions each line carries the number shown in the gutter.
  const legendItems = pct.map((g, i) => ({ n: i + 1, label: g.label })).filter((x) => x.label);
  const ringR = 10;
  const t = (d = 0) => `${duration}ms cubic-bezier(.22,.8,.24,1) ${d}ms`;
  const geo = (d = 0) =>
    ["left", "top", "width", "height", "x", "y", "opacity", "fill-opacity"].map((p) => `${p} ${t(d)}`).join(", ");

  const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
  const resolved = src.startsWith("/") && base !== "/" && !src.startsWith(base) ? `${base.replace(/\/$/, "")}${src}` : src;

  const zoomed = s > 1.001 || mode === "crop";
  const creditLabel = zoomed && U ? `${label} 局部` : label;

  return (
    <figure
      ref={figRef}
      className={className ? `fl-figure ${className}` : "fl-figure"}
      data-figure-source={variant}
      data-role={role}
      data-lens-mode={mode}
      style={style}
    >
      <div className="fl-holder" style={{ paddingTop: gutter === "top" ? G : 0, paddingLeft: gutter === "left" ? G : 0 }}>
      {markers && shown.map((b, i) => {
        const on = i < slots.length;
        const c = gutter === "top" ? clamp(b.x + b.w / 2, 16, FW - 16) : clamp(b.y + b.h / 2, 16, FH - 16);
        return (
          <span key={`m${i}`} className="fl-marker"
                style={{ left: gutter === "top" ? c - 16 : (G - 32) / 2, top: gutter === "top" ? (G - 32) / 2 : G * 0 + c - 16,
                         opacity: on ? 1 : 0, transition: geo(on ? i * stagger : 0) }}>{i + 1}</span>
        );
      })}
      <div
        className="fl-frame"
        style={{ width: FW, height: FH, transition: `width ${t()}, height ${t()}` }}
      >
        <div
          className="fl-canvas"
          style={{ width: W, height: H, transform: `translate(${tx}px, ${ty}px) scale(${s})`, transition: `transform ${t()}` }}
        >
          <img
            className="fl-img"
            src={resolved}
            alt={alt}
            onLoad={(e) => {
              const im = e.currentTarget;
              if (!ratio && im.naturalWidth) setMeasured(im.naturalWidth / im.naturalHeight);
            }}
          />
        </div>

        {mode !== "crop" && (
          <svg className="fl-wash" viewBox={`0 0 ${FW} ${FH}`} width={FW} height={FH} aria-hidden="true"
               style={{ opacity: wash ? 1 : 0, transition: `opacity ${t()}` }}>
            <defs>
              <mask id={maskId} maskUnits="userSpaceOnUse">
                <rect x={0} y={0} width={FW} height={FH} fill="#fff" />
                {shown.map((b, i) => (
                  <rect key={i} rx={ringR} ry={ringR} fill="#000"
                        style={{ x: b.x, y: b.y, width: b.w, height: b.h, fillOpacity: i < slots.length ? 1 : 0,
                                 transition: geo(i < slots.length ? i * stagger : 0) } as CSSProperties} />
                ))}
              </mask>
            </defs>
            <rect className="fl-wash-fill" x={0} y={0} width={FW} height={FH}
                  mask={`url(#${maskId})`} />
          </svg>
        )}

        {mode !== "crop" &&
          shown.map((b, i) => {
            const on = i < slots.length;
            return (
              <div key={i} className="fl-ring"
                   style={{ left: b.x, top: b.y, width: b.w, height: b.h, opacity: on ? 1 : 0,
                            borderRadius: ringR, transition: geo(on ? i * stagger : 0) }} />
            );
          })}

        {debug &&
          Object.entries(regions).map(([id, g]) => {
            const b = toFrame({ x: (g.x / 100) * W, y: (g.y / 100) * H, w: (g.w / 100) * W, h: (g.h / 100) * H });
            return (
              <div key={id} className="fl-debug" style={{ left: b.x, top: b.y, width: b.w, height: b.h }}>
                <span>{id} · {g.x},{g.y} {g.w}×{g.h}</span>
              </div>
            );
          })}

        {minimap && mode !== "spotlight" && (
          <div className={`fl-mini fl-mini-${minimap}`} style={{ opacity: zoomed && U ? 1 : 0, transition: `opacity ${t()}` }}>
            <img className="fl-img" src={resolved} alt="" />
            {U && (
              <span className="fl-mini-box"
                    style={{ left: `${(U.x / W) * 100}%`, top: `${(U.y / H) * 100}%`,
                             width: `${(U.w / W) * 100}%`, height: `${(U.h / H) * 100}%`, transition: geo() }} />
            )}
          </div>
        )}
      </div>
      </div>
      {legendItems.length > 0 && (
        <ol className={markers ? "fl-legend" : "fl-legend fl-legend-solo"} style={{ width: FW + (gutter === "left" ? G : 0), paddingLeft: gutter === "left" ? G : undefined }}>
          {legendItems.map((x) => <li key={x.n}>{markers ? <span className="fl-legend-n">{x.n}</span> : <span className="fl-legend-bar" />}{x.label}</li>)}
        </ol>
      )}
      <FigureCredit label={creditLabel} variant={variant} credit={credit} />
      {intent && <div className="fl-intent"><span className="fl-intent-label">作者想说明</span><span>{intent}</span></div>}
    </figure>
  );
}
