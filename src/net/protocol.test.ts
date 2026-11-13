import { expect, test } from "vitest";
import { parseGuestMessage } from "./protocol";

test("progress messages are validated and clamped", () => {
  const ok = parseGuestMessage({ t: "progress", round: 1, attempt: 0, p: { fraction: 3, headline: "5", unit: "solved", detail: "" } });
  expect(ok).toEqual({ t: "progress", round: 1, attempt: 0, p: { fraction: 1, headline: "5", unit: "solved", detail: "" } });
  expect(parseGuestMessage({ t: "progress", round: 1, attempt: 0, p: { fraction: "x" } })).toBeNull();
  expect(parseGuestMessage({ t: "progress", round: 1, attempt: 0, p: { fraction: 0, headline: "x".repeat(99), unit: "", detail: "" } })).toBeNull();
});

test("unknown or malformed messages are dropped", () => {
  expect(parseGuestMessage({ t: "nope" })).toBeNull();
  expect(parseGuestMessage("hello")).toBeNull();
  expect(parseGuestMessage({ t: "score", round: 1, attempt: 0, value: Infinity })).toBeNull();
});
