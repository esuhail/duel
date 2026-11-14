import { type ReactNode, useEffect, useMemo } from "react";
import { sfx } from "../audio/sfx";
import type { MiniGame, Progress } from "../games/types";
import { useCountdown } from "../games/hooks";

/**
 * Runs one game instance: builds the puzzle from the seed, shows the clock
 * (big, centred, with energy bars draining toward it from both sides) and,
 * in a match, the live versus bar.
 */
export function GamePlayer({
  game,
  seed,
  onFinish,
  onProgress,
  versus,
}: {
  game: MiniGame;
  seed: number;
  onFinish: (score: number) => void;
  onProgress?: (p: Progress) => void;
  versus?: ReactNode;
}) {
  const puzzle = useMemo(() => game.createPuzzle(seed), [game, seed]);
  const left = useCountdown(game.durationMs);
  const Component = game.Component;
  const f = left / game.durationMs;
  const secs = Math.ceil(left / 1000);
  useEffect(() => sfx("go"), []);
  useEffect(() => {
    if (secs <= 5 && secs > 0) sfx("tick");
  }, [secs]);
  return (
    <div className="game-player">
      <div className={left < 5000 ? "clock is-low" : "clock"} role="timer" aria-label={`${Math.ceil(left / 1000)} seconds left`}>
        <div className="clock__bar clock__bar--l" aria-hidden="true"><i style={{ transform: `scaleX(${f})` }} /></div>
        <span className="clock__secs">{(left / 1000).toFixed(1)}</span>
        <div className="clock__bar clock__bar--r" aria-hidden="true"><i style={{ transform: `scaleX(${f})` }} /></div>
      </div>
      <p className="kbd-hint clock__hint">{game.keyHint}</p>
      {versus}
      <Component puzzle={puzzle} onFinish={onFinish} onProgress={onProgress} />
    </div>
  );
}
