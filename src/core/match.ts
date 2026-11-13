/**
 * The match rules, as a pure reducer: (state, event) => newState.
 *
 * Why a reducer?
 * - No I/O, no timers, no randomness inside. Every input arrives as an event
 *   (randomness arrives as seeds, time arrives as `startAt`), so the rules can
 *   be unit-tested exhaustively without a browser or a network.
 * - The host is the authority: it is the only side that *creates* events.
 *   It applies each one locally and forwards it to the guest, and the guest
 *   applies the same events to its own copy of this reducer. Same code + same
 *   events = same state on both screens. (This is "event sourcing".)
 * - If the host logic ever moves to a server, this file moves unchanged.
 *
 * Phases: lobby -> countdown -> playing -> roundResult -> (countdown ... | matchOver)
 */
import { Rng, deriveSeed } from "./rng";

export type PlayerId = "host" | "guest";
export type Better = "higher" | "lower";
export type BestOf = 3 | 5;
export type Phase = "lobby" | "countdown" | "playing" | "roundResult" | "matchOver";

export interface GameRule {
  id: string;
  better: Better;
}

export interface PlayerInfo {
  name: string;
  connected: boolean;
  wins: number;
}

export interface CurrentRound {
  /** 1-based; only advances after a decisive (non-tie) result. */
  round: number;
  /** 0 for the first try, +1 for each tie replay of the same round. */
  attempt: number;
  gameId: string;
  seed: number;
  /** Host-clock timestamp (ms) when play begins. */
  startAt: number;
  scores: Partial<Record<PlayerId, number>>;
}

export interface RoundResult {
  round: number;
  attempt: number;
  gameId: string;
  scores: Record<PlayerId, number>;
  /** null means a tie: the round is replayed with a new seed. */
  winner: PlayerId | null;
}

export interface MatchState {
  phase: Phase;
  bestOf: BestOf;
  matchSeed: number;
  games: GameRule[];
  players: { host: PlayerInfo; guest: PlayerInfo | null };
  current: CurrentRound | null;
  history: RoundResult[];
  /** Set as soon as someone reaches the required wins. */
  winner: PlayerId | null;
  endReason: "wins" | "forfeit" | null;
  rematchRequested: PlayerId[];
}

export type MatchEvent =
  | { type: "join"; name: string }
  | { type: "connection"; player: PlayerId; connected: boolean }
  | { type: "config"; bestOf: BestOf }
  | { type: "roundStart"; round: number; attempt: number; gameId: string; seed: number; startAt: number }
  | { type: "go" }
  | { type: "score"; player: PlayerId; round: number; attempt: number; value: number }
  | { type: "matchOver" }
  | { type: "forfeit"; player: PlayerId }
  | { type: "rematchRequest"; player: PlayerId }
  | { type: "rematch"; matchSeed: number };

export const other = (p: PlayerId): PlayerId => (p === "host" ? "guest" : "host");
export const winsNeeded = (bestOf: BestOf): number => Math.floor(bestOf / 2) + 1;

export function createMatch(opts: {
  hostName: string;
  bestOf: BestOf;
  matchSeed: number;
  games: GameRule[];
}): MatchState {
  if (opts.games.length === 0) throw new Error("need at least one game");
  return {
    phase: "lobby",
    bestOf: opts.bestOf,
    matchSeed: opts.matchSeed,
    games: opts.games,
    players: { host: { name: opts.hostName, connected: true, wins: 0 }, guest: null },
    current: null,
    history: [],
    winner: null,
    endReason: null,
    rematchRequested: [],
  };
}

/**
 * Which game is played in round `round` (1-based)?
 * The list is shuffled once per "cycle" so no game repeats until all have
 * been played, and the first game of a cycle never equals the last game of
 * the previous one. Deterministic from matchSeed, so both sides agree.
 */
export function gameForRound(matchSeed: number, round: number, gameIds: readonly string[]): string {
  const n = gameIds.length;
  const cycleOrder = (k: number): string[] => {
    const order = new Rng(deriveSeed(matchSeed, "order", k)).shuffle(gameIds);
    if (k > 0 && n > 1) {
      const prevLast = cycleOrder(k - 1)[n - 1];
      if (order[0] === prevLast) [order[0], order[1]] = [order[1]!, order[0]!];
    }
    return order;
  };
  const idx = round - 1;
  return cycleOrder(Math.floor(idx / n))[idx % n]!;
}

/** Each (round, attempt) gets its own puzzle seed, so a tie replays a new puzzle. */
export const seedForRound = (matchSeed: number, round: number, attempt: number): number =>
  deriveSeed(matchSeed, "round", round, attempt);

/**
 * The next `roundStart` event the host should send, or null if the match
 * can't start/continue right now. Host-only helper; still pure.
 */
export function nextRoundStart(state: MatchState, startAt: number): Extract<MatchEvent, { type: "roundStart" }> | null {
  if (!state.players.guest?.connected) return null;
  let round: number;
  let attempt: number;
  let gameId: string;
  if (state.phase === "lobby") {
    round = 1;
    attempt = 0;
    gameId = gameForRound(state.matchSeed, 1, state.games.map((g) => g.id));
  } else if (state.phase === "roundResult" && state.winner === null) {
    const last = state.history[state.history.length - 1]!;
    const tie = last.winner === null;
    round = tie ? last.round : last.round + 1;
    attempt = tie ? last.attempt + 1 : 0;
    gameId = tie ? last.gameId : gameForRound(state.matchSeed, round, state.games.map((g) => g.id));
  } else if ((state.phase === "countdown" || state.phase === "playing") && state.current) {
    // Restart the current round (used after a reconnect mid-round).
    round = state.current.round;
    attempt = state.current.attempt + 1;
    gameId = state.current.gameId;
  } else {
    return null;
  }
  return { type: "roundStart", round, attempt, gameId, seed: seedForRound(state.matchSeed, round, attempt), startAt };
}

export function compareScores(better: Better, host: number, guest: number): PlayerId | null {
  if (host === guest) return null;
  const hostBetter = better === "higher" ? host > guest : host < guest;
  return hostBetter ? "host" : "guest";
}

export function matchReducer(state: MatchState, event: MatchEvent): MatchState {
  switch (event.type) {
    case "join": {
      if (state.phase !== "lobby" || state.players.guest) return state;
      return { ...state, players: { ...state.players, guest: { name: event.name, connected: true, wins: 0 } } };
    }

    case "connection": {
      const p = state.players[event.player];
      if (!p || p.connected === event.connected) return state;
      return { ...state, players: { ...state.players, [event.player]: { ...p, connected: event.connected } } };
    }

    case "config": {
      if (state.phase !== "lobby") return state;
      return { ...state, bestOf: event.bestOf };
    }

    case "roundStart": {
      const ok =
        (state.phase === "lobby" && state.players.guest) ||
        (state.phase === "roundResult" && state.winner === null) ||
        state.phase === "countdown" ||
        state.phase === "playing";
      if (!ok) return state;
      if (!state.games.some((g) => g.id === event.gameId)) return state;
      const { round, attempt, gameId, seed, startAt } = event;
      return {
        ...state,
        phase: "countdown",
        rematchRequested: [],
        current: { round, attempt, gameId, seed, startAt, scores: {} },
      };
    }

    case "go": {
      if (state.phase !== "countdown") return state;
      return { ...state, phase: "playing" };
    }

    case "score": {
      const cur = state.current;
      // Ignore late, duplicate, stale, or garbage scores instead of throwing:
      // messages can arrive after a round has ended (e.g. after a reconnect).
      if (state.phase !== "countdown" && state.phase !== "playing") return state;
      if (!cur || cur.round !== event.round || cur.attempt !== event.attempt) return state;
      if (cur.scores[event.player] !== undefined) return state;
      if (!Number.isFinite(event.value)) return state;

      const scores = { ...cur.scores, [event.player]: event.value };
      const current = { ...cur, scores };
      if (scores.host === undefined || scores.guest === undefined) return { ...state, current };

      const better = state.games.find((g) => g.id === cur.gameId)!.better;
      const winner = compareScores(better, scores.host, scores.guest);
      const result: RoundResult = {
        round: cur.round,
        attempt: cur.attempt,
        gameId: cur.gameId,
        scores: { host: scores.host, guest: scores.guest },
        winner,
      };
      let players = state.players;
      let matchWinner: PlayerId | null = null;
      if (winner) {
        const p = players[winner]!;
        const wins = p.wins + 1;
        players = { ...players, [winner]: { ...p, wins } };
        if (wins >= winsNeeded(state.bestOf)) matchWinner = winner;
      }
      return {
        ...state,
        phase: "roundResult",
        current,
        players,
        history: [...state.history, result],
        winner: matchWinner,
        endReason: matchWinner ? "wins" : null,
      };
    }

    case "matchOver": {
      if (state.phase !== "roundResult" || !state.winner) return state;
      return { ...state, phase: "matchOver" };
    }

    case "forfeit": {
      // In the lobby nothing is at stake: a guest who leaves just frees the seat.
      if (state.phase === "lobby") {
        return event.player === "guest" ? { ...state, players: { ...state.players, guest: null } } : state;
      }
      if (state.phase === "matchOver") return state;
      return { ...state, phase: "matchOver", winner: other(event.player), endReason: "forfeit" };
    }

    case "rematchRequest": {
      if (state.phase !== "matchOver" || state.rematchRequested.includes(event.player)) return state;
      return { ...state, rematchRequested: [...state.rematchRequested, event.player] };
    }

    case "rematch": {
      if (state.phase !== "matchOver" || !state.players.guest) return state;
      const reset = (p: PlayerInfo): PlayerInfo => ({ ...p, wins: 0 });
      return {
        ...state,
        phase: "lobby",
        matchSeed: event.matchSeed,
        players: { host: reset(state.players.host), guest: reset(state.players.guest) },
        current: null,
        history: [],
        winner: null,
        endReason: null,
        rematchRequested: [],
      };
    }
  }
}
