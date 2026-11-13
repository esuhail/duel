import { useState } from "react";
import { randomSeed } from "../core/rng";
import { getGame } from "../games/registry";
import { GamePlayer } from "./GamePlayer";
import { navigate } from "./router";

/** Solo play of one game: warm-up, and handy during development. */
export function Practice({ gameId }: { gameId: string }) {
  const game = getGame(gameId);
  const [seed, setSeed] = useState<number | null>(null);
  const [score, setScore] = useState<number | null>(null);

  if (seed !== null && score === null) {
    return <div className="arena arena--solo"><main className="stage"><GamePlayer game={game} seed={seed} onFinish={setScore} /></main></div>;
  }
  return (
    <div className="home">
      <div className="intro">
        <div className="intro__round">Practice</div>
        <h2 className="intro__name">{game.name}</h2>
        <p className="intro__text">{game.instructions}</p>
        <p className="intro__rule">{game.better === "lower" ? "Lowest wins" : "Highest wins"}</p>
      </div>
      {score !== null && <p className="big-score" data-testid="practice-score">{game.formatScore(score)}</p>}
      <button className="trigger" onClick={() => { setScore(null); setSeed(randomSeed()); }}>
        {score === null ? "Play" : "Play again"}
      </button>
      <button className="key key--wide" onClick={() => navigate("/")}>Home</button>
    </div>
  );
}
