import { useEffect } from "react";
import "./AutoStartGate.css";

interface Props {
  visible: boolean;
  onStart(): void;
}

/**
 * Full-screen overlay shown ONCE when `?auto=1` is loaded. Browsers block
 * audio playback until the page receives a user gesture, so we show this
 * gate and let the user press Space (or click) to release auto playback.
 *
 * After the user starts, the gate is hidden for the rest of the session.
 *
 * ⚠️ Space is ALSO the stepper's "next" binding (hooks/useStepper.ts listens
 * for `" "` on window). Without the capture-phase handler below, the single
 * press that dismisses this gate ALSO advances the deck — so every Auto-mode
 * recording silently loses step 0 of chapter 1, with no error anywhere. The
 * handler runs in the capture phase, swallows that first press, and starts
 * playback itself; the stepper never sees it.
 */
export function AutoStartGate({ visible, onStart }: Props) {
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " && e.key !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
      onStart();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [visible, onStart]);

  if (!visible) return null;
  return (
    <div
      className="auto-gate"
      data-no-advance
      onClick={onStart}
      role="button"
      tabIndex={0}
    >
      <div className="auto-gate-card">
        <div className="auto-gate-kicker">AUTO PLAYBACK</div>
        <div className="auto-gate-title">Press SPACE to start</div>
        <div className="auto-gate-sub">
          Audio plays per step and advances automatically.
          <br />
          Press <kbd>M</kbd> any time to switch modes.
        </div>
      </div>
    </div>
  );
}
