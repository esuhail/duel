import { useState } from "react";
import type { BestOf } from "../core/match";
import { GAMES } from "../games/registry";
import { newRoomId } from "../net/transport";
import { loadName, saveName } from "./hooks";
import { navigate } from "./router";

export function Home() {
  const [name, setName] = useState(loadName);
  const [bestOf, setBestOf] = useState<BestOf>(3);

  const create = () => {
    saveName(name || "Player 1");
    sessionStorage.setItem("duel:bestOf", String(bestOf));
    navigate(`/host/${newRoomId()}`);
  };

  return (
    <div className="screen">
      <h1>Duel</h1>
      <label>
        Your name
        <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="Player 1" data-testid="name-input" />
      </label>
      <div className="row">
        {([3, 5] as const).map((n) => (
          <button key={n} className={bestOf === n ? "btn btn--on" : "btn btn--ghost"} onClick={() => setBestOf(n)}>
            Best of {n}
          </button>
        ))}
      </div>
      <button className="btn" onClick={create} data-testid="create-match">Create match</button>
      <h3>Practice</h3>
      {GAMES.map((g) => (
        <button key={g.id} className="btn btn--ghost" onClick={() => navigate(`/practice/${g.id}`)}>
          {g.emoji} {g.name}
        </button>
      ))}
    </div>
  );
}
