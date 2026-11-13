import type { ComponentType } from "react";
import type { Better } from "../core/match";

/**
 * A snapshot of how a player is doing mid-round, shown live to the opponent.
 * Cosmetic only: the round is still decided by the final score.
 */
export interface Progress {
  /** 0..1, how full the meter is. Same scale for both players. */
  fraction: number;
  /** The big number, e.g. "12" or "241". */
  headline: string;
  /** What the number means, e.g. "solved" or "ms avg". */
  unit: string;
  /** One short line of context, e.g. "Try 2 of 3". */
  detail: string;
}

export interface GameProps<P> {
  puzzle: P;
  /** Call exactly once with the final score. */
  onFinish: (score: number) => void;
  /** Call whenever the visible progress changes (optional). */
  onProgress?: (p: Progress) => void;
}

/**
 * Every minigame implements this. The match code only ever sees this shape,
 * so adding a game means adding one folder and one line in registry.ts.
 *
 * Puzzle generation (`createPuzzle`) is separated from the React component so
 * it's a plain function we can unit-test for determinism: same seed in, same
 * puzzle out, on both players' devices.
 */
export interface MiniGame<P = unknown> {
  id: string;
  name: string;
  emoji: string;
  instructions: string;
  /** Keyboard controls, shown to PC players. */
  keyHint: string;
  /** Hard cap; the game must call onFinish by then. */
  durationMs: number;
  better: Better;
  formatScore: (score: number) => string;
  /** How a winning margin reads, e.g. "87 ms faster" or "3 more solved". */
  formatMargin: (diff: number) => string;
  createPuzzle: (seed: number) => P;
  Component: ComponentType<GameProps<P>>;
}

/** Helper that keeps the puzzle type checked between createPuzzle and Component. */
export const defineGame = <P,>(g: MiniGame<P>): MiniGame<P> => g;
