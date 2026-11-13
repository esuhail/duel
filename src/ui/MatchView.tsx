import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { now } from "../core/clock";
import { type MatchState, type PlayerId, other, winsNeeded } from "../core/match";
import { getGame } from "../games/registry";
import { TIMING } from "../host/hostController";
import { GamePlayer } from "./GamePlayer";
import { useNow } from "./hooks";
import { navigate } from "./router";
import { type SessionView, getSession, leave } from "./session";

const hostCtl = () => {
  const s = getSession();
  return s?.role === "host" ? s.host : null;
};
const guestCtl = () => {
  const s = getSession();
  return s?.role === "guest" ? s.guest : null;
};

export function MatchView({ s }: { s: SessionView }) {
  const state = s.state!;
  const me = s.role;
  const opp = state.players[other(me)];
  return (
    <div className="match">
      <Scoreboard state={state} me={me} />
      {opp && !opp.connected && state.phase !== "matchOver" && (
        <div className="banner banner--warn" data-testid="disconnected">
          {opp.name} disconnected. Waiting up to 30 s for them to rejoin…
        </div>
      )}
      {s.status === "reconnecting" && <div className="banner banner--warn">Connection lost. Reconnecting…</div>}
      {state.phase === "lobby" && <Lobby s={s} state={state} />}
      {(state.phase === "countdown" || state.phase === "playing") && <RoundView s={s} state={state} />}
      {state.phase === "roundResult" && <RoundResultView state={state} me={me} />}
      {state.phase === "matchOver" && <MatchOverView state={state} me={me} />}
    </div>
  );
}

function Scoreboard({ state, me }: { state: MatchState; me: PlayerId }) {
  const need = winsNeeded(state.bestOf);
  const side = (p: PlayerId) => {
    const info = state.players[p];
    return (
      <div className={`sb__player sb__player--${p}`}>
        <div className="sb__name">{info ? info.name : "Waiting…"}</div>
        {p === me && <div className="sb__you">you</div>}
        <div className="sb__pips">
          {Array.from({ length: need }, (_, i) => (
            <span key={i} className={info && i < info.wins ? "pip pip--won" : "pip"} />
          ))}
        </div>
      </div>
    );
  };
  return (
    <div className="sb" data-testid="scoreboard">
      {side("host")}
      <div className="sb__vs">VS</div>
      {side("guest")}
    </div>
  );
}

function Lobby({ s, state }: { s: SessionView; state: MatchState }) {
  const link = `${location.origin}${location.pathname}${location.search}#/join/${s.roomId}`;
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    void QRCode.toDataURL(link, { margin: 1, width: 220 }).then(setQr);
  }, [link]);
  const guest = state.players.guest;

  if (s.role === "guest") {
    return (
      <div className="screen">
        <h2>You're in!</h2>
        <p>Best of {state.bestOf}. Waiting for {state.players.host.name} to start…</p>
      </div>
    );
  }
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Duel me!", url: link }); return; } catch { /* cancelled */ }
    }
    await navigator.clipboard?.writeText(link);
    setCopied(true);
  };
  return (
    <div className="screen">
      <h2>Invite a friend</h2>
      {qr && <img className="qr" src={qr} alt="QR code for the match link" />}
      <input className="link" readOnly value={link} data-testid="invite-link" onFocus={(e) => e.target.select()} />
      <button className="btn btn--ghost" onClick={share}>{copied ? "Copied!" : "Share link"}</button>
      <div className="row">
        {([3, 5] as const).map((n) => (
          <button key={n} className={state.bestOf === n ? "btn btn--on" : "btn btn--ghost"} onClick={() => hostCtl()?.setBestOf(n)}>
            Best of {n}
          </button>
        ))}
      </div>
      <p data-testid="lobby-status">{guest ? `${guest.name} joined!` : "Waiting for someone to join…"}</p>
      <button className="btn" disabled={!guest?.connected} onClick={() => hostCtl()?.start()} data-testid="start-match">
        Start
      </button>
    </div>
  );
}

function RoundView({ s, state }: { s: SessionView; state: MatchState }) {
  const cur = state.current!;
  const game = getGame(cur.gameId);
  const t = useNow(50);
  const startAt = s.localStartAt() ?? 0;
  const [myScore, setMyScore] = useState<{ key: string; value: number } | null>(null);
  const key = `${cur.round}:${cur.attempt}`;

  // Flip to "playing" exactly at startAt on this device's clock.
  useEffect(() => {
    if (state.phase !== "countdown") return;
    const id = setTimeout(() => s.go(), Math.max(0, startAt - now()));
    return () => clearTimeout(id);
  }, [state.phase, startAt, s]);

  if (state.phase === "countdown") {
    const left = startAt - t;
    if (left > TIMING.countdownMs) {
      return (
        <div className="screen intro" data-testid="intro">
          <div className="intro__round">Round {cur.round}{cur.attempt > 0 && " (tie replay)"}</div>
          <div className="intro__emoji">{game.emoji}</div>
          <h2>{game.name}</h2>
          <p>{game.instructions}</p>
          <span className="rule-chip">{game.better === "lower" ? "Lowest score wins" : "Highest score wins"}</span>
        </div>
      );
    }
    return (
      <div className="screen countdown" data-testid="countdown">
        <div className="countdown__num" key={Math.ceil(left / 1000)}>{Math.max(1, Math.ceil(left / 1000))}</div>
      </div>
    );
  }

  if (myScore?.key === key) {
    return (
      <div className="screen">
        <h2>Your score: {game.formatScore(myScore.value)}</h2>
        <p className="waiting">Waiting for {state.players[other(s.role)]?.name}…</p>
      </div>
    );
  }
  return (
    <GamePlayer
      key={key}
      game={game}
      seed={cur.seed}
      onFinish={(value) => {
        setMyScore({ key, value });
        s.submitScore(cur.round, cur.attempt, value);
      }}
    />
  );
}

function RoundResultView({ state, me }: { state: MatchState; me: PlayerId }) {
  const r = state.history.at(-1)!;
  const game = getGame(r.gameId);
  const headline = r.winner === null ? "Tie! Replaying…" : r.winner === me ? "You win the round!" : `${state.players[r.winner]!.name} wins the round`;
  return (
    <div className="screen result" data-testid="round-result">
      <h2>{headline}</h2>
      <div className="result__scores">
        {(["host", "guest"] as const).map((p) => (
          <div key={p} className={`result__card result__card--${p} ${r.winner === p ? "result__card--win" : r.winner ? "result__card--lose" : ""}`}>
            <span className="crown">{r.winner === p ? "👑" : ""}</span>
            <div>{state.players[p]!.name}</div>
            <div className="result__value">{game.formatScore(r.scores[p])}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchOverView({ state, me }: { state: MatchState; me: PlayerId }) {
  const won = state.winner === me;
  const iRequested = state.rematchRequested.includes(me);
  const oppRequested = state.rematchRequested.includes(other(me));
  return (
    <div className="screen over" data-testid="match-over">
      <h1 className="over__title">{won ? "You win!" : `${state.players[state.winner!]!.name} wins!`}</h1>
      {state.endReason === "forfeit" && <p>Opponent left the match.</p>}
      <table className="history">
        <tbody>
          {state.history.map((r, i) => {
            const g = getGame(r.gameId);
            return (
              <tr key={i}>
                <td>{g.emoji} {g.name}</td>
                <td className={r.winner === "host" ? "win-host" : ""}>{g.formatScore(r.scores.host)}</td>
                <td className={r.winner === "guest" ? "win-guest" : ""}>{g.formatScore(r.scores.guest)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {state.endReason !== "forfeit" && (me === "host" ? (
        <button className="btn" onClick={() => hostCtl()?.rematch()} data-testid="rematch">
          Rematch{oppRequested && " (they want one!)"}
        </button>
      ) : (
        <button className="btn" disabled={iRequested} onClick={() => guestCtl()?.requestRematch()} data-testid="rematch">
          {iRequested ? "Asked for a rematch…" : "Ask for a rematch"}
        </button>
      ))}
      <button className="btn btn--ghost" onClick={() => { leave(); navigate("/"); }}>Home</button>
    </div>
  );
}
