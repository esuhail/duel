import { BaseConnection, type Connection, type HostEndpoint, type Transport } from "./transport";

/**
 * Two tabs of the same browser talk over BroadcastChannel. Used by
 * `?net=local` for development and by the Playwright test, so the full UI
 * can be exercised without WebRTC or the public PeerJS server.
 */
type Frame =
  | { k: "open"; id: string }
  | { k: "accept"; id: string }
  | { k: "data"; id: string; from: "host" | "guest"; m: unknown }
  | { k: "close"; id: string };

const channelFor = (roomId: string) => new BroadcastChannel(`duel-${roomId}`);

export const broadcastTransport: Transport = {
  async host(roomId): Promise<HostEndpoint> {
    const ch = channelFor(roomId);
    const conns = new Map<string, BaseConnection>();
    let listener: (c: Connection) => void = () => {};
    ch.onmessage = (e: MessageEvent<Frame>) => {
      const f = e.data;
      if (f.k === "open" && !conns.has(f.id)) {
        const c = new BaseConnection(
          (m) => ch.postMessage({ k: "data", id: f.id, from: "host", m } satisfies Frame),
          () => { ch.postMessage({ k: "close", id: f.id } satisfies Frame); conns.delete(f.id); },
        );
        conns.set(f.id, c);
        ch.postMessage({ k: "accept", id: f.id } satisfies Frame);
        listener(c);
      } else if (f.k === "data" && f.from === "guest") conns.get(f.id)?.handleMessage(f.m);
      else if (f.k === "close") { conns.get(f.id)?.handleClose(); conns.delete(f.id); }
    };
    addEventListener("pagehide", () => { for (const id of conns.keys()) ch.postMessage({ k: "close", id } satisfies Frame); });
    return { roomId, onConnection: (cb) => (listener = cb), close: () => ch.close() };
  },

  join(roomId): Promise<Connection> {
    const ch = channelFor(roomId);
    const id = Math.random().toString(36).slice(2);
    const conn = new BaseConnection(
      (m) => ch.postMessage({ k: "data", id, from: "guest", m } satisfies Frame),
      () => { ch.postMessage({ k: "close", id } satisfies Frame); ch.close(); },
    );
    addEventListener("pagehide", () => ch.postMessage({ k: "close", id } satisfies Frame));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("No host found for this room")), 3000);
      ch.onmessage = (e: MessageEvent<Frame>) => {
        const f = e.data;
        if (f.id !== id) return;
        if (f.k === "accept") { clearTimeout(timer); resolve(conn); }
        else if (f.k === "data" && f.from === "host") conn.handleMessage(f.m);
        else if (f.k === "close") conn.handleClose();
      };
      ch.postMessage({ k: "open", id } satisfies Frame);
    });
  },
};
