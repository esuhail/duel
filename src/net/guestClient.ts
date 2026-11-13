/**
 * The guest's side: a mirror of the host's state plus a way to send scores.
 * It never decides anything; it applies the host's events with the same
 * reducer so both screens agree.
 */
import { type ClockSample, estimateOffset } from "../core/clock";
import { type MatchState, matchReducer } from "../core/match";
import { type GuestToHost, type HostToGuest, PROTOCOL_VERSION } from "./protocol";
import type { Connection, Transport } from "./transport";

export type GuestStatus = "connecting" | "connected" | "reconnecting" | "lost" | "rejected";

export interface GuestOptions {
  transport: Transport;
  roomId: string;
  name: string;
  /** Random per-room id kept in sessionStorage, so a refresh can rejoin. */
  token: string;
  now: () => number;
  rejoinMs?: number;
  pingCount?: number;
}

export class GuestClient {
  state: MatchState | null = null;
  status: GuestStatus = "connecting";
  error = "";
  /** hostClock - guestClock, ms. */
  offset = 0;
  rtt = 0;
  private conn: Connection | null = null;
  private samples: ClockSample[] = [];
  private listeners = new Set<() => void>();
  private disposed = false;
  private lostAt = 0;

  constructor(private readonly opts: GuestOptions) {}

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit() {
    for (const cb of this.listeners) cb();
  }

  async connect(): Promise<void> {
    try {
      const conn = await this.opts.transport.join(this.opts.roomId);
      if (this.disposed) return conn.close();
      this.conn = conn;
      conn.onMessage((m) => this.handle(m as HostToGuest));
      conn.onClose(() => this.handleClose(conn));
      this.send({ t: "hello", v: PROTOCOL_VERSION, name: this.opts.name, token: this.opts.token });
      this.syncClock();
    } catch (e) {
      if (this.status === "reconnecting") return this.retry();
      this.status = "lost";
      this.error = e instanceof Error ? e.message : String(e);
      this.emit();
    }
  }

  submitScore(round: number, attempt: number, value: number) {
    this.send({ t: "score", round, attempt, value });
  }

  requestRematch() {
    this.send({ t: "rematch" });
  }

  /** Convert the host-clock startAt into this device's clock. */
  localStartAt(): number | null {
    const s = this.state?.current?.startAt;
    return s === undefined ? null : s - this.offset;
  }

  /** Local-only phase flip, same as the host does on its side. */
  go() {
    if (this.state) this.setState(matchReducer(this.state, { type: "go" }));
  }

  dispose() {
    this.disposed = true;
    this.conn?.close();
  }

  private send(m: GuestToHost) {
    this.conn?.send(m);
  }

  private setState(s: MatchState) {
    if (s === this.state) return;
    this.state = s;
    this.emit();
  }

  private handle(m: HostToGuest) {
    switch (m.t) {
      case "sync":
        this.status = "connected";
        this.setState(m.state);
        this.emit();
        break;
      case "event":
        if (this.state) this.setState(matchReducer(this.state, m.event));
        if (m.event.type === "roundStart") this.syncClock(); // refresh between rounds
        break;
      case "pong": {
        this.samples.push({ t0: m.t0, hostTime: m.hostTime, t1: this.opts.now() });
        const est = estimateOffset(this.samples.slice(-10));
        if (est) ({ offset: this.offset, rtt: this.rtt } = est);
        break;
      }
      case "reject":
        this.status = "rejected";
        this.error = m.reason;
        this.disposed = true;
        this.emit();
        break;
    }
  }

  private syncClock() {
    const n = this.opts.pingCount ?? 5;
    for (let i = 0; i < n; i++) setTimeout(() => this.send({ t: "ping", t0: this.opts.now() }), i * 150);
  }

  private handleClose(conn: Connection) {
    if (conn !== this.conn || this.disposed) return;
    this.conn = null;
    if (this.state?.phase === "matchOver") return; // nothing left to protect
    this.status = "reconnecting";
    this.lostAt = this.opts.now();
    this.emit();
    this.retry();
  }

  /** Keep trying the same room for the grace period, then give up. */
  private retry() {
    if (this.disposed) return;
    if (this.opts.now() - this.lostAt > (this.opts.rejoinMs ?? 30_000)) {
      this.status = "lost";
      this.error = "Lost connection to the host.";
      this.emit();
      return;
    }
    setTimeout(() => void this.connect(), 2000);
  }
}
