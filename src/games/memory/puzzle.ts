import { Rng } from "../../core/rng";

export const COLORS = ["red", "blue", "yellow", "green"] as const;
export type Color = (typeof COLORS)[number];
export const START_LENGTH = 2;
export const MAX_LENGTH = 30;

/** One long sequence; level n uses its first n items (the sequence "grows"). */
export function createMemoryPuzzle(seed: number): Color[] {
  const rng = new Rng(seed);
  return Array.from({ length: MAX_LENGTH }, () => rng.pick(COLORS));
}

/** Playback gets a bit faster as the sequence grows. */
export const flashMs = (length: number) => Math.max(280, 550 - length * 20);
