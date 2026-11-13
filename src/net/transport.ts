/**
 * The networking boundary. Everything above this file (host controller,
 * guest client, UI) talks to these interfaces, never to PeerJS directly.
 *
 * Implementations:
 *  - memory    : same JS context, for unit/integration tests
 *  - broadcast : two tabs of the same browser (BroadcastChannel), for local
 *                dev and Playwright, no network needed
 *  - peerjs    : real WebRTC between devices
 *
 * Swapping PeerJS for a WebSocket server later means writing one more
 * implementation of these two interfaces.
 */
export interface Connection {
  send(msg: unknown): void;
  onMessage(cb: (msg: unknown) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}

export interface HostEndpoint {
  roomId: string;
  onConnection(cb: (conn: Connection) => void): void;
  close(): void;
}

export interface Transport {
  /** Open a room. `roomId` lets a refreshed host try to reclaim its room. */
  host(roomId: string): Promise<HostEndpoint>;
  join(roomId: string): Promise<Connection>;
}

/** Small helper so implementations share listener bookkeeping. */
export class BaseConnection implements Connection {
  private msgCbs: Array<(m: unknown) => void> = [];
  private closeCbs: Array<() => void> = [];
  private closed = false;
  constructor(private readonly sendImpl: (m: unknown) => void, private readonly closeImpl: () => void) {}
  send(msg: unknown) {
    if (!this.closed) this.sendImpl(msg);
  }
  onMessage(cb: (m: unknown) => void) {
    this.msgCbs.push(cb);
  }
  onClose(cb: () => void) {
    this.closeCbs.push(cb);
  }
  close() {
    if (this.closed) return;
    this.closeImpl();
    this.handleClose();
  }
  /** For implementations: deliver an incoming message. */
  handleMessage(m: unknown) {
    if (!this.closed) for (const cb of this.msgCbs) cb(m);
  }
  /** For implementations: the other side went away. */
  handleClose() {
    if (this.closed) return;
    this.closed = true;
    for (const cb of this.closeCbs) cb();
  }
}

/**
 * 4-letter room codes, short enough to read out loud or type on a phone.
 * No I or O (they look like 1 and 0). 24^4 = 331,776 codes: plenty for a
 * hobby project, and a clash is handled by picking another code (see
 * RoomTakenError). Trade-off: codes are guessable, so a stranger could
 * stumble into a lobby. Acceptable for casual games between friends.
 */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export const CODE_LENGTH = 4;

export function newRoomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export const normalizeCode = (s: string) =>
  s.toUpperCase().split("").filter((c) => CODE_ALPHABET.includes(c)).join("").slice(0, CODE_LENGTH);

/** Thrown by Transport.host() when someone else already holds the code. */
export class RoomTakenError extends Error {
  constructor() {
    super("That room code is in use.");
  }
}
