import { useState } from "react";
import { randomSeed } from "../core/rng";
import { getGame } from "../games/registry";
import { GamePlayer } from "./GamePlayer";
import { navigate } from "./router";

/** Solo play of one game: handy for development and for warming up. */
export function Practice({ gameId }: { gameId: string }) {
  const game = getGame(gameId);
  const [seed, setSeed] = useState<number | null>(null);
  const [score, setScore] = useState<number | null>(null);

  if (seed !== null && score === null) {
    return <GamePlayer game={game} seed={seed} onFinish={setScore} />;
  }
  return (
    <div className="screen">
      <h2>{game.emoji} {game.name}</h2>
      <p>{game.instructions}</p>
      {score !== null && <p className="big-score" data-testid="practice-score">{game.formatScore(score)}</p>}
      <button className="btn" onClick={() => { setScore(null); setSeed(randomSeed()); }}>
        {score === null ? "Play" : "Again"}
      </button>
      <button className="btn btn--ghost" onClick={() => navigate("/")}>Back</button>
    </div>
  );
}
