/**
 * Shared "broadcast HUD" pieces used by online and local matches.
 * P1 = host = lime, P2 = guest = vermilion, everywhere.
 */
import type { CSSProperties, ReactNode } from "react";
import { type MatchState, type PlayerId, type RoundResult, winsNeeded } from "../core/match";
import { getGame } from "../games/registry";

export const slot = (p: PlayerId) => (p === "host" ? "p1" : "p2");

/**
 * The jagged seam splitting the screen. `shift` slides it sideways
 * (in % of the width): +25 gives P1 75% of the screen on a P1 round win.
 */
export function Field({ shift = 0 }: { shift?: number }) {
  const seam = "54,0 50,33 56,35 45,66 51,68 46,100";
  const style: CSSProperties = { transform: `translateX(${shift}px)` };
  return (
    <svg className="field" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <g className="field__move" style={style}>
        <polygon className="field__p1" points={`-60,0 ${seam} -60,100`} />
        <polygon className="field__p2" points={`160,0 ${seam} 160,100`} />
        <polyline className="field__seam" points={seam} vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}

/** Tug-of-war bar: the knot moves one step toward whoever wins a round. */
export function Hud({ state, me }: { state: MatchState; me: PlayerId | null }) {
  const need = winsNeeded(state.bestOf);
  const w1 = state.players.host.wins;
  const w2 = state.players.guest?.wins ?? 0;
  const knot = 50 + ((w1 - w2) / need) * 50; // 0..100, P1 pulls right
  const side = (p: PlayerId) => {
    const info = state.players[p];
    return (
      <div className={`hud__side hud__side--${slot(p)}`}>
        <div className="hud__name">
          {info?.name ?? "Open seat"}
          {me === p && <span className="hud__you">you</span>}
        </div>
        <div className="pips" aria-label={`${info?.wins ?? 0} of ${need} round wins`}>
          {Array.from({ length: need }, (_, i) => (
            <span key={i} className={info && i < info.wins ? "pip pip--on" : "pip"} />
          ))}
        </div>
      </div>
    );
  };
  return (
    <header className="hud" data-testid="scoreboard">
      {side("host")}
      {side("guest")}
      <div className="tug" aria-hidden="true">
        <div className="tug__p1" style={{ width: `${knot}%` }} />
        <div className="tug__knot" style={{ left: `${knot}%` }} />
      </div>
    </header>
  );
}

/** Big rotated label slammed across the seam. */
export function Stamp({ children, at = 50 }: { children: ReactNode; at?: number }) {
  return (
    <div className="stamp" style={{ left: `${at}%` }}>
      {children}
    </div>
  );
}

/** Round result: the winner's half grows to 75% and the stamp lands on the seam. */
export function RoundSplit({ state, result, me }: { state: MatchState; result: RoundResult; me: PlayerId | null }) {
  const game = getGame(result.gameId);
  const w = result.winner;
  // The stamp sits on the seam, pulled inward a bit so it never leaves the screen.
  const seamAt = w === "host" ? 62 : w === "guest" ? 38 : 50;
  return (
    <div className="split shake-hard" data-testid="round-result">
      {(["host", "guest"] as const).map((p) => (
        <div key={p} className={`split__half split__half--${slot(p)} ${w === p ? "is-win" : w ? "is-lose" : ""}`}>
          <div className="split__name">{state.players[p]?.name}{me === p && " (you)"}</div>
          <div className="split__score">{game.formatScore(result.scores[p])}</div>
        </div>
      ))}
      <Stamp at={seamAt}>{w ? "Round over" : "Tie: replay"}</Stamp>
    </div>
  );
}

export function MatchTable({ state }: { state: MatchState }) {
  return (
    <table className="history">
      <thead>
        <tr>
          <th>Game</th>
          <th className="p1">{state.players.host.name}</th>
          <th className="p2">{state.players.guest?.name}</th>
        </tr>
      </thead>
      <tbody>
        {state.history.map((r, i) => {
          const g = getGame(r.gameId);
          return (
            <tr key={i}>
              <td>{g.name}</td>
              <td className={r.winner === "host" ? "win-p1" : ""}>{g.formatScore(r.scores.host)}</td>
              <td className={r.winner === "guest" ? "win-p2" : ""}>{g.formatScore(r.scores.guest)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Instructions card shown before the 3-2-1. */
export function Intro({ gameId, round, attempt, extra }: { gameId: string; round: number; attempt: number; extra?: ReactNode }) {
  const game = getGame(gameId);
  return (
    <div className="intro" data-testid="intro">
      <div className="intro__round">Round {round}{attempt > 0 && ", tie replay"}</div>
      <h2 className="intro__name">{game.name}</h2>
      <p className="intro__text">{game.instructions}</p>
      <p className="intro__rule">{game.better === "lower" ? "Lowest wins" : "Highest wins"}</p>
      {extra}
    </div>
  );
}

export function CountdownNumber({ msLeft }: { msLeft: number }) {
  const n = Math.max(1, Math.ceil(msLeft / 1000));
  return (
    <div className="countdown" data-testid="countdown">
      <div className="countdown__num" key={n}>{n}</div>
    </div>
  );
}
