import { useEffect, useSyncExternalStore } from "react";

/**
 * One seam for the whole app (rendered once in App), so it never re-mounts
 * between screens and can glide when a round is won.
 */
let shift = 0;
const subs = new Set<() => void>();

export function useSeamShift(): number {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => shift);
}

/** Screens call this to move the seam; it springs back when they unmount. */
export function useSetSeam(value: number) {
  useEffect(() => {
    shift = value;
    subs.forEach((f) => f());
    return () => {
      shift = 0;
      subs.forEach((f) => f());
    };
  }, [value]);
}
