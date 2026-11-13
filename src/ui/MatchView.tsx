import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { now } from "../core/clock";
import { type MatchState, other } from "../core/match";
import { getGame } from "../games/registry";
import { TIMING } from "../host/hostController";
import { CountdownNumber, Hud, Intro, MatchTable, OpponentStrip, Rail, RoundSplit, Stamp } from "./arena";
import { GamePlayer } from "./GamePlayer";
import { useNow } from "./hooks";
import { useSetSeam } from "./seam";
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
  const last = state.history.at(-1);
  const shift = state.phase === "roundResult" && last?.winner ? (last.winner === "host" ? 25 : -25) : 0;
  useSetSeam(shift);
  return (
    <div className="arena">
      <Hud state={state} me={me} />
      {opp && !opp.connected && state.phase !== "matchOver" && (
        <div className="alert" data-testid="disconnected">{opp.name} dropped. Holding the match for 30 s.</div>
      )}
      {s.status === "reconnecting" && <div className="alert">Connection lost. Reconnecting…</div>}
      {(state.phase === "countdown" || state.phase === "playing") && opp && (
        <OpponentStrip
          name={opp.name}
          p={other(me)}
          progress={s.progress[other(me)]}
          finishedText={state.current?.scores[other(me)] !== undefined ? getGame(state.current.gameId).formatScore(state.current.scores[other(me)]!) : undefined}
        />
      )}
      <div className="arena__body">
        <Rail state={state} p="host" me={me} progress={s.progress.host} />
        <main className="stage">
          {state.phase === "lobby" && <Lobby s={s} state={state} />}
          {(state.phase === "countdown" || state.phase === "playing") && <RoundView s={s} state={state} />}
          {state.phase === "roundResult" && last && <RoundSplit state={state} result={last} me={me} />}
          {state.phase === "matchOver" && <MatchOver state={state} me={me} />}
        </main>
        <Rail state={state} p="guest" me={me} progress={s.progress.guest} />
      </div>
    </div>
  );
}

function Lobby({ s, state }: { s: SessionView; state: MatchState }) {
  const link = `${location.origin}${location.pathname}${location.search}#/join/${s.roomId}`;
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    void QRCode.toDataURL(link, { margin: 1, width: 240, color: { dark: "#000000", light: "#ffffff" } }).then(setQr);
  }, [link]);
  const guest = state.players.guest;

  if (s.role === "guest") {
    return (
      <div className="panel">
        <p className="lead">You're in. Best of {state.bestOf}.</p>
        <p className="waiting">Waiting for {state.players.host.name} to start</p>
      </div>
    );
  }
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Duel me", text: `Room ${s.roomId}`, url: link }); return; } catch { /* cancelled */ }
    }
    await navigator.clipboard?.writeText(link);
    setCopied(true);
  };
  return (
    <div className="panel lobby">
      <div className="lobby__share">
      <p className="lead">Room code, share it with one friend</p>
      <div className="code" data-testid="room-code">
        {s.roomId.split("").map((c, i) => <span key={i} className="code__cell">{c}</span>)}
      </div>
      {qr && <img className="qr" src={qr} alt="QR code that opens this room" />}
      <input className="sr-only" readOnly value={link} data-testid="invite-link" aria-label="Invite link" />
      <button className="key key--wide" onClick={share}>{copied ? "Link copied" : "Share link"}</button>
      <p className="muted">They can scan the code, open the link, or type the 4 letters on the home screen.</p>
      </div>
      <div className="lobby__setup">
      <p className="lead">Match length</p>
      <div className="seg" role="group" aria-label="Match length">
        {([3, 5] as const).map((n) => (
          <button key={n} className={state.bestOf === n ? "seg__opt is-on" : "seg__opt"} aria-pressed={state.bestOf === n} onClick={() => hostCtl()?.setBestOf(n)}>
            Best of {n}
          </button>
        ))}
      </div>
      <p className="lobby__status" data-testid="lobby-status">{guest ? `${guest.name} joined!` : "Waiting for player 2…"}</p>
      <button className="trigger" disabled={!guest?.connected} onClick={() => hostCtl()?.start()} data-testid="start-match">
        Fight
      </button>
      <p className="muted">{guest?.connected ? "Rounds are picked at random, no repeats until every game is played." : "Fight unlocks when player 2 joins."}</p>
      </div>
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

  useEffect(() => {
    if (state.phase !== "countdown") return;
    const id = setTimeout(() => s.go(), Math.max(0, startAt - now()));
    return () => clearTimeout(id);
  }, [state.phase, startAt, s]);

  if (state.phase === "countdown") {
    const left = startAt - t;
    if (left > TIMING.countdownMs) return <Intro gameId={cur.gameId} round={cur.round} attempt={cur.attempt} />;
    return <CountdownNumber msLeft={left} />;
  }
  if (myScore?.key === key) {
    return (
      <div className="panel">
        <p className="lead">You: <span className="mono">{game.formatScore(myScore.value)}</span></p>
        <p className="waiting">Waiting for {state.players[other(s.role)]?.name}</p>
        {s.progress[other(s.role)] && (
          <p className="muted">They're on {s.progress[other(s.role)]!.headline} {s.progress[other(s.role)]!.unit}</p>
        )}
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
      onProgress={(p) => s.reportProgress(cur.round, cur.attempt, p)}
    />
  );
}

function MatchOver({ state, me }: { state: MatchState; me: "host" | "guest" }) {
  const winner = state.winner!;
  const iRequested = state.rematchRequested.includes(me);
  const oppRequested = state.rematchRequested.includes(other(me));
  return (
    <div className="over" data-testid="match-over">
      <Stamp>K.O.</Stamp>
      <h1 className={`over__title over__title--${winner === "host" ? "p1" : "p2"}`}>
        {winner === me ? "You win" : `${state.players[winner]!.name} wins`}
      </h1>
      {state.endReason === "forfeit" && <p className="lead">Opponent left the match.</p>}
      <MatchTable state={state} />
      {state.endReason !== "forfeit" && (me === "host" ? (
        <button className="trigger" onClick={() => hostCtl()?.rematch()} data-testid="rematch">
          {oppRequested ? "Rematch (they're in)" : "Rematch"}
        </button>
      ) : (
        <button className="trigger" disabled={iRequested} onClick={() => guestCtl()?.requestRematch()} data-testid="rematch">
          {iRequested ? "Rematch requested" : "Ask for a rematch"}
        </button>
      ))}
      <button className="key key--wide" onClick={() => { leave(); navigate("/"); }}>Leave</button>
    </div>
  );
}
