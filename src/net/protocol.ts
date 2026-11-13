/**
 * Every message that crosses the network. Kept as plain JSON-able objects.
 *
 * Design note: instead of a separate message type per rule (config,
 * roundStart, roundResult, matchOver...), the host forwards *reducer events*
 * (`{t:"event"}`). The guest runs the same reducer, so things like the round
 * result never need to be sent: the guest computes it from the two `score`
 * events, exactly as the host did. Fewer message types = fewer ways for the
 * two screens to disagree.
 */
import type { MatchEvent, MatchState } from "../core/match";

export const PROTOCOL_VERSION = 1;

export type HostToGuest =
  | { t: "sync"; v: number; state: MatchState } // full snapshot on join / rejoin
  | { t: "event"; event: MatchEvent } // every state change, in order
  | { t: "pong"; t0: number; hostTime: number } // clock sync reply
  | { t: "reject"; reason: string };

export type GuestToHost =
  | { t: "hello"; v: number; name: string; token: string } // token = same guest on rejoin
  | { t: "score"; round: number; attempt: number; value: number }
  | { t: "rematch" }
  | { t: "ping"; t0: number };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isStr = (x: unknown, max = 64): x is string => typeof x === "string" && x.length <= max;

/**
 * The host must not trust the guest's bytes: validate shape before use.
 * (The guest trusts the host; the host is the authority by design.)
 */
export function parseGuestMessage(x: unknown): GuestToHost | null {
  if (!isObj(x)) return null;
  switch (x.t) {
    case "hello":
      return isNum(x.v) && isStr(x.name, 40) && isStr(x.token) ? { t: "hello", v: x.v, name: x.name, token: x.token } : null;
    case "score":
      return isNum(x.round) && isNum(x.attempt) && isNum(x.value)
        ? { t: "score", round: x.round, attempt: x.attempt, value: x.value }
        : null;
    case "rematch":
      return { t: "rematch" };
    case "ping":
      return isNum(x.t0) ? { t: "ping", t0: x.t0 } : null;
    default:
      return null;
  }
}
