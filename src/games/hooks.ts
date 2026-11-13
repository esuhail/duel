import { useEffect, useRef, useState } from "react";
import type { Progress } from "./types";

/** Calls `onTimeUp` once after `ms`. The latest callback is always used. */
export function useTimeUp(ms: number, onTimeUp: () => void) {
  const cb = useRef(onTimeUp);
  cb.current = onTimeUp;
  useEffect(() => {
    const id = setTimeout(() => cb.current(), ms);
    return () => clearTimeout(id);
  }, [ms]);
}

/** Wraps onFinish so a game can't report twice (e.g. finish + timeout racing). */
export function useFinishOnce(onFinish: (score: number) => void) {
  const done = useRef(false);
  return (score: number) => {
    if (done.current) return;
    done.current = true;
    onFinish(score);
  };
}

/** Seconds left until `ms` from mount, updated ~10x/s. */
export function useCountdown(ms: number): number {
  const [start] = useState(() => performance.now());
  const [left, setLeft] = useState(ms);
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, ms - (performance.now() - start))), 100);
    return () => clearInterval(id);
  }, [ms, start]);
  return left;
}

/** Reports progress whenever its content changes (not on every render). */
export function useReportProgress(onProgress: ((p: Progress) => void) | undefined, p: Progress) {
  const key = `${p.fraction}|${p.headline}|${p.unit}|${p.detail}`;
  const cb = useRef(onProgress);
  cb.current = onProgress;
  useEffect(() => {
    cb.current?.(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/**
 * Keyboard support for PC players. The handler is kept in a ref so it always
 * sees the latest state without re-registering the listener every render.
 * Ignores auto-repeat and keys typed into inputs.
 */
export function useKeys(handler: (e: KeyboardEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.target instanceof HTMLInputElement) return;
      ref.current(e);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
}
