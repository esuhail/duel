import { broadcastTransport } from "./broadcastTransport";
import type { Transport } from "./transport";

/**
 * `?net=local` -> two tabs in one browser (no network).
 * Default       -> PeerJS / WebRTC.
 * The PeerJS module is loaded lazily so local/test runs never touch it.
 */
export const netMode = (): "local" | "peer" =>
  new URLSearchParams(window.location.search).get("net") === "local" ? "local" : "peer";

export async function getTransport(): Promise<Transport> {
  if (netMode() === "local") return broadcastTransport;
  const { peerTransport } = await import("./peerTransport");
  return peerTransport;
}
