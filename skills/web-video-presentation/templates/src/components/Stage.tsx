import type { CSSProperties, ReactNode } from "react";
import { useStageScale } from "../hooks/useStageScale";

interface Props {
  /** Fired for a click anywhere on the 16:9 frame that isn't a button, a
   *  link, an input or a `[data-no-advance]` subtree. What the click MEANS is
   *  App's call, not the Stage's: advance in manual/audio, pause/resume in
   *  auto. */
  onStageClick(): void;
  children: ReactNode;
}

/**
 * The 16:9 stage. Click anywhere except interactive children = advance
 * (or, in auto mode, pause/resume — see App.tsx).
 *
 * Layout structure (3 nested elements):
 *   .app-shell    ← full viewport, flex-centers the fitter
 *   .stage-fitter ← sized to ACTUAL VISIBLE px (1920*scale × 1080*scale)
 *                   so the layout system honestly sees what's on screen
 *                   and centers it bulletproof on every viewport / DPR.
 *   .stage-frame  ← raw 1920×1080 box, scaled from top-left into the fitter.
 *
 * Surface colors come from the active theme's CSS custom properties
 * (var(--shell), var(--surface)) — see themes/<id>/tokens.css.
 */
export function Stage({ onStageClick, children }: Props) {
  const scale = useStageScale();
  const fitterStyle: CSSProperties = {
    width: 1920 * scale,
    height: 1080 * scale,
  };
  const frameStyle: CSSProperties = {
    transform: `scale(${scale})`,
  };
  return (
    <div className="app-shell">
      <div className="stage-fitter" style={fitterStyle}>
        <div
          className="stage-frame"
          style={frameStyle}
          onClick={(e) => {
            const t = e.target as HTMLElement;
            if (t.closest("button, a, input, [data-no-advance]")) return;
            onStageClick();
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
