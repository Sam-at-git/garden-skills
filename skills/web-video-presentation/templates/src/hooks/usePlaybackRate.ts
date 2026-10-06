import { useCallback, useEffect, useState } from "react";

/** Speeds offered in the UI. 1 must stay first — it's the reset target. */
export const PLAYBACK_RATES = [1, 1.25, 1.5, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

const STORAGE_KEY = "presentation-playback-rate";

function parse(v: string | null): PlaybackRate | null {
  if (v == null) return null;
  const n = Number(v);
  return (PLAYBACK_RATES as readonly number[]).includes(n) ? (n as PlaybackRate) : null;
}

function readInitial(): PlaybackRate {
  if (typeof window === "undefined") return 1;
  const fromUrl = parse(new URLSearchParams(window.location.search).get("rate"));
  if (fromUrl) return fromUrl;
  try {
    return parse(window.localStorage.getItem(STORAGE_KEY)) ?? 1;
  } catch {
    return 1;
  }
}

/**
 * Narration playback speed (1× / 1.25× / 1.5× / 2×).
 *
 * Initial value: `?rate=1.5` in the URL wins, else the viewer's last choice
 * (localStorage — a per-viewer preference, shared across presentations on
 * the same origin on purpose), else 1×. The URL keeps `?rate=` in sync (and
 * drops it at 1×) so a shared link carries the speed.
 *
 * Keys: `>` / `.` faster, `<` / `,` slower (YouTube-style), `0` resets to 1×.
 *
 * Kept out of `useAutoMode` on purpose: rate is orthogonal to the mode state
 * machine and survives mode switches.
 */
export function usePlaybackRate() {
  const [rate, setRateState] = useState<PlaybackRate>(readInitial);

  const setRate = useCallback((r: PlaybackRate) => {
    setRateState(r);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(r));
    } catch {
      /* ignore */
    }
    const url = new URL(window.location.href);
    if (r === 1) url.searchParams.delete("rate");
    else url.searchParams.set("rate", String(r));
    window.history.replaceState(null, "", url.toString());
  }, []);

  const shift = useCallback(
    (dir: 1 | -1) => {
      const i = PLAYBACK_RATES.indexOf(rate);
      const j = Math.max(0, Math.min(PLAYBACK_RATES.length - 1, i + dir));
      if (j !== i) setRate(PLAYBACK_RATES[j]!);
    },
    [rate, setRate],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ">" || e.key === ".") {
        e.preventDefault();
        shift(1);
      } else if (e.key === "<" || e.key === ",") {
        e.preventDefault();
        shift(-1);
      } else if (e.key === "0") {
        e.preventDefault();
        setRate(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shift, setRate]);

  return { rate, setRate };
}
