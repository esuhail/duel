/**
 * Real networking: WebRTC data channels via PeerJS.
 *
 * How a connection is made:
 *  1. Both browsers register with the free public PeerJS signaling server
 *     (0.peerjs.com). The host registers under a predictable id built from
 *     the room id; the guest gets a random id.
 *  2. The guest asks the signaling server to introduce it to the host id.
 *     The two browsers swap connection info (SDP + ICE candidates) through it.
 *  3. They then talk directly. The signaling server sees no game traffic.
 *     If a direct path is impossible (strict NAT/firewall), PeerJS's default
 *     config falls back to its public TURN relay.
 *
 * Heartbeat: WebRTC can take a long time to notice that the other side
 * vanished (phone locked, tab killed). Each side sends a tiny ping every 2 s
 * and treats 8 s of silence as a disconnect, which drives the 30 s rejoin
 * logic above this layer.
 */
import Peer, { type DataConnection, type PeerOptions } from "peerjs";
import { BaseConnection, type Connection, type HostEndpoint, type Transport } from "./transport";

const ID_PREFIX = "duel-esuhail-";
const HEARTBEAT_MS = 2000;
const DEAD_AFTER_MS = 8000;
const HB = "__hb";

function peerOptions(): PeerOptions {
  const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
  if (!turnUrl) return { debug: 1 }; // PeerJS defaults: Google STUN + PeerJS TURN
  return {
    debug: 1,
    config: {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: turnUrl, username: import.meta.env.VITE_TURN_USER, credential: import.meta.env.VITE_TURN_PASS },
      ],
    },
  };
}

function wrap(dc: DataConnection, onClosed?: () => void): Connection {
  const conn = new BaseConnection(
    (m) => dc.send(m),
    () => dc.close(),
  );
  let lastSeen = Date.now();
  const hb = setInterval(() => {
    if (Date.now() - lastSeen > DEAD_AFTER_MS) {
      dc.close();
      conn.handleClose();
      return;
    }
    if (dc.open) dc.send(HB);
  }, HEARTBEAT_MS);
  dc.on("data", (m) => {
    lastSeen = Date.now();
    if (m !== HB) conn.handleMessage(m);
  });
  const closed = () => {
    clearInterval(hb);
    conn.handleClose();
    onClosed?.();
  };
  dc.on("close", closed);
  dc.on("error", closed);
  conn.onClose(() => clearInterval(hb));
  return conn;
}

function openPeer(id?: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, peerOptions()) : new Peer(peerOptions());
    const timer = setTimeout(() => {
      peer.destroy();
      reject(new Error("Couldn't reach the matchmaking server. Check your connection."));
    }, 10_000);
    peer.once("open", () => {
      clearTimeout(timer);
      resolve(peer);
    });
    peer.once("error", (err) => {
      clearTimeout(timer);
      peer.destroy();
      reject(
        new Error(
          err.type === "unavailable-id"
            ? "That room is still open somewhere. Create a new match."
            : `Network error (${err.type}).`,
        ),
      );
    });
  });
}

export const peerTransport: Transport = {
  async host(roomId): Promise<HostEndpoint> {
    const peer = await openPeer(ID_PREFIX + roomId);
    let listener: (c: Connection) => void = () => {};
    peer.on("connection", (dc) => {
      dc.on("open", () => listener(wrap(dc)));
    });
    // Losing the signaling server doesn't drop existing peer links, but we
    // need it to accept a rejoin, so reconnect to it.
    peer.on("disconnected", () => {
      if (!peer.destroyed) setTimeout(() => !peer.destroyed && peer.reconnect(), 1000);
    });
    peer.on("error", (err) => console.warn("[peer host]", err.type, err));
    return { roomId, onConnection: (cb) => (listener = cb), close: () => peer.destroy() };
  },

  async join(roomId): Promise<Connection> {
    const peer = await openPeer();
    return new Promise((resolve, reject) => {
      const fail = (msg: string) => {
        clearTimeout(timer);
        peer.destroy();
        reject(new Error(msg));
      };
      const timer = setTimeout(() => fail("The host didn't answer. Are you on a network that blocks peer-to-peer?"), 15_000);
      peer.on("error", (err) => {
        if (err.type === "peer-unavailable") fail("Match not found. The host may have closed it.");
      });
      const dc = peer.connect(ID_PREFIX + roomId, { reliable: true, serialization: "json" });
      dc.on("open", () => {
        clearTimeout(timer);
        resolve(wrap(dc, () => peer.destroy()));
      });
    });
  },
};
