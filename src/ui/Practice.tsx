import { useState } from "react";
import { sfx } from "../audio/sfx";
import { randomSeed } from "../core/rng";
import { getGame } from "../games/registry";
import { GamePlayer } from "./GamePlayer";
import { Screen } from "./Menu";
import { records, saveResult } from "./results";
import { loadName } from "./hooks";

/** Solo play of one game: warm-up, chase your personal best. */
export function Practice({ gameId }: { gameId: string }) {
  const game = getGame(gameId);
  const [seed, setSeed] = useState<number | null>(null);
  const [result, setResult] = useState<{ score: number; isBest: boolean; previous?: number } | null>(null);
  const best = records.bests(loadName())[gameId];

  if (seed !== null && result === null) {
    return (
      <div className="arena arena--solo">
        <main className="stage">
          <GamePlayer
            game={game}
            seed={seed}
            onFinish={(score) => {
              const r = saveResult(gameId, score);
              sfx(r.isBest ? "ko" : "roundWin");
              setResult({ score, ...r });
            }}
          />
        </main>
      </div>
    );
  }
  return (
    <Screen title={game.name} back="/practice">
      <div className="practice">
        <div className="intro">
          <p className="intro__text">{game.instructions}</p>
          <p className="intro__rule">{game.better === "lower" ? "Lowest wins" : "Highest wins"}</p>
          <p className="kbd-hint">Keyboard: {game.keyHint}</p>
        </div>
        {result && (
          <div className="practice__result">
            {result.isBest && <p className="new-best">New best!</p>}
            <p className="big-score" data-testid="practice-score">{game.formatScore(result.score)}</p>
            {!result.isBest && result.previous !== undefined && <p className="muted">Your best: {game.formatScore(result.previous)}</p>}
            {result.isBest && result.previous !== undefined && <p className="muted">Old best: {game.formatScore(result.previous)}</p>}
          </div>
        )}
        {!result && best && <p className="muted">Your best: {game.formatScore(best.score)}</p>}
        <button className="trigger" onClick={() => { sfx("select"); setResult(null); setSeed(randomSeed()); }}>
          {result ? "Play again" : "Play"}
        </button>
      </div>
    </Screen>
  );
}
