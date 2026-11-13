import { Rng } from "../../core/rng";

export const TARGET_COUNT = 15;
export const TARGET_TIME_LIMIT = 30_000;
/** Per target not reached when time runs out. */
export const MISSING_PENALTY_MS = 1000;

export interface Point {
  /** Percent of the play area, 10..90 so targets never hug the edges. */
  x: number;
  y: number;
}

export function createTargetsPuzzle(seed: number): Point[] {
  const rng = new Rng(seed);
  const points: Point[] = [];
  while (points.length < TARGET_COUNT) {
    const p = { x: rng.int(10, 90), y: rng.int(10, 90) };
    const prev = points.at(-1);
    // Force some travel between consecutive targets so it isn't trivial.
    if (prev && Math.hypot(p.x - prev.x, p.y - prev.y) < 25) continue;
    points.push(p);
  }
  return points;
}

export const timeoutScore = (hit: number) => TARGET_TIME_LIMIT + (TARGET_COUNT - hit) * MISSING_PENALTY_MS;
