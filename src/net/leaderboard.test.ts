import { expect, test, vi } from "vitest";
import { leaderboardEnabled, submitScore, topScores } from "./leaderboard";

const cfg = (fetch: typeof globalThis.fetch) => ({ url: "https://x.supabase.co", key: "anon", fetch });

test("disabled without config: no network calls", async () => {
  expect(leaderboardEnabled({})).toBe(false);
  expect(await submitScore("math", "Ann", 5, {})).toBe(false);
  expect(await topScores("math", "higher", 10, {})).toEqual([]);
});

test("submit calls the RPC with a trimmed name and rounded score", async () => {
  const f = vi.fn(async () => new Response(null, { status: 204 }));
  expect(await submitScore("reaction", "  A very long name here ", 241.6, cfg(f as never))).toBe(true);
  const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("https://x.supabase.co/rest/v1/rpc/submit_score");
  expect(JSON.parse(init.body as string)).toEqual({ p_game: "reaction", p_name: "A very long ", p_score: 242 });
  expect((init.headers as Record<string, string>).apikey).toBe("anon");
});

test("top scores sort by the game's rule", async () => {
  const rows = [{ name: "Ann", score: 200, created_at: "2026-01-01" }];
  const f = vi.fn(async () => new Response(JSON.stringify(rows), { status: 200 }));
  expect(await topScores("reaction", "lower", 10, cfg(f as never))).toEqual(rows);
  const url = new URL((f.mock.calls[0] as unknown as [string])[0]);
  expect(url.pathname).toBe("/rest/v1/leaderboard");
  expect(url.searchParams.get("order")).toBe("score.asc,created_at.asc");
  expect(url.searchParams.get("game")).toBe("eq.reaction");
  await topScores("math", "higher", 10, cfg(f as never));
  expect(new URL((f.mock.calls[1] as unknown as [string])[0]).searchParams.get("order")).toBe("score.desc,created_at.asc");
});

test("errors surface for reads", async () => {
  const f = vi.fn(async () => new Response("no", { status: 500 }));
  await expect(topScores("math", "higher", 10, cfg(f as never))).rejects.toThrow("500");
});
