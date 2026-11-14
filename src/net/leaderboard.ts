/**
 * Global leaderboard: best score per player per game, shared by everyone.
 *
 * Backend: Supabase (free tier), used through its plain REST API, so no SDK.
 *  - Reads come from the `leaderboard` view (one best row per name per game).
 *  - Writes only go through the `submit_score` database function, which
 *    rejects impossible scores and rate-limits. See supabase/schema.sql.
 * The anon key below is designed to be public; the database rules are what
 * protect the data.
 *
 * Honest limitation: the browser reports its own score, so a determined
 * cheater can still post a fake-but-plausible one. Server-side replays would
 * be the real fix (see README).
 */
import type { Better } from "../core/match";

export interface Entry {
  name: string;
  score: number;
  created_at: string;
}

export interface LeaderboardConfig {
  url?: string;
  key?: string;
  fetch?: typeof fetch;
}

const defaults = (): LeaderboardConfig => ({
  url: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  key: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
});

export const leaderboardEnabled = (cfg = defaults()) => Boolean(cfg.url && cfg.key);

function headers(key: string) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export async function submitScore(game: string, name: string, score: number, cfg = defaults()): Promise<boolean> {
  if (!cfg.url || !cfg.key) return false;
  const res = await (cfg.fetch ?? fetch)(`${cfg.url}/rest/v1/rpc/submit_score`, {
    method: "POST",
    headers: headers(cfg.key),
    body: JSON.stringify({ p_game: game, p_name: name.trim().slice(0, 12), p_score: Math.round(score) }),
  });
  return res.ok;
}

export async function topScores(game: string, better: Better, limit = 10, cfg = defaults()): Promise<Entry[]> {
  if (!cfg.url || !cfg.key) return [];
  const order = `score.${better === "lower" ? "asc" : "desc"},created_at.asc`;
  const q = new URLSearchParams({ select: "name,score,created_at", game: `eq.${game}`, order, limit: String(limit) });
  const res = await (cfg.fetch ?? fetch)(`${cfg.url}/rest/v1/leaderboard?${q}`, { headers: headers(cfg.key) });
  if (!res.ok) throw new Error(`Leaderboard unavailable (${res.status})`);
  return (await res.json()) as Entry[];
}
