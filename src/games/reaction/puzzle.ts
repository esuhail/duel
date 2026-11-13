import { Rng } from "../../core/rng";

export const ATTEMPTS = 3;
/** Added for a false start or for not tapping at all. */
export const PENALTY_MS = 1000;
/** How long the green screen waits before counting as a miss. */
export const MISS_AFTER_MS = 1500;

export interface ReactionPuzzle {
  /** Wait before each green flash. Random so it can't be anticipated, identical for both players. */
  delaysMs: number[];
}

export function createReactionPuzzle(seed: number): ReactionPuzzle {
  const rng = new Rng(seed);
  return { delaysMs: Array.from({ length: ATTEMPTS }, () => rng.int(1200, 3500)) };
}

export const averageMs = (times: number[]) => Math.round(times.reduce((a, b) => a + b, 0) / times.length);
