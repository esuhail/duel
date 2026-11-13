import { describe, expect, test } from "vitest";
import { Rng, deriveSeed, hashString, mulberry32 } from "./rng";

describe("mulberry32", () => {
  test("same seed gives the same sequence", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 1000; i++) expect(a()).toBe(b());
  });

  test("different seeds give different sequences", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const same = Array.from({ length: 20 }, () => a() === b()).filter(Boolean).length;
    expect(same).toBeLessThan(2);
  });

  test("known values never change (guards against accidental edits)", () => {
    const r = mulberry32(12345);
    expect([r(), r(), r()].map((x) => x.toFixed(8))).toMatchSnapshot();
  });

  test("outputs stay in [0, 1) and look roughly uniform", () => {
    const r = mulberry32(7);
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 100_000; i++) {
      const x = r();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      buckets[Math.floor(x * 10)]++;
    }
    for (const b of buckets) expect(Math.abs(b - 10_000)).toBeLessThan(500);
  });
});

describe("Rng helpers", () => {
  test("int() is inclusive and in range", () => {
    const r = new Rng(9);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const x = r.int(3, 6);
      expect(x).toBeGreaterThanOrEqual(3);
      expect(x).toBeLessThanOrEqual(6);
      seen.add(x);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  test("shuffle() is a deterministic permutation", () => {
    const items = ["a", "b", "c", "d", "e"];
    const s1 = new Rng(5).shuffle(items);
    const s2 = new Rng(5).shuffle(items);
    expect(s1).toEqual(s2);
    expect([...s1].sort()).toEqual(items);
    expect(items).toEqual(["a", "b", "c", "d", "e"]); // input untouched
  });
});

test("hashString / deriveSeed are stable 32-bit values", () => {
  expect(hashString("")).toBe(0x811c9dc5);
  const s = deriveSeed(1, "round", 2);
  expect(s).toBe(deriveSeed(1, "round", 2));
  expect(s).not.toBe(deriveSeed(1, "round", 3));
  expect(Number.isInteger(s) && s >= 0 && s < 2 ** 32).toBe(true);
});
