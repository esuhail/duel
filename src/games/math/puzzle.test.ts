import { expect, test } from "vitest";
import { PROBLEM_COUNT, createMathPuzzle } from "./puzzle";

test("reproducible from seed", () => {
  expect(createMathPuzzle(77)).toEqual(createMathPuzzle(77));
  expect(createMathPuzzle(77)).not.toEqual(createMathPuzzle(78));
});

test("answers are correct and never negative", () => {
  for (let s = 0; s < 50; s++) {
    const ps = createMathPuzzle(s);
    expect(ps).toHaveLength(PROBLEM_COUNT);
    for (const p of ps) {
      const expected = p.op === "+" ? p.a + p.b : p.op === "−" ? p.a - p.b : p.a * p.b;
      expect(p.answer).toBe(expected);
      expect(p.answer).toBeGreaterThanOrEqual(0);
    }
  }
});
