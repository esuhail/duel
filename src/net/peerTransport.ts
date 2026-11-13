import type { Transport } from "./transport";

export const peerTransport: Transport = {
  host: async () => { throw new Error("PeerJS transport not implemented yet"); },
  join: async () => { throw new Error("PeerJS transport not implemented yet"); },
};
