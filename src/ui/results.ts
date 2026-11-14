/** What happens when a game ends: save personal bests, post them globally. */
import { Records } from "../core/records";
import { getGame } from "../games/registry";
import { leaderboardEnabled, submitScore } from "../net/leaderboard";
import { loadName } from "./hooks";

export const records = new Records();

export function saveResult(gameId: string, score: number): { isBest: boolean; previous?: number } {
  const name = loadName().trim();
  const result = records.record(name || "Player", gameId, getGame(gameId).better, score);
  // Only personal bests go global, and only for players who set a name.
  if (result.isBest && name && leaderboardEnabled()) {
    submitScore(gameId, name, score).catch(() => {
      /* offline or rejected: the local record still counts */
    });
  }
  return result;
}
