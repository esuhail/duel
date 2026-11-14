import { useEffect, useState } from "react";
import { sfx } from "../audio/sfx";
import { GAMES, getGame } from "../games/registry";
import { type Entry, leaderboardEnabled, topScores } from "../net/leaderboard";
import { loadName } from "./hooks";
import { Screen } from "./Menu";
import { records } from "./results";

type Load = { state: "off" } | { state: "loading" } | { state: "error"; message: string } | { state: "ok"; rows: Entry[] };

export function Records() {
  const [gameId, setGameId] = useState(GAMES[0]!.id);
  const [load, setLoad] = useState<Load>({ state: leaderboardEnabled() ? "loading" : "off" });
  const game = getGame(gameId);
  const name = loadName().trim();
  const mine = records.bests(name || "Player")[gameId];

  useEffect(() => {
    if (!leaderboardEnabled()) return;
    let live = true;
    setLoad({ state: "loading" });
    topScores(gameId, game.better)
      .then((rows) => live && setLoad({ state: "ok", rows }))
      .catch((e: Error) => live && setLoad({ state: "error", message: e.message }));
    return () => { live = false; };
  }, [gameId, game.better]);

  return (
    <Screen title="Leaderboards">
      <div className="tabs" role="tablist" aria-label="Game">
        {GAMES.map((g) => (
          <button key={g.id} role="tab" aria-selected={g.id === gameId} className={g.id === gameId ? "tab is-on" : "tab"} onClick={() => { sfx("move"); setGameId(g.id); }}>
            {g.name}
          </button>
        ))}
      </div>
      <div className="boards">
        <section className="board board--mine" aria-label="Your best">
          <h2 className="board__title">Your best</h2>
          <p className="board__big">{mine ? game.formatScore(mine.score) : "None yet"}</p>
          <p className="muted">{mine ? `Set ${new Date(mine.at).toLocaleDateString()}` : `Play ${game.name} in Practice or a duel.`}</p>
          <p className="muted">{game.better === "lower" ? "Lower is better" : "Higher is better"}</p>
        </section>
        <section className="board" aria-label="World top 10">
          <h2 className="board__title">World top 10</h2>
          {load.state === "off" && <p className="muted">The online leaderboard isn't connected on this site yet. Your personal bests still save here.</p>}
          {load.state === "loading" && <p className="waiting">Loading</p>}
          {load.state === "error" && <p className="muted">Couldn't reach the leaderboard. Check your connection and reopen this screen.</p>}
          {load.state === "ok" && load.rows.length === 0 && <p className="muted">No scores yet. Set the first one.</p>}
          {load.state === "ok" && load.rows.length > 0 && (
            <ol className="ranks">
              {load.rows.map((r, i) => (
                <li key={r.name + i} className={r.name.toLowerCase() === name.toLowerCase() ? "is-me" : ""}>
                  <span className="ranks__pos">{i + 1}</span>
                  <span className="ranks__name">{r.name}</span>
                  <span className="ranks__score">{game.formatScore(r.score)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </Screen>
  );
}
