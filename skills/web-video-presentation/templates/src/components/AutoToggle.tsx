import { useEffect, useRef, useState } from "react";
import type { PlaybackMode } from "../hooks/useAudioPlayer";
import { PLAYBACK_RATES, type PlaybackRate } from "../hooks/usePlaybackRate";
import "./AutoToggle.css";

interface Props {
  mode: PlaybackMode;
  onCycle(): void;
  rate: PlaybackRate;
  onRate(r: PlaybackRate): void;
}

const LABEL: Record<PlaybackMode, string> = {
  manual: "MANUAL",
  audio: "AUDIO",
  auto: "AUTO",
};

const fmt = (r: number) => `${r}×`;

/**
 * Hidden-on-hover playback controls, fixed top-right: the mode button, and
 * under it the narration speed (1× / 1.25× / 1.5× / 2×).
 * Default opacity 0; hover the corner reveals it. A speed change from the
 * keyboard (`<` / `>` / `0`) flashes the panel briefly so it isn't silent.
 * `data-no-advance` so clicks here don't advance the stage.
 */
export function AutoToggle({ mode, onCycle, rate, onRate }: Props) {
  const [flash, setFlash] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setFlash(true);
    const t = window.setTimeout(() => setFlash(false), 1200);
    return () => window.clearTimeout(t);
  }, [rate]);

  const silent = mode === "manual";
  return (
    <div className={`at-hover${flash ? " at-flash" : ""}`} data-no-advance>
      <button
        className={`at-btn at-${mode}`}
        onClick={(e) => {
          e.stopPropagation();
          onCycle();
        }}
        title="切换播放模式（M）"
      >
        <span className="at-dot" />
        <span className="at-label">{LABEL[mode]}</span>
        {rate !== 1 && <span className="at-rate-tag">{fmt(rate)}</span>}
      </button>
      <div
        className={`at-rates${silent ? " at-rates-off" : ""}`}
        role="group"
        aria-label="播放速度"
        title={silent ? "MANUAL 模式无口播，倍速在 AUDIO / AUTO 下生效" : "播放速度（< > 调节，0 复位）"}
      >
        {PLAYBACK_RATES.map((r) => (
          <button
            key={r}
            className={`at-rate${r === rate ? " at-rate-on" : ""}`}
            aria-pressed={r === rate}
            onClick={(e) => {
              e.stopPropagation();
              onRate(r);
            }}
          >
            {fmt(r)}
          </button>
        ))}
      </div>
    </div>
  );
}
