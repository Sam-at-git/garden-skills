import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * LayoutDebug — the ?layout=1 visual QA overlay.
 *
 * Toggle: append `?layout=1` to the dev URL. The overlay:
 *   1. Disables all CSS animations / transitions on every descendant
 *      (forces the static hero-frame state for inspection).
 *   2. Draws the safe-area box (red dashed), caption-avoidance zone
 *      (yellow band), and rule-of-thirds grid (blue lines) over the stage.
 *   3. Outlines every visible element with a green bbox so overlap
 *      and overflow become visible.
 *   4. Reads `data-composition="..."` from the current step's scene
 *      root and shows it in the top-left readout, plus the primary /
 *      secondary bbox sizes + coverage %.
 *
 * It reads the same `data-composition` / `data-role` attributes that
 * chapters write and that inspect-layout.mjs lints — one contract, no
 * parallel class-name vocabulary (see styles/composition.css).
 *
 * The rulers are portalled into `.stage-frame` so their coordinates are
 * raw stage px. Rendered as a sibling of <Stage> they would position
 * against the viewport and be off by the stage's `transform: scale()`.
 *
 * Keyboard (only active while overlay is on):
 *   L  toggle the entire overlay
 *   G  grid + safe-area only (turn off bbox outlines)
 *   B  hide background role elements (to check if they were load-bearing)
 *   →  advance (matches Stage.tsx behavior)
 *
 * This is a dev-only component — it does not affect Auto mode or
 * recording. Pressing L twice turns it off entirely.
 *
 * See references/VISUAL-QA.md §3 for the workflow.
 */
type Mode = "full" | "grid" | "off";

const BBOX = "debug-bbox";
const BBOX_OVERLAP = "debug-bbox-overlap";

/** Strip every outline class we may have added, anywhere in the document. */
function clearOutlines() {
  document
    .querySelectorAll<HTMLElement>(`.${BBOX}, .${BBOX_OVERLAP}`)
    .forEach((el) => el.classList.remove(BBOX, BBOX_OVERLAP));
}

export function LayoutDebug() {
  const [mode, setMode] = useState<Mode>("full");
  const [stageEl, setStageEl] = useState<HTMLElement | null>(null);
  const readoutRef = useRef<HTMLDivElement>(null);

  // ─── Locate the stage frame to portal the rulers into ───
  useEffect(() => {
    if (mode === "off") {
      setStageEl(null);
      return;
    }
    setStageEl(document.querySelector<HTMLElement>(".stage-frame"));
  }, [mode]);

  // ─── Toggle off all CSS animations while overlay is visible ───
  useEffect(() => {
    if (mode === "off") return;
    const styleId = "layout-debug-no-anim";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .layout-debug-mode *,
      .layout-debug-mode *::before,
      .layout-debug-mode *::after {
        animation: none !important;
        transition: none !important;
      }
    `;
    document.head.appendChild(style);
    document.body.classList.add("layout-debug-mode");
    return () => {
      document.getElementById(styleId)?.remove();
      document.body.classList.remove("layout-debug-mode");
    };
  }, [mode]);

  // ─── Walk the rendered scene, outline bboxes, compute readouts ───
  useEffect(() => {
    if (mode === "off") {
      clearOutlines();
      return;
    }

    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);

      const stageFrame = document.querySelector(".stage-frame") as HTMLElement | null;
      if (!stageFrame) return;

      const stageRect = stageFrame.getBoundingClientRect();
      const stageArea = stageRect.width * stageRect.height;
      if (stageArea <= 0) return;

      // Find the current step's scene root (carries data-composition).
      const sceneRoot = stageFrame.querySelector(".scene > *") as HTMLElement | null;
      if (!sceneRoot) return;

      const composition = sceneRoot.getAttribute("data-composition") ?? "(none)";

      // Outline every visible descendant.
      const descendants = sceneRoot.querySelectorAll<HTMLElement>("*");
      descendants.forEach((el) => {
        const r = el.getBoundingClientRect();
        const visible =
          r.width >= 8 &&
          r.height >= 8 &&
          r.right >= stageRect.left &&
          r.left <= stageRect.right &&
          r.bottom >= stageRect.top &&
          r.top <= stageRect.bottom;

        if (mode === "full" && visible) el.classList.add(BBOX);
        else el.classList.remove(BBOX);
      });

      // Detect overlap among primary / secondary roles.
      const roles = sceneRoot.querySelectorAll<HTMLElement>(
        '[data-role="primary"], [data-role="secondary"]',
      );
      roles.forEach((el) => el.classList.remove(BBOX_OVERLAP));
      for (let i = 0; i < roles.length; i++) {
        for (let j = i + 1; j < roles.length; j++) {
          const a = roles[i].getBoundingClientRect();
          const b = roles[j].getBoundingClientRect();
          const overlap =
            a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
          if (overlap) {
            roles[i].classList.add(BBOX_OVERLAP);
            roles[j].classList.add(BBOX_OVERLAP);
          }
        }
      }

      // Compute primary + secondary coverage.
      const primaryEl = sceneRoot.querySelector<HTMLElement>('[data-role="primary"]');
      const secondaryEl = sceneRoot.querySelector<HTMLElement>('[data-role="secondary"]');
      const fmt = (el: HTMLElement | null, label: string): string => {
        if (!el) return `${label}: — (no [data-role="${label}"] in this step)`;
        const r = el.getBoundingClientRect();
        const w = Math.round(r.width);
        const h = Math.round(r.height);
        const pct = Math.round((w * h * 100) / stageArea);
        return `${label}: ${w}×${h} (${pct}%)`;
      };

      if (readoutRef.current) {
        readoutRef.current.textContent =
          `${cursorLabel()} · composition=${composition}\n` +
          `${fmt(primaryEl, "primary")}\n` +
          `${fmt(secondaryEl, "secondary")}\n` +
          `[L] overlay · [G] grid · [B] bg · [→] next`;
      }
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      clearOutlines();
    };
  }, [mode]);

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't intercept if the user is typing somewhere.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;

      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        setMode((m) => (m === "off" ? "full" : "off"));
      } else if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        setMode((m) => (m === "grid" ? "full" : "grid"));
      } else if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        // Toggle background visibility to test if it was load-bearing.
        const sceneRoot = document.querySelector(".scene > *") as HTMLElement | null;
        sceneRoot
          ?.querySelectorAll<HTMLElement>('[data-role="background"]')
          .forEach((el) => {
            el.style.visibility = el.style.visibility === "hidden" ? "" : "hidden";
          });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (mode === "off") return null;

  return (
    <>
      {stageEl &&
        createPortal(
          <>
            <div className="debug-safe-area" aria-hidden />
            <div className="debug-caption-avoid" aria-hidden />
            {mode === "full" && <div className="debug-thirds" aria-hidden />}
          </>,
          stageEl,
        )}
      {/* Readout is position: fixed — it belongs to the viewport, not the stage. */}
      <div ref={readoutRef} className="debug-readout" aria-hidden />
    </>
  );
}

/**
 * Read the current cursor from a global exposed by App.tsx (for the
 * readout text only — the overlay doesn't change behavior on step).
 */
function cursorLabel(): string {
  const w = window as unknown as {
    __presentationCursor?: () => { chapter: number; step: number };
  };
  if (typeof w.__presentationCursor !== "function") return "step ?";
  const { chapter, step } = w.__presentationCursor();
  return `ch ${chapter} · step ${step}`;
}
