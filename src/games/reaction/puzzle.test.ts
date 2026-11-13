import { expect, test } from "vitest";
import { ATTEMPTS, averageMs, createReactionPuzzle } from "./puzzle";

test("puzzle is reproducible from its seed", () => {
  expect(createReactionPuzzle(123)).toEqual(createReactionPuzzle(123));
  expect(createReactionPuzzle(123)).not.toEqual(createReactionPuzzle(124));
});

test("delays are in range", () => {
  for (let s = 0; s < 100; s++) {
    const p = createReactionPuzzle(s);
    expect(p.delaysMs).toHaveLength(ATTEMPTS);
    for (const d of p.delaysMs) expect(d >= 1200 && d <= 3500).toBe(true);
  }
});

test("averageMs rounds", () => {
  expect(averageMs([200, 201, 1000])).toBe(467);
});
