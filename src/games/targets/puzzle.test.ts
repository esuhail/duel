import { expect, test } from "vitest";
import { TARGET_COUNT, createTargetsPuzzle, timeoutScore } from "./puzzle";

test("reproducible, in bounds, and spread out", () => {
  for (let s = 0; s < 50; s++) {
    const pts = createTargetsPuzzle(s);
    expect(pts).toEqual(createTargetsPuzzle(s));
    expect(pts).toHaveLength(TARGET_COUNT);
    pts.forEach((p, i) => {
      expect(p.x >= 10 && p.x <= 90 && p.y >= 10 && p.y <= 90).toBe(true);
      if (i > 0) expect(Math.hypot(p.x - pts[i - 1]!.x, p.y - pts[i - 1]!.y)).toBeGreaterThanOrEqual(25);
    });
  }
});

test("timing out is always worse than finishing", () => {
  expect(timeoutScore(14)).toBeGreaterThan(30_000);
  expect(timeoutScore(0)).toBeGreaterThan(timeoutScore(14));
});
