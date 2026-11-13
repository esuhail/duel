import { describe, expect, test } from "vitest";
import {
  type MatchEvent,
  type MatchState,
  createMatch,
  gameForRound,
  matchReducer,
  nextRoundStart,
  winsNeeded,
} from "./match";

const GAMES = [
  { id: "reaction", better: "lower" as const },
  { id: "math", better: "higher" as const },
  { id: "targets", better: "lower" as const },
];

const run = (state: MatchState, ...events: MatchEvent[]) => events.reduce(matchReducer, state);

function lobbyWithGuest(bestOf: 3 | 5 = 3) {
  return run(createMatch({ hostName: "Ann", bestOf, matchSeed: 99, games: GAMES }), { type: "join", name: "Bob" });
}

/** Starts the next round and submits both scores. */
function playRound(state: MatchState, host: number, guest: number): MatchState {
  const start = nextRoundStart(state, 1000);
  if (!start) throw new Error("cannot start round in phase " + state.phase);
  const s = run(state, start, { type: "go" });
  const { round, attempt } = s.current!;
  return run(
    s,
    { type: "score", player: "host", round, attempt, value: host },
    { type: "score", player: "guest", round, attempt, value: guest },
  );
}

/** Scores that make `who` win the current game regardless of its rule. */
function winFor(state: MatchState, who: "host" | "guest"): [number, number] {
  const gameId = nextRoundStart(state, 0)!.gameId;
  const better = GAMES.find((g) => g.id === gameId)!.better;
  const good = better === "higher" ? 10 : 1;
  const bad = better === "higher" ? 1 : 10;
  return who === "host" ? [good, bad] : [bad, good];
}

describe("lobby", () => {
  test("guest joins once; a second join is ignored", () => {
    const s = run(lobbyWithGuest(), { type: "join", name: "Eve" });
    expect(s.players.guest?.name).toBe("Bob");
  });

  test("cannot start without a guest", () => {
    const s = createMatch({ hostName: "Ann", bestOf: 3, matchSeed: 1, games: GAMES });
    expect(nextRoundStart(s, 0)).toBeNull();
  });

  test("bestOf can change only in the lobby", () => {
    let s = run(lobbyWithGuest(), { type: "config", bestOf: 5 });
    expect(s.bestOf).toBe(5);
    s = run(s, nextRoundStart(s, 0)!, { type: "config", bestOf: 3 });
    expect(s.bestOf).toBe(5);
  });

  test("guest leaving the lobby frees the seat", () => {
    const s = run(lobbyWithGuest(), { type: "forfeit", player: "guest" });
    expect(s.players.guest).toBeNull();
    expect(s.phase).toBe("lobby");
  });
});

describe("rounds", () => {
  test("phases go countdown -> playing -> roundResult", () => {
    let s = lobbyWithGuest();
    s = run(s, nextRoundStart(s, 0)!);
    expect(s.phase).toBe("countdown");
    s = run(s, { type: "go" });
    expect(s.phase).toBe("playing");
    s = playRound(lobbyWithGuest(), ...winFor(lobbyWithGuest(), "host"));
    expect(s.phase).toBe("roundResult");
    expect(s.history[0]!.winner).toBe("host");
  });

  test("the game's better-rule decides the winner", () => {
    // Find seeds where round 1 is a "lower" game and a "higher" game.
    const match = (seed: number) => run(createMatch({ hostName: "A", bestOf: 3, matchSeed: seed, games: GAMES }), { type: "join", name: "B" });
    for (let seed = 0; seed < 50; seed++) {
      const s = match(seed);
      const id = nextRoundStart(s, 0)!.gameId;
      const after = playRound(s, 5, 8);
      expect(after.history[0]!.winner).toBe(id === "math" ? "guest" : "host");
    }
  });

  test("a tie is replayed: same round, same game, new attempt and new seed", () => {
    let s = playRound(lobbyWithGuest(), 5, 5);
    expect(s.history[0]!.winner).toBeNull();
    expect(s.players.host.wins + s.players.guest!.wins).toBe(0);
    const first = s.current!;
    const replay = nextRoundStart(s, 0)!;
    expect(replay.round).toBe(1);
    expect(replay.attempt).toBe(1);
    expect(replay.gameId).toBe(first.gameId);
    expect(replay.seed).not.toBe(first.seed);
    s = playRound(s, ...winFor(s, "guest"));
    expect(s.players.guest!.wins).toBe(1);
    expect(nextRoundStart(s, 0)!.round).toBe(2);
  });

  test("late, duplicate, and wrong-round scores are ignored", () => {
    let s = lobbyWithGuest();
    s = run(s, nextRoundStart(s, 0)!);
    const { round, attempt } = s.current!;
    s = run(s, { type: "score", player: "host", round, attempt, value: 3 });
    s = run(s, { type: "score", player: "host", round, attempt, value: 1 }); // duplicate
    expect(s.current!.scores.host).toBe(3);
    s = run(s, { type: "score", player: "guest", round: round + 1, attempt, value: 1 }); // wrong round
    s = run(s, { type: "score", player: "guest", round, attempt: attempt + 1, value: 1 }); // wrong attempt
    s = run(s, { type: "score", player: "guest", round, attempt, value: NaN }); // garbage
    expect(s.phase).toBe("countdown");
    s = run(s, { type: "score", player: "guest", round, attempt, value: 4 });
    expect(s.phase).toBe("roundResult");
    const before = s;
    s = run(s, { type: "score", player: "guest", round, attempt, value: 0 }); // after round ended
    expect(s).toBe(before);
  });
});

describe("match end", () => {
  test.each([
    [3, 2],
    [5, 3],
  ] as const)("best of %i needs %i wins", (bestOf, needed) => {
    expect(winsNeeded(bestOf)).toBe(needed);
    let s = lobbyWithGuest(bestOf);
    for (let i = 0; i < needed; i++) {
      expect(s.winner).toBeNull();
      s = playRound(s, ...winFor(s, "guest"));
    }
    expect(s.winner).toBe("guest");
    expect(nextRoundStart(s, 0)).toBeNull(); // no more rounds
    s = run(s, { type: "matchOver" });
    expect(s.phase).toBe("matchOver");
    expect(s.endReason).toBe("wins");
  });

  test("best of 5 goes the distance at 2-2", () => {
    let s = lobbyWithGuest(5);
    for (const who of ["host", "guest", "host", "guest"] as const) s = playRound(s, ...winFor(s, who));
    expect(s.winner).toBeNull();
    s = playRound(s, ...winFor(s, "host"));
    expect(s.winner).toBe("host");
    expect(s.history).toHaveLength(5);
  });

  test("matchOver is ignored until someone has won", () => {
    const s = playRound(lobbyWithGuest(), ...winFor(lobbyWithGuest(), "host"));
    expect(run(s, { type: "matchOver" }).phase).toBe("roundResult");
  });

  test("forfeit mid-match gives the win to the other player", () => {
    let s = lobbyWithGuest();
    s = run(s, nextRoundStart(s, 0)!, { type: "connection", player: "guest", connected: false });
    expect(s.players.guest!.connected).toBe(false);
    s = run(s, { type: "forfeit", player: "guest" });
    expect(s.phase).toBe("matchOver");
    expect(s.winner).toBe("host");
    expect(s.endReason).toBe("forfeit");
  });

  test("no round starts while the guest is disconnected", () => {
    let s = playRound(lobbyWithGuest(), 1, 2);
    s = run(s, { type: "connection", player: "guest", connected: false });
    expect(nextRoundStart(s, 0)).toBeNull();
  });

  test("rematch resets wins and history but keeps both players", () => {
    let s = lobbyWithGuest();
    s = playRound(s, ...winFor(s, "host"));
    s = playRound(s, ...winFor(s, "host"));
    s = run(s, { type: "matchOver" }, { type: "rematchRequest", player: "guest" });
    expect(s.rematchRequested).toEqual(["guest"]);
    s = run(s, { type: "rematch", matchSeed: 7 });
    expect(s.phase).toBe("lobby");
    expect(s.players.host.wins).toBe(0);
    expect(s.players.guest!.name).toBe("Bob");
    expect(s.history).toEqual([]);
    expect(s.matchSeed).toBe(7);
  });
});

describe("game order", () => {
  const ids = GAMES.map((g) => g.id);

  test("no repeats until every game has been played", () => {
    for (let seed = 0; seed < 200; seed++) {
      const order = [1, 2, 3, 4, 5, 6].map((r) => gameForRound(seed, r, ids));
      expect(new Set(order.slice(0, 3)).size).toBe(3);
      expect(new Set(order.slice(3, 6)).size).toBe(3);
    }
  });

  test("never the same game twice in a row across cycles", () => {
    for (let seed = 0; seed < 200; seed++) {
      for (let r = 1; r < 12; r++) expect(gameForRound(seed, r, ids)).not.toBe(gameForRound(seed, r + 1, ids));
    }
  });

  test("deterministic from the match seed", () => {
    expect(gameForRound(5, 2, ids)).toBe(gameForRound(5, 2, ids));
  });
});
