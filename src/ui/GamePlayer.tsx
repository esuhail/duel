import { useMemo } from "react";
import type { MiniGame } from "../games/types";
import { useCountdown } from "../games/hooks";

/** Runs one game instance: builds the puzzle from the seed, shows a time bar. */
export function GamePlayer({ game, seed, onFinish }: { game: MiniGame; seed: number; onFinish: (score: number) => void }) {
  const puzzle = useMemo(() => game.createPuzzle(seed), [game, seed]);
  const left = useCountdown(game.durationMs);
  const Component = game.Component;
  return (
    <div className="game-player">
      <div className="timebar"><div className="timebar__fill" style={{ width: `${(left / game.durationMs) * 100}%` }} /></div>
      <Component puzzle={puzzle} onFinish={onFinish} />
    </div>
  );
}
