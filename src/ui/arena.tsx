/**
 * Shared "broadcast HUD" pieces used by online and local matches.
 * P1 = host = lime, P2 = guest = vermilion, everywhere.
 */
import type { CSSProperties, ReactNode } from "react";
import type { Progress } from "../games/types";
import { type MatchState, type PlayerId, type RoundResult, winsNeeded } from "../core/match";
import { getGame } from "../games/registry";

export const slot = (p: PlayerId) => (p === "host" ? "p1" : "p2");

/** Seam points as [x%, y%]. Shared by the CSS clip-paths and the SVG line. */
const SEAM: Array<[number, number]> = [[54, 0], [50, 33], [56, 35], [45, 66], [51, 68], [46, 100]];
const clip = (edgeX: number) =>
  `polygon(${edgeX}% 0%, ${SEAM.map(([x, y]) => `${x}% ${y}%`).join(", ")}, ${edgeX}% 100%)`;

/**
 * The background: two hazard-striped territories split by a jagged seam.
 * `shift` slides the seam sideways (in % of the width): +25 gives P1 75%
 * of the screen after a P1 round win.
 *
 * Territories are CSS layers clipped to the seam (so stripes keep their
 * angle at any screen ratio); the seam itself is an SVG line whose stroke
 * stays 3px however the SVG is stretched.
 */
export function Field({ shift = 0 }: { shift?: number }) {
  const move: CSSProperties = { transform: `translateX(${shift}%)` };
  const points = SEAM.map(([x, y]) => `${x},${y}`).join(" ");
  return (
    <div className="field" aria-hidden="true">
      <div className="field__move" style={move}>
        <div className="field__side field__side--p1" style={{ clipPath: clip(-80) }} />
        <div className="field__side field__side--p2" style={{ clipPath: clip(180) }} />
        <div className="field__vs">VS</div>
        <svg className="field__seam" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline className="seam seam--p1" points={points} vectorEffect="non-scaling-stroke" />
          <polyline className="seam seam--p2" points={points} vectorEffect="non-scaling-stroke" />
          <polyline className="seam seam--core" points={points} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="field__scan" />
    </div>
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
      <div className="hud__meta" data-testid="hud-meta">{hudMeta(state)}</div>
      <div className="tug" aria-hidden="true">
        <div className="tug__p1" style={{ width: `${knot}%` }} />
        <div className="tug__knot" style={{ left: `${knot}%` }} />
      </div>
    </header>
  );
}

function hudMeta(state: MatchState): string {
  const need = winsNeeded(state.bestOf);
  const cur = state.current;
  if (state.phase === "lobby") return `Best of ${state.bestOf}, first to ${need}`;
  if (state.phase === "matchOver") return "Match over";
  const round = state.phase === "roundResult" ? state.history.at(-1)!.round : cur?.round ?? 1;
  return `Round ${round}, first to ${need}`;
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
  const margin = w ? game.formatMargin(Math.abs(result.scores.host - result.scores.guest)) : "Dead even";
  return (
    <div className="split shake-hard" data-testid="round-result">
      {(["host", "guest"] as const).map((p) => (
        <div key={p} className={`split__half split__half--${slot(p)} ${w === p ? "is-win" : w ? "is-lose" : ""}`}>
          <div className="split__name">{state.players[p]?.name}{me === p && " (you)"}</div>
          <div className="split__score">{game.formatScore(result.scores[p])}</div>
          {w === p && <div className="split__margin">{margin}</div>}
        </div>
      ))}
      <Stamp at={seamAt}>{w ? "Round over" : "Tie: replay"}</Stamp>
      <div className="split__game">Round {result.round}, {game.name}</div>
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
      <p className="kbd-hint">Keyboard: {game.keyHint}</p>
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

/**
 * Desktop side rail for one player: live meter, status, and round log.
 * The meter hugs the edge facing the stage, like a fighting-game super meter.
 */
export function Rail({ state, p, me, progress }: { state: MatchState; p: PlayerId; me: PlayerId | null; progress?: Progress }) {
  const info = state.players[p];
  const cur = state.current;
  const finished = cur?.scores[p];
  const live = state.phase === "countdown" || state.phase === "playing";
  const game = cur ? getGame(cur.gameId) : null;
  const fraction = finished !== undefined ? Math.max(progress?.fraction ?? 0, 0.02) : progress?.fraction ?? 0;

  let status: string;
  if (!info) status = "Open seat";
  else if (!info.connected) status = "Dropped, holding 30 s";
  else if (state.phase === "lobby") status = p === "host" ? "Ready" : "Joined";
  else if (state.phase === "countdown") status = "Reading the rules";
  else if (state.phase === "playing") status = finished !== undefined ? "Finished" : "Playing";
  else if (state.phase === "roundResult") status = state.history.at(-1)?.winner === p ? "Took the round" : state.history.at(-1)?.winner ? "Lost the round" : "Tied";
  else status = state.winner === p ? "Match winner" : "Out";

  return (
    <aside className={`rail rail--${slot(p)} ${live ? "is-live" : ""}`} data-testid={`rail-${p}`}>
      <div className="rail__head">
        <div className="rail__name">{info?.name ?? "Waiting…"}</div>
        <div className="rail__tags">
          <span className="rail__tag">{p === "host" ? "P1, host" : "P2, guest"}</span>
          {me === p && <span className="rail__tag rail__tag--you">you</span>}
          <span className={info?.connected === false ? "rail__conn is-down" : "rail__conn"}>{info?.connected === false ? "Offline" : "Online"}</span>
        </div>
      </div>

      <div className="rail__live">
        <div className="rail__status">{status}</div>
        {live && game && (
          <>
            <div className="rail__figure" key={progress?.headline ?? "0"}>
              {finished !== undefined ? game.formatScore(finished) : progress?.headline ?? "0"}
            </div>
            <div className="rail__unit">{finished !== undefined ? "final score" : progress?.unit ?? "waiting for first move"}</div>
            <div className="rail__detail">{finished === undefined ? progress?.detail ?? "" : ""}</div>
          </>
        )}
      </div>

      <ol className="rail__log" aria-label="Rounds so far">
        {state.history.map((r, i) => {
          const g = getGame(r.gameId);
          return (
            <li key={i} className={r.winner === p ? "is-win" : r.winner ? "is-loss" : "is-tie"}>
              <span className="rail__log-round">R{r.round}</span>
              <span className="rail__log-game">{g.name}</span>
              <span className="rail__log-score">{g.formatScore(r.scores[p])}</span>
            </li>
          );
        })}
      </ol>

      <div className="meter" aria-hidden="true">
        <div className="meter__fill" style={{ height: `${fraction * 100}%` }} />
      </div>
    </aside>
  );
}

/** Mobile: one slim line showing what the opponent is doing right now. */
export function OpponentStrip({ name, p, progress, finishedText }: { name: string; p: PlayerId; progress?: Progress; finishedText?: string }) {
  return (
    <div className={`strip strip--${slot(p)}`} data-testid="opponent-strip">
      <span className="strip__name">{name}</span>
      <span className="strip__value" key={finishedText ?? progress?.headline}>
        {finishedText ? `Finished, ${finishedText}` : progress ? `${progress.headline} ${progress.unit}` : "Starting…"}
      </span>
      <span className="strip__bar"><i style={{ width: `${(finishedText ? 1 : progress?.fraction ?? 0) * 100}%` }} /></span>
    </div>
  );
}
