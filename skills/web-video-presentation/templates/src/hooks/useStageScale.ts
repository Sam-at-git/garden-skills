import { useEffect, useState } from "react";

/**
 * Breathing room around the stage, as a share of the viewport with px
 * bounds: ~2% of the width (12–48px) left/right, ~3% of the height
 * (12–40px) top/bottom.
 *
 * It used to be a fixed 80px / 100px. Browser windows are wider than 16:9,
 * so the height is almost always the binding side, and 200px of fixed
 * vertical margin ate 25–30% of a laptop window: the stage covered only
 * 41% of a 1366×768 screen (54% on a MacBook, 56% on a 1080p monitor).
 * Proportional margins get those to 75–88%.
 *
 * The margin was never protecting anything: the progress bar, the mode
 * toggle and the paused badge are all position: fixed overlays that only
 * show on hover. They float over the stage the way a video player's
 * controls float over the video.
 *
 * Recording (record-auto.mjs) and smoke-render use a 2000×1160 viewport:
 * margins come out at 40 / 34.8px, so the 1920×1080 stage renders at scale
 * exactly 1.0 (width-bound) and sits at x=40, y=40.
 */
export function stageMargins(vw: number, vh: number) {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return { x: clamp(vw * 0.02, 12, 48), y: clamp(vh * 0.03, 12, 40) };
}

/**
 * Compute the scale needed to fit a 1920x1080 stage inside the current
 * viewport, leaving the margins above around it.
 */
export function useStageScale(baseW = 1920, baseH = 1080) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function update() {
      const m = stageMargins(window.innerWidth, window.innerHeight);
      const usefulW = Math.max(320, window.innerWidth - m.x * 2);
      const usefulH = Math.max(180, window.innerHeight - m.y * 2);
      setScale(Math.min(usefulW / baseW, usefulH / baseH));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [baseW, baseH]);

  return scale;
}
