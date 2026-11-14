/**
 * Shared "broadcast HUD" pieces used by online and local matches.
 * P1 = host = lime, P2 = guest = vermilion, everywhere.
 */
import { type ReactNode, useEffect, useRef } from "react";
import type { Progress } from "../games/types";
import { type MatchState, type PlayerId, type RoundResult, winsNeeded } from "../core/match";
import { getGame } from "../games/registry";

export const slot = (p: PlayerId) => (p === "host" ? "p1" : "p2");

/** Seam points as [x%, y%] of the screen. */
const SEAM: Array<[number, number]> = [[54, 0], [50, 33], [56, 35], [45, 66], [51, 68], [46, 100]];

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/**
 * The background: each player's half is a glowing floor grid, split by a
 * jagged neon seam. `shift` slides the seam sideways (in % of the width):
 * +25 gives P1 75% of the screen after a P1 round win.
 *
 * Why a canvas: the same picture built from CSS gradients was re-rasterised
 * every frame whenever anything on top animated (measured ~4 fps in software
 * rendering). A canvas is drawn once per resize and then only moved with a
 * GPU transform, which is effectively free. It's 150% wide so the seam can
 * slide without exposing an edge.
 */
export function Field({ shift = 0 }: { shift?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const draw = () => {
      const c = ref.current;
      if (!c) return;
      const g = c.getContext("2d");
      if (!g) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = window.innerWidth;
      const H = window.innerHeight;
      const CW = W * 1.5;
      c.width = Math.round(CW * dpr);
      c.height = Math.round(H * dpr);
      c.style.width = `${CW}px`;
      c.style.height = `${H}px`;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const css = getComputedStyle(document.documentElement);
      const color = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
      const p1 = color("--p1", "#2de2e6");
      const p2 = color("--p2", "#ff3864");
      const coin = color("--coin", "#f9c80e");
      const bg = color("--bg", "#0b0420");
      const ox = W * 0.25;
      const seam = SEAM.map(([x, y]) => [ox + (x / 100) * W, (y / 100) * H] as const);

      g.fillStyle = bg;
      g.fillRect(0, 0, CW, H);

      const side = (edge: number, ink: string, glowX: number) => {
        g.save();
        g.beginPath();
        g.moveTo(edge, 0);
        for (const [x, y] of seam) g.lineTo(x, y);
        g.lineTo(edge, H);
        g.closePath();
        g.clip();
        // Horizon glow rising from the bottom.
        const glow = g.createRadialGradient(glowX, H * 1.15, 0, glowX, H * 1.15, Math.max(W, H) * 0.62);
        glow.addColorStop(0, rgba(ink, 0.45));
        glow.addColorStop(1, rgba(ink, 0));
        g.fillStyle = glow;
        g.fillRect(0, 0, CW, H);
        // Floor grid that fades out toward the top of the screen.
        const fade = g.createLinearGradient(0, 0, 0, H);
        fade.addColorStop(0, rgba(ink, 0));
        fade.addColorStop(0.38, rgba(ink, 0));
        fade.addColorStop(0.75, rgba(ink, 0.38));
        fade.addColorStop(1, rgba(ink, 0.38));
        g.fillStyle = fade;
        for (let x = 0; x < CW; x += 64) g.fillRect(x, 0, 2, H);
        for (let y = H; y > 0; y -= 40) g.fillRect(0, y, CW, 2);
        g.restore();
      };
      side(0, p1, ox + W * 0.22);
      side(CW, p2, ox + W * 0.78);

      const stroke = (style: string, width: number, dx = 0) => {
        g.beginPath();
        seam.forEach(([x, y], i) => (i ? g.lineTo(x + dx, y) : g.moveTo(x + dx, y)));
        g.strokeStyle = style;
        g.lineWidth = width;
        g.lineJoin = "miter";
        g.stroke();
      };
      stroke(rgba(coin, 0.08), 28);
      stroke(rgba(coin, 0.18), 12);
      stroke(p1, 3, -4);
      stroke(p2, 3, 4);
      stroke(coin, 3);
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, []);

  return (
    <div className="field" aria-hidden="true">
      <canvas ref={ref} className="field__canvas" style={{ transform: `translateX(${shift - 25}vw)` }} />
      <div className="field__vs">VS</div>
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
