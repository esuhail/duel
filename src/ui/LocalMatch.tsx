/**
 * Two players, one device. No network at all: this component drives the
 * same pure match reducer the online host uses, just with both scores
 * coming from the same screen. (Nice proof that the rules really are
 * independent of networking.)
 *
 * Only Reaction is offered here: it's the one game where two people can
 * share a keyboard or screen fairly (one key each, same light). The others
 * need a whole keypad or screen per player.
 */
import { useEffect, useReducer, useState } from "react";
import { now } from "../core/clock";
import { type BestOf, type MatchState, createMatch, matchReducer, nextRoundStart } from "../core/match";
import { randomSeed } from "../core/rng";
import { reactionGame } from "../games/reaction";
import { DUEL_KEYS, ReactionDuel } from "../games/reaction/Duel";
import { TIMING } from "../host/hostController";
import { CountdownNumber, Hud, Intro, MatchTable, RoundSplit, Stamp } from "./arena";
import { useNow } from "./hooks";
import { useSetSeam } from "./seam";
import { navigate } from "./router";

const LOCAL_GAMES = [{ id: reactionGame.id, better: reactionGame.better }];

export function LocalMatch() {
  const [setup, setSetup] = useState<{ p1: string; p2: string; bestOf: BestOf } | null>(null);
  if (!setup) return <LocalSetup onStart={setSetup} />;
  return <LocalArena key={JSON.stringify(setup)} {...setup} />;
}

function LocalSetup({ onStart }: { onStart: (s: { p1: string; p2: string; bestOf: BestOf }) => void }) {
  const [p1, setP1] = useState("P1");
  const [p2, setP2] = useState("P2");
  const [bestOf, setBestOf] = useState<BestOf>(3);
  return (
    <div className="home">
      <h1 className="title-stamp title-stamp--small">Same keyboard</h1>
      <p className="lead">Reaction duel. Both of you watch one light.</p>
      <div className="local-names">
        <label className="name-field name-field--p1">
          <span>Left player, key <kbd>{DUEL_KEYS.host.toUpperCase()}</kbd></span>
          <input value={p1} maxLength={20} onChange={(e) => setP1(e.target.value)} />
        </label>
        <label className="name-field name-field--p2">
          <span>Right player, key <kbd>{DUEL_KEYS.guest.toUpperCase()}</kbd></span>
          <input value={p2} maxLength={20} onChange={(e) => setP2(e.target.value)} />
        </label>
      </div>
      <p className="muted">On a phone, each player taps their own half of the screen.</p>
      <div className="seg" role="group" aria-label="Match length">
        {([3, 5] as const).map((n) => (
          <button key={n} className={bestOf === n ? "seg__opt is-on" : "seg__opt"} aria-pressed={bestOf === n} onClick={() => setBestOf(n)}>
            Best of {n}
          </button>
        ))}
      </div>
      <button className="trigger trigger--huge" data-testid="local-start" onClick={() => onStart({ p1: p1.trim() || "P1", p2: p2.trim() || "P2", bestOf })}>
        Fight
      </button>
      <a className="textlink" href="#/">Back</a>
    </div>
  );
}

function LocalArena({ p1, p2, bestOf }: { p1: string; p2: string; bestOf: BestOf }) {
  const [state, dispatch] = useReducer(matchReducer, null, () =>
    matchReducer(createMatch({ hostName: p1, bestOf, matchSeed: randomSeed(), games: LOCAL_GAMES }), { type: "join", name: p2 }),
  );
  const t = useNow(50);

  const startRound = (s: MatchState) => {
    const ev = nextRoundStart(s, now() + TIMING.introMs + TIMING.countdownMs);
    if (ev) dispatch(ev);
  };

  // Timers that the host controller would own online.
  useEffect(() => {
    if (state.phase === "lobby") startRound(state);
    if (state.phase === "countdown") {
      const id = setTimeout(() => dispatch({ type: "go" }), Math.max(0, state.current!.startAt - now()));
      return () => clearTimeout(id);
    }
    if (state.phase === "roundResult") {
      const id = setTimeout(() => (state.winner ? dispatch({ type: "matchOver" }) : startRound(state)), TIMING.resultMs);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.current?.attempt, state.current?.round]);

  const last = state.history.at(-1);
  const cur = state.current;
  const shift = state.phase === "roundResult" && last?.winner ? (last.winner === "host" ? 25 : -25) : 0;

  useSetSeam(shift);
  return (
    <div className="arena">
      <Hud state={state} me={null} />
      <div className="arena__body arena__body--local">
      <main className="stage">
        {state.phase === "countdown" && cur && (
          cur.startAt - t > TIMING.countdownMs
            ? <Intro gameId={cur.gameId} round={cur.round} attempt={cur.attempt} extra={<p className="keys-hint"><kbd className="p1">{DUEL_KEYS.host.toUpperCase()}</kbd> vs <kbd className="p2">{DUEL_KEYS.guest.toUpperCase()}</kbd></p>} />
            : <CountdownNumber msLeft={cur.startAt - t} />
        )}
        {state.phase === "playing" && cur && (
          <ReactionDuel
            key={`${cur.round}:${cur.attempt}`}
            puzzle={reactionGame.createPuzzle(cur.seed)}
            onFinish={(sc) => {
              dispatch({ type: "score", player: "host", round: cur.round, attempt: cur.attempt, value: sc.host });
              dispatch({ type: "score", player: "guest", round: cur.round, attempt: cur.attempt, value: sc.guest });
            }}
          />
        )}
        {state.phase === "roundResult" && last && <RoundSplit state={state} result={last} me={null} />}
        {state.phase === "matchOver" && (
          <div className="over" data-testid="match-over">
            <Stamp>K.O.</Stamp>
            <h1 className={`over__title over__title--${state.winner === "host" ? "p1" : "p2"}`}>{state.players[state.winner!]!.name} wins</h1>
            <MatchTable state={state} />
            <button className="trigger" onClick={() => { dispatch({ type: "rematch", matchSeed: randomSeed() }); }} data-testid="rematch">Rematch</button>
            <button className="key key--wide" onClick={() => navigate("/")}>Leave</button>
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
