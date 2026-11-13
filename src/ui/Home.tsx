import { GAMES } from "../games/registry";
import { navigate } from "./router";

export function Home() {
  return (
    <div className="screen">
      <h1>Duel</h1>
      <h3>Practice</h3>
      {GAMES.map((g) => (
        <button key={g.id} className="btn btn--ghost" onClick={() => navigate(`/practice/${g.id}`)}>
          {g.emoji} {g.name}
        </button>
      ))}
    </div>
  );
}
