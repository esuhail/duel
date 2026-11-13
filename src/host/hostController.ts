/**
 * The host's brain. Owns the authoritative MatchState, decides when rounds
 * start and end, and forwards every event to the guest.
 *
 * It depends only on the `Connection` interface, a clock function and timer
 * functions, all injected. That's what lets the same class run:
 *   - in the host's browser over PeerJS (today),
 *   - in a test with an in-memory transport and fake timers,
 *   - on a Node server later, if peer-to-peer turns out to be too flaky.
 */
import {
  type BestOf,
  type GameRule,
  type MatchEvent,
  type MatchState,
  createMatch,
  matchReducer,
  nextRoundStart,
} from "../core/match";
import { PROTOCOL_VERSION, parseGuestMessage, type HostToGuest } from "../net/protocol";
import type { Connection, HostEndpoint } from "../net/transport";

export const TIMING = {
  /** Instructions screen before the 3-2-1. */
  introMs: 4000,
  countdownMs: 3000,
  /** How long the round result stays on screen. */
  resultMs: 3500,
  /** Grace period for a dropped player to come back. */
  rejoinMs: 30_000,
};

export interface HostOptions {
  endpoint: HostEndpoint;
  hostName: string;
  bestOf: BestOf;
  games: GameRule[];
  now: () => number;
  randomSeed: () => number;
  timing?: Partial<typeof TIMING>;
}

export class HostController {
  state: MatchState;
  readonly timing: typeof TIMING;
  private guestConn: Connection | null = null;
  private guestToken: string | null = null;
  private listeners = new Set<(s: MatchState) => void>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private forfeitTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly opts: HostOptions) {
    this.timing = { ...TIMING, ...opts.timing };
    this.state = createMatch({ hostName: opts.hostName, bestOf: opts.bestOf, matchSeed: opts.randomSeed(), games: opts.games });
    opts.endpoint.onConnection((c) => this.handleConnection(c));
  }

  subscribe(cb: (s: MatchState) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  // ---- actions available to the host's UI ----

  setBestOf(bestOf: BestOf) {
    this.dispatch({ type: "config", bestOf });
  }

  start() {
    this.startNextRound();
  }

  submitScore(round: number, attempt: number, value: number) {
    this.dispatch({ type: "score", player: "host", round, attempt, value });
  }

  /** Each side flips countdown -> playing locally when its clock hits startAt. */
  go() {
    this.dispatch({ type: "go" });
  }

  rematch() {
    this.dispatch({ type: "rematch", matchSeed: this.opts.randomSeed() });
    this.startNextRound();
  }

  /** Host-clock time at which the current round starts (same clock as `now`). */
  localStartAt(): number | null {
    return this.state.current?.startAt ?? null;
  }

  dispose() {
    for (const t of this.timers) clearTimeout(t);
    if (this.forfeitTimer) clearTimeout(this.forfeitTimer);
    this.guestConn?.close();
    this.opts.endpoint.close();
  }

  // ---- internals ----

  private dispatch(event: MatchEvent) {
    const prev = this.state;
    this.state = matchReducer(prev, event);
    if (this.state === prev) return; // rejected by the rules: nothing to tell anyone
    // "go" is local-only; the guest decides its own go from the shared startAt.
    if (event.type !== "go") this.send({ t: "event", event });
    for (const cb of this.listeners) cb(this.state);
    this.afterEvent(prev);
  }

  /** Side effects (timers) triggered by state transitions. Rules stay in the reducer. */
  private afterEvent(prev: MatchState) {
    const s = this.state;
    if (s.phase === "roundResult" && prev.phase !== "roundResult") {
      this.later(this.timing.resultMs, () => {
        if (this.state.winner) this.dispatch({ type: "matchOver" });
        else this.startNextRound();
      });
    }
  }

  private startNextRound() {
    const intro = this.state.phase === "roundResult" && this.state.history.at(-1)?.winner === null ? 1500 : this.timing.introMs;
    const ev = nextRoundStart(this.state, this.opts.now() + intro + this.timing.countdownMs);
    if (ev) this.dispatch(ev);
    // If the guest is away, nextRoundStart returns null; reconnect calls us again.
  }

  private later(ms: number, fn: () => void) {
    const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms);
    this.timers.add(t);
  }

  private send(msg: HostToGuest) {
    this.guestConn?.send(msg);
  }

  private handleConnection(conn: Connection) {
    // Wait for `hello` before treating this connection as the guest.
    conn.onMessage((raw) => {
      const msg = parseGuestMessage(raw);
      if (!msg) return;
      if (msg.t === "hello") return this.handleHello(conn, msg.name, msg.token, msg.v);
      if (msg.t === "ping") return conn.send({ t: "pong", t0: msg.t0, hostTime: this.opts.now() } satisfies HostToGuest);
      if (conn !== this.guestConn) return; // only the seated guest can act
      if (msg.t === "score") this.dispatch({ type: "score", player: "guest", round: msg.round, attempt: msg.attempt, value: msg.value });
      if (msg.t === "rematch") this.dispatch({ type: "rematchRequest", player: "guest" });
    });
    conn.onClose(() => {
      if (conn !== this.guestConn) return;
      this.guestConn = null;
      this.dispatch({ type: "connection", player: "guest", connected: false });
      this.forfeitTimer = setTimeout(() => this.dispatch({ type: "forfeit", player: "guest" }), this.timing.rejoinMs);
    });
  }

  private handleHello(conn: Connection, rawName: string, token: string, version: number) {
    const reject = (reason: string) => {
      conn.send({ t: "reject", reason } satisfies HostToGuest);
      setTimeout(() => conn.close(), 100);
    };
    if (version !== PROTOCOL_VERSION) return reject("Version mismatch: refresh both pages.");
    const guest = this.state.players.guest;
    const rejoining = guest !== null && token === this.guestToken;
    if (guest && !rejoining) return reject("This match already has two players.");
    if (rejoining && guest.connected && this.guestConn) this.guestConn.close(); // replace a stale tab

    this.guestConn = conn;
    this.guestToken = token;
    if (this.forfeitTimer) clearTimeout(this.forfeitTimer);
    this.forfeitTimer = null;

    if (!rejoining) {
      const name = rawName.trim().slice(0, 20) || "Guest";
      this.state = matchReducer(this.state, { type: "join", name });
      conn.send({ t: "sync", v: PROTOCOL_VERSION, state: this.state } satisfies HostToGuest);
      for (const cb of this.listeners) cb(this.state);
      return;
    }
    // Rejoin: snapshot first, then mark connected (which the guest receives as an event).
    conn.send({ t: "sync", v: PROTOCOL_VERSION, state: this.state } satisfies HostToGuest);
    this.dispatch({ type: "connection", player: "guest", connected: true });
    // A round interrupted by the drop is replayed fresh: the guest's
    // half-played game was lost on their side, so the only fair fix is a redo.
    const p = this.state.phase;
    if (p === "countdown" || p === "playing") this.startNextRound();
    else if (p === "roundResult" && !this.state.winner && this.timers.size === 0) this.startNextRound();
  }
}
