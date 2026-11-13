import { BaseConnection, type Connection, type HostEndpoint, type Transport } from "./transport";

/**
 * In-process transport for tests. Messages are JSON round-tripped (catches
 * anything that wouldn't survive a real network) and delivered on a later
 * macrotask (catches code that wrongly assumes synchronous delivery).
 */
export class MemoryNetwork {
  private rooms = new Map<string, (c: Connection) => void>();
  /** Every live pair, so tests can simulate a dropped connection. */
  readonly links: Array<{ host: BaseConnection; guest: BaseConnection }> = [];

  transport(): Transport {
    return {
      host: async (roomId) => this.openRoom(roomId),
      join: async (roomId) => this.connect(roomId),
    };
  }

  private openRoom(roomId: string): HostEndpoint {
    let listener: (c: Connection) => void = () => {};
    this.rooms.set(roomId, (c) => listener(c));
    return {
      roomId,
      onConnection: (cb) => (listener = cb),
      close: () => this.rooms.delete(roomId),
    };
  }

  private connect(roomId: string): Connection {
    const accept = this.rooms.get(roomId);
    if (!accept) throw new Error(`room ${roomId} not found`);
    const deliver = (to: BaseConnection, m: unknown) => {
      const copy = JSON.parse(JSON.stringify(m));
      setTimeout(() => to.handleMessage(copy), 0);
    };
    const closeBoth = () => setTimeout(() => { host.handleClose(); guest.handleClose(); }, 0);
    const host: BaseConnection = new BaseConnection((m) => deliver(guest, m), closeBoth);
    const guest: BaseConnection = new BaseConnection((m) => deliver(host, m), closeBoth);
    this.links.push({ host, guest });
    setTimeout(() => accept(host), 0);
    return guest;
  }

  /** Simulate the network dropping every connection. */
  dropAll() {
    for (const l of this.links) {
      l.host.handleClose();
      l.guest.handleClose();
    }
  }
}
