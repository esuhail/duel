import type { ComponentType } from "react";
import type { Better } from "../core/match";

export interface GameProps<P> {
  puzzle: P;
  /** Call exactly once with the final score. */
  onFinish: (score: number) => void;
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
  /** Hard cap; the game must call onFinish by then. */
  durationMs: number;
  better: Better;
  formatScore: (score: number) => string;
  createPuzzle: (seed: number) => P;
  Component: ComponentType<GameProps<P>>;
}

/** Helper that keeps the puzzle type checked between createPuzzle and Component. */
export const defineGame = <P,>(g: MiniGame<P>): MiniGame<P> => g;
