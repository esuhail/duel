import { expect, test } from "vitest";
import { COLORS, MAX_LENGTH, createMemoryPuzzle, flashMs } from "./puzzle";

test("reproducible and valid", () => {
  const p = createMemoryPuzzle(3);
  expect(p).toEqual(createMemoryPuzzle(3));
  expect(p).not.toEqual(createMemoryPuzzle(4));
  expect(p).toHaveLength(MAX_LENGTH);
  for (const c of p) expect(COLORS).toContain(c);
});

test("flash speed has a floor", () => {
  expect(flashMs(2)).toBeGreaterThan(flashMs(10));
  expect(flashMs(100)).toBe(280);
});
