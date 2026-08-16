import { useCallback, useEffect, useRef } from "react";

export type PlaybackMode = "manual" | "audio" | "auto";

interface Options {
  /** Audio file path. `null` = no audio for this step (silent). */
  src: string | null;
  /** `manual` = no playback. `audio` = play but don't auto-advance.
   *  `auto` = play and auto-advance when finished. */
  mode: PlaybackMode;
  /** Small breathing pad (ms) after audio finishes before advancing,
   *  in `auto` mode. Default 200ms. Set to 0 if mp3 already has trailing
   *  silence. */
  trailMs?: number;
  /** Fallback duration (ms) for `auto` mode when the audio file is missing
   *  or fails to play. Typically computed from text length. */
  estimateFallbackMs?: number;
  /** Called when `auto` mode determines the step is finished. */
  onAutoAdvance: () => void;
  /** Has the user started auto playback? (Browsers block autoplay until
   *  the page receives a user gesture; the AutoStartGate flips this.) */
  autoStarted: boolean;
  /** `auto` mode only: the viewer clicked the stage to hold playback.
   *  Audio keeps its position and the auto-advance countdown freezes with
   *  its remaining time intact; un-pausing resumes both from where they
   *  stopped. Ignored in `manual` / `audio` mode. */
  paused?: boolean;
}

/**
 * Per-step audio playback for the presentation.
 *
 * Manages a single hidden `<audio>` element. Switches `src` whenever the
 * current step changes.
 *
 * In `auto` mode:
 *   • Audio file present → advance `trailMs` after the audio's `ended` event.
 *   • Audio file missing / blocked / src = null → advance after
 *     `estimateFallbackMs` (so previews and silent steps still work).
 *   • `paused` → audio holds its position, the countdown holds its remaining
 *     time, and neither resumes until `paused` goes back to false.
 *
 * Audio playback is the sole driver of step duration — there is intentionally
 * no "minimum hold" knob. If a chapter's visual animation needs more time,
 * the chapter should write longer narration, split the step, or speed the
 * animation up. This keeps Auto-mode behavior trivially predictable.
 *
 * Pause/resume deliberately lives in its OWN effect and talks to the audio
 * element through refs. If `paused` were a dependency of the main effect,
 * every pause would tear the `<audio>` down and every resume would rebuild it
 * from `currentTime = 0` — i.e. restart the step instead of continuing it.
 */
export function useAudioPlayer({
  src,
  mode,
  trailMs = 200,
  estimateFallbackMs = 1500,
  onAutoAdvance,
  autoStarted,
  paused = false,
}: Options) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Latest callback ref so timers don't capture stale closures.
  const onAdvanceRef = useRef(onAutoAdvance);
  onAdvanceRef.current = onAutoAdvance;

  // Read during effects that must NOT re-run when these change. Assigned in
  // render (not in an effect) so the main effect always sees current values
  // even when `src` and `paused` change in the same commit.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const timerRef = useRef<number | null>(null);
  /** ms still owed on the current countdown; `null` = nothing scheduled. */
  const remainingRef = useRef<number | null>(null);
  /** `performance.now()` when the live timer was armed — used to work out
   *  how much of the countdown a pause ate. */
  const armedAtRef = useRef(0);
  const advancedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /**
   * Arm (or re-arm) the auto-advance countdown for `ms`. No-op outside `auto`
   * mode or after this step already advanced. While paused the countdown is
   * remembered but not started — the resume branch picks it up.
   */
  const armAdvance = useCallback(
    (ms: number) => {
      clearTimer();
      if (modeRef.current !== "auto" || advancedRef.current) return;
      remainingRef.current = Math.max(0, ms);
      if (pausedRef.current) return;
      armedAtRef.current = performance.now();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        remainingRef.current = null;
        if (advancedRef.current) return;
        advancedRef.current = true;
        onAdvanceRef.current();
      }, remainingRef.current);
    },
    [clearTimer],
  );

  /**
   * Arm only if nothing is pending. The failure paths (`error`, a rejected
   * `play()`) all want "advance eventually" — but they fire asynchronously,
   * so letting them arm unconditionally would let a dead audio element stomp
   * a countdown a pause had already frozen and restored, stretching the step
   * back out to the full estimate.
   */
  const armAdvanceIfIdle = useCallback(
    (ms: number) => {
      if (timerRef.current != null || remainingRef.current != null) return;
      armAdvance(ms);
    },
    [armAdvance],
  );

  useEffect(() => {
    const prev = audioRef.current;
    if (prev) {
      prev.pause();
      prev.removeAttribute("src");
      prev.load();
      audioRef.current = null;
    }
    clearTimer();
    remainingRef.current = null;
    advancedRef.current = false;

    if (mode === "manual") return;
    if (mode === "auto" && !autoStarted) return;

    if (src) {
      const audio = new Audio(src);
      audioRef.current = audio;
      audio.preload = "auto";

      audio.addEventListener("ended", () => armAdvance(trailMs));
      audio.addEventListener("error", () => {
        // Audio file missing or undecodable — fall back to estimate.
        armAdvanceIfIdle(estimateFallbackMs);
      });

      // Entering a step while paused (jumped with ←/→ or the progress bar):
      // load the audio but leave it held at 0 until the viewer resumes.
      if (!pausedRef.current) {
        audio.play().catch((err) => {
          // Autoplay blocked (rare, AutoStartGate should prevent this) or
          // file missing — fall back to estimate in auto mode.
          console.warn("audio play failed:", err);
          armAdvanceIfIdle(estimateFallbackMs);
        });
      }
    } else if (mode === "auto") {
      // No audio for this step (silent / empty narration) — use estimate.
      armAdvance(estimateFallbackMs);
    }

    return () => {
      advancedRef.current = true;
      clearTimer();
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.removeAttribute("src");
        a.load();
        audioRef.current = null;
      }
    };
  }, [
    src,
    mode,
    trailMs,
    estimateFallbackMs,
    autoStarted,
    armAdvance,
    armAdvanceIfIdle,
    clearTimer,
  ]);

  // ── Pause / resume, without disturbing the element above ──
  useEffect(() => {
    if (mode !== "auto") return;
    const audio = audioRef.current;

    if (paused) {
      audio?.pause();
      if (timerRef.current != null) {
        const spent = performance.now() - armedAtRef.current;
        remainingRef.current = Math.max(0, (remainingRef.current ?? 0) - spent);
        clearTimer();
      }
      return;
    }

    // Restore the frozen countdown BEFORE touching the element, so it is
    // already pending by the time any async audio failure lands.
    // `timerRef != null` means one is already running and must not be
    // extended — only a countdown a pause actually froze gets re-armed.
    if (remainingRef.current != null && timerRef.current == null) {
      armAdvance(remainingRef.current);
    }
    if (audio && audio.paused && !audio.ended && !audio.error) {
      audio.play().catch((err) => {
        console.warn("audio resume failed:", err);
        armAdvanceIfIdle(estimateFallbackMs);
      });
    }
  }, [paused, mode, estimateFallbackMs, armAdvance, armAdvanceIfIdle, clearTimer]);
}
