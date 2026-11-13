import { useMemo } from "react";
import type { MiniGame, Progress } from "../games/types";
import { useCountdown } from "../games/hooks";

/** Runs one game instance: builds the puzzle from the seed, shows the clock. */
export function GamePlayer({
  game,
  seed,
  onFinish,
  onProgress,
}: {
  game: MiniGame;
  seed: number;
  onFinish: (score: number) => void;
  onProgress?: (p: Progress) => void;
}) {
  const puzzle = useMemo(() => game.createPuzzle(seed), [game, seed]);
  const left = useCountdown(game.durationMs);
  const Component = game.Component;
  const low = left < 5000;
  return (
    <div className="game-player">
      <div className={low ? "clock is-low" : "clock"}>
        <div className="timebar" aria-hidden="true"><div className="timebar__fill" style={{ width: `${(left / game.durationMs) * 100}%` }} /></div>
        <span className="clock__secs" aria-label={`${Math.ceil(left / 1000)} seconds left`}>{(left / 1000).toFixed(1)}s</span>
      </div>
      <Component puzzle={puzzle} onFinish={onFinish} onProgress={onProgress} />
    </div>
  );
}
