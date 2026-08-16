import { useCallback, useEffect, useState } from "react";
import type { PlaybackMode } from "./useAudioPlayer";

const ORDER: PlaybackMode[] = ["manual", "audio", "auto"];

function readModeFromURL(): PlaybackMode {
  if (typeof window === "undefined") return "manual";
  const q = new URLSearchParams(window.location.search);
  if (q.get("auto") === "1") return "auto";
  if (q.get("audio") === "1") return "audio";
  return "manual";
}

/**
 * Playback mode state machine + URL sync + keyboard toggle.
 *
 * Modes:
 *   • `manual` — silent, you click / arrow-key to advance
 *   • `audio`  — audio plays per step, but you still click to advance
 *   • `auto`   — audio plays AND advances automatically (full recording mode)
 *
 * Initial mode is read from URL: `?auto=1` or `?audio=1`. Press `M` to
 * cycle: manual → audio → auto → manual. URL stays in sync so reload
 * preserves the mode.
 *
 * `autoStarted` exists separately because browsers require a user gesture
 * before audio can autoplay — `AutoStartGate` flips it on space-press.
 *
 * `paused` is a state of its own, NOT a fourth mode: while paused the mode
 * stays `auto` and the URL keeps `?auto=1`, so resuming picks auto playback
 * back up exactly where it stopped. It only means anything in `auto` mode —
 * in `manual` / `audio` there is nothing running to hold — and it survives
 * step changes, so pausing and then arrow-keying through a few steps leaves
 * you paused on the step you land on.
 */
export function useAutoMode() {
  const [mode, setModeState] = useState<PlaybackMode>(() => readModeFromURL());
  const [autoStarted, setAutoStarted] = useState(false);
  const [paused, setPaused] = useState(false);

  const setMode = useCallback((m: PlaybackMode) => {
    setModeState(m);
    setPaused(false);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("audio");
    url.searchParams.delete("auto");
    if (m === "audio") url.searchParams.set("audio", "1");
    if (m === "auto") url.searchParams.set("auto", "1");
    window.history.replaceState(null, "", url.toString());
    if (m !== "auto") setAutoStarted(false);
  }, []);

  const cycleMode = useCallback(() => {
    setMode(ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]!);
  }, [mode, setMode]);

  /** Stage-click handler for `auto` mode. Only togglable once auto playback
   *  has actually started — before that the AutoStartGate owns the click. */
  const togglePause = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  // Keyboard: `M` cycles mode. `Space` starts auto if gated.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        cycleMode();
      } else if (e.key === " " && mode === "auto" && !autoStarted) {
        e.preventDefault();
        setPaused(false);
        setAutoStarted(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, autoStarted, cycleMode]);

  return {
    mode,
    setMode,
    cycleMode,
    autoStarted,
    setAutoStarted,
    paused,
    setPaused,
    togglePause,
  };
}
