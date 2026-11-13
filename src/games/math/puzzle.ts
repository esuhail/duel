import { Rng } from "../../core/rng";

export interface MathProblem {
  a: number;
  b: number;
  op: "+" | "−" | "×";
  answer: number;
}

/** More problems than anyone can solve in 30 s; difficulty ramps up slowly. */
export const PROBLEM_COUNT = 150;

export function createMathPuzzle(seed: number): MathProblem[] {
  const rng = new Rng(seed);
  return Array.from({ length: PROBLEM_COUNT }, (_, i) => {
    const level = Math.min(3, Math.floor(i / 8)); // 0..3
    const op = rng.pick(level === 0 ? (["+", "−"] as const) : (["+", "−", "×"] as const));
    if (op === "×") {
      const a = rng.int(2, 4 + level * 2);
      const b = rng.int(2, 9);
      return { a, b, op, answer: a * b };
    }
    const max = [10, 20, 50, 99][level]!;
    let a = rng.int(1, max);
    let b = rng.int(1, max);
    if (op === "−" && b > a) [a, b] = [b, a]; // never negative: no minus key needed
    return { a, b, op, answer: op === "+" ? a + b : a - b };
  });
}
