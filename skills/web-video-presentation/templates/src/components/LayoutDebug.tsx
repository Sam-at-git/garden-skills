import { useEffect, useRef, useState } from "react";

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

export function LayoutDebug() {
  const [mode, setMode] = useState<Mode>("full");
  const readoutRef = useRef<HTMLDivElement>(null);

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
    if (mode === "off") return;

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
      const bboxes: { el: HTMLElement; rect: DOMRect }[] = [];
      descendants.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) return;
        if (r.right < stageRect.left || r.left > stageRect.right) return;
        if (r.bottom < stageRect.top || r.top > stageRect.bottom) return;

        // Apply outline class. Don't overwrite if already outlined.
        if (mode === "full") {
          if (!el.classList.contains("debug-bbox")) el.classList.add("debug-bbox");
        } else {
          el.classList.remove("debug-bbox");
        }
        bboxes.push({ el, rect: r });
      });

      // Detect overlap among role-primary / role-secondary bboxes.
      const roles = sceneRoot.querySelectorAll<HTMLElement>(".role-primary, .role-secondary");
      roles.forEach((el) => el.classList.remove("debug-bbox-overlap"));
      for (let i = 0; i < roles.length; i++) {
        for (let j = i + 1; j < roles.length; j++) {
          const a = roles[i].getBoundingClientRect();
          const b = roles[j].getBoundingClientRect();
          const overlap =
            a.left < b.right &&
            a.right > b.left &&
            a.top < b.bottom &&
            a.bottom > b.top;
          if (overlap) {
            roles[i].classList.add("debug-bbox-overlap");
            roles[j].classList.add("debug-bbox-overlap");
          }
        }
      }

      // Optional: hide background role to test if it was load-bearing.
      if (mode === "full") {
        const bgEls = sceneRoot.querySelectorAll<HTMLElement>(".role-background");
        bgEls.forEach((el) => {
          el.dataset._layoutDebugOrigOpacity = el.dataset._layoutDebugOrigOpacity ?? el.style.opacity ?? "";
        });
      }

      // Compute primary + secondary coverage.
      const primaryEl = sceneRoot.querySelector<HTMLElement>(".role-primary");
      const secondaryEl = sceneRoot.querySelector<HTMLElement>(".role-secondary");
      const fmt = (el: HTMLElement | null): string => {
        if (!el) return "—";
        const r = el.getBoundingClientRect();
        const w = Math.round(r.width);
        const h = Math.round(r.height);
        const pct = Math.round((w * h * 100) / stageArea);
        return `${w}×${h} (${pct}%)`;
      };

      // Update the readout overlay (rendered as React JSX below).
      if (readoutRef.current) {
        readoutRef.current.textContent =
          `step ${currentStep() ?? "?"} · composition=${composition}\n` +
          `primary: ${fmt(primaryEl)}\n` +
          `secondary: ${fmt(secondaryEl)}\n` +
          `[L] overlay · [G] grid · [B] bg · [→] next`;
      }
    };
    tick();
    return () => cancelAnimationFrame(frame);
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
        // Toggle background visibility.
        const sceneRoot = document.querySelector(".scene > *") as HTMLElement | null;
        if (sceneRoot) {
          const bgEls = sceneRoot.querySelectorAll<HTMLElement>(".role-background");
          bgEls.forEach((el) => {
            if (el.style.visibility === "hidden") {
              el.style.visibility = "";
            } else {
              el.style.visibility = "hidden";
            }
          });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (mode === "off") return null;

  return (
    <>
      <div className="debug-safe-area" aria-hidden />
      <div className="debug-caption-avoid" aria-hidden />
      {mode === "full" && <div className="debug-thirds" aria-hidden />}
      <div ref={readoutRef} className="debug-readout" aria-hidden />
    </>
  );
}

/**
 * Read the current step from a global exposed by App.tsx (for the
 * readout text only — the overlay doesn't change behavior on step).
 * Falls back to "?" when not available.
 */
function currentStep(): string | null {
  const w = window as unknown as { __presentationStep?: () => number };
  if (typeof w.__presentationStep === "function") {
    return String(w.__presentationStep());
  }
  return null;
}
