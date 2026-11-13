import { expect, test } from "vitest";
import { WORD_COUNT, createUnscramblePuzzle, isSolution } from "./puzzle";
import { WORDS } from "./words";

test("word list is clean", () => {
  expect(new Set(WORDS).size).toBe(WORDS.length);
  for (const w of WORDS) expect(w).toMatch(/^[a-z]{5}$/);
});

test("reproducible; scrambles are anagrams that aren't already solved", () => {
  for (let s = 0; s < 30; s++) {
    const p = createUnscramblePuzzle(s);
    expect(p).toEqual(createUnscramblePuzzle(s));
    expect(p).toHaveLength(WORD_COUNT);
    for (const { word, letters } of p) {
      expect([...letters].sort()).toEqual([...word].sort());
      expect(isSolution(word, letters.join(""))).toBe(false);
    }
  }
});

test("accepts listed anagrams, rejects others", () => {
  expect(isSolution("heart", "earth")).toBe(true);
  expect(isSolution("heart", "heart")).toBe(true);
  expect(isSolution("heart", "hater")).toBe(false); // not in list
  expect(isSolution("heart", "hearts")).toBe(false);
});
