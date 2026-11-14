import { beforeEach, expect, test } from "vitest";
import { Records } from "./records";

let mem: Record<string, string>;
const storage = {
  getItem: (k: string) => mem[k] ?? null,
  setItem: (k: string, v: string) => void (mem[k] = v),
  removeItem: (k: string) => void delete mem[k],
};
beforeEach(() => (mem = {}));

test("keeps only improvements, respecting each game's rule", () => {
  const r = new Records(storage);
  expect(r.record("Ann", "math", "higher", 10)).toEqual({ isBest: true, previous: undefined });
  expect(r.record("Ann", "math", "higher", 8)).toEqual({ isBest: false, previous: 10 });
  expect(r.record("Ann", "math", "higher", 12)).toEqual({ isBest: true, previous: 10 });
  expect(r.record("Ann", "reaction", "lower", 250).isBest).toBe(true);
  expect(r.record("Ann", "reaction", "lower", 300).isBest).toBe(false);
  expect(r.record("Ann", "reaction", "lower", 210).isBest).toBe(true);
  expect(r.bests("ann").math!.score).toBe(12);
  expect(r.bests("ANN ").reaction!.score).toBe(210);
});

test("players on one device are kept apart; clear only affects one", () => {
  const r = new Records(storage);
  r.record("Ann", "math", "higher", 5);
  r.record("Bob", "math", "higher", 9);
  expect(r.bests("Ann").math!.score).toBe(5);
  r.clear("Bob");
  expect(r.bests("Bob")).toEqual({});
  expect(r.bests("Ann").math!.score).toBe(5);
});

test("survives corrupted storage", () => {
  mem["duel:records"] = "{not json";
  expect(new Records(storage).bests("Ann")).toEqual({});
});
