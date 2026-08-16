import "./PausedIndicator.css";

interface Props {
  visible: boolean;
}

/**
 * Persistent "held" badge, bottom-right, shown for as long as auto playback
 * is paused. Two deliberate choices:
 *
 *   • `pointer-events: none` — the badge must never eat the click that
 *     resumes playback. It sits over the stage, so a click on it passes
 *     straight through to `Stage`'s handler.
 *   • It clears the 60px progress-bar hover band rather than sitting inside
 *     it, so hovering the badge doesn't summon the progress bar.
 *
 * Recording note: this DOES appear in a screen capture. That's the point —
 * a paused recording should look paused. In a clean take you never pause,
 * so it never shows up.
 */
export function PausedIndicator({ visible }: Props) {
  return (
    <div className={`pi${visible ? " pi-on" : ""}`} aria-hidden={!visible}>
      <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
        <rect x="0" y="0" width="3.5" height="12" rx="1" />
        <rect x="6.5" y="0" width="3.5" height="12" rx="1" />
      </svg>
      <span className="pi-label">已暂停</span>
    </div>
  );
}
