import { expect, test } from "vitest";
import { DICT, POINTS, canSpell, createAnagramsPuzzle, judge } from "./puzzle";

test("reproducible from the seed", () => {
  expect(createAnagramsPuzzle(42)).toEqual(createAnagramsPuzzle(42));
  expect(createAnagramsPuzzle(42).letters).not.toEqual(createAnagramsPuzzle(43).letters);
});

test("every puzzle has a 6-letter word and plenty of answers", () => {
  for (let s = 0; s < 40; s++) {
    const p = createAnagramsPuzzle(s);
    expect(p.letters).toHaveLength(6);
    expect(p.answers.length).toBeGreaterThanOrEqual(15);
    expect(p.answers[0]).toHaveLength(6);
    for (const w of p.answers) expect(DICT.has(w) && canSpell(w, p.letters)).toBe(true);
  }
});

test("judging: points by length, no repeats, no fakes, no extra letters", () => {
  const p = { letters: [..."sprint"], answers: [] };
  expect(judge("print", p, new Set())).toEqual({ ok: true, points: POINTS[5] });
  expect(judge("sprint", p, new Set())).toEqual({ ok: true, points: 2000 });
  expect(judge("print", p, new Set(["print"]))).toEqual({ ok: false, reason: "used" });
  expect(judge("pin", p, new Set())).toEqual({ ok: true, points: 100 });
  expect(judge("pp", p, new Set())).toEqual({ ok: false, reason: "short" });
  expect(judge("pints", p, new Set()).ok).toBe(true);
  expect(judge("tinss", p, new Set())).toEqual({ ok: false, reason: "letters" });
  expect(judge("rnipt", p, new Set())).toEqual({ ok: false, reason: "unknown" });
});
