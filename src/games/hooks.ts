import { useEffect, useRef, useState } from "react";

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
