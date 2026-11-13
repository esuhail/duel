import { expect, test } from "vitest";
import { estimateOffset } from "./clock";

test("recovers a known offset with symmetric latency", () => {
  // host clock is 5000 ms ahead; one-way latency 40 ms
  const t0 = 1000;
  const r = estimateOffset([{ t0, hostTime: t0 + 40 + 5000, t1: t0 + 80 }])!;
  expect(r.offset).toBe(5000);
  expect(r.rtt).toBe(80);
});

test("prefers the sample with the smallest round trip", () => {
  const r = estimateOffset([
    { t0: 0, hostTime: 5300, t1: 400 }, // slow, asymmetric: would give 5100
    { t0: 1000, hostTime: 6020, t1: 1040 }, // fast: gives 5000
  ])!;
  expect(r.offset).toBe(5000);
});

test("no samples, no estimate", () => {
  expect(estimateOffset([])).toBeNull();
});
