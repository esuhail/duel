import type { GameRule } from "../core/match";
import type { MiniGame } from "./types";
import { quickMathGame } from "./math";
import { reactionGame } from "./reaction";
import { targetTapGame } from "./targets";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GAMES: MiniGame<any>[] = [reactionGame, quickMathGame, targetTapGame];

export const getGame = (id: string) => {
  const g = GAMES.find((x) => x.id === id);
  if (!g) throw new Error(`unknown game ${id}`);
  return g;
};

/** The only part of a game the match reducer needs. */
export const GAME_RULES: GameRule[] = GAMES.map(({ id, better }) => ({ id, better }));
