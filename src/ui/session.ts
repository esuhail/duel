/**
 * Glue between the UI and the networking classes.
 *
 * Sessions live in a module-level variable, not in React state: React's
 * StrictMode mounts components twice in development, and we must not open
 * (and close, and reopen) a network room every time a component re-mounts.
 */
import { useSyncExternalStore } from "react";
import { now } from "../core/clock";
import type { BestOf, MatchState, PlayerId } from "../core/match";
import type { Progress } from "../games/types";
import { randomSeed } from "../core/rng";
import { GAME_RULES } from "../games/registry";
import { HostController } from "../host/hostController";
import { GuestClient, type GuestStatus } from "../net/guestClient";
import { getTransport } from "../net/select";
import { RoomTakenError, newRoomId } from "../net/transport";
import { navigate } from "./router";
import { trackEvent } from "../analytics";

export type Session =
  | { role: "host"; roomId: string; host: HostController; error?: string }
  | { role: "guest"; roomId: string; guest: GuestClient };

let current: Session | null = null;
let pending: { key: string; error?: string } | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let version = 0;
const bump = () => { version++; emit(); };

export async function startHosting(roomId: string, hostName: string, bestOf: BestOf) {
  const key = `host:${roomId}`;
  if (pending?.key === key || (current?.role === "host" && current.roomId === roomId)) return;
  leave();
  pending = { key };
  bump();
  try {
    const transport = await getTransport();
    const endpoint = await transport.host(roomId);
    const host = new HostController({ endpoint, hostName, bestOf, games: GAME_RULES, now, randomSeed });
    host.subscribe(bump);
    // Count each finished match once (host only, so a match isn't counted twice).
    let counted = -1;
    host.subscribe((s) => {
      if (s.phase === "matchOver" && counted !== s.matchSeed) {
        counted = s.matchSeed;
        trackEvent(s.endReason === "forfeit" ? "match-forfeit" : "match-complete");
      }
    });
    current = { role: "host", roomId, host };
    pending = null;
  } catch (e) {
    if (e instanceof RoomTakenError) {
      // Code clash on the public server: quietly pick another code.
      pending = null;
      navigate(`/host/${newRoomId()}`);
      return;
    }
    pending = { key, error: e instanceof Error ? e.message : String(e) };
  }
  bump();
}

export async function joinRoom(roomId: string, name: string) {
  const key = `guest:${roomId}`;
  if (current?.role === "guest" && current.roomId === roomId) return;
  leave();
  const tokenKey = `duel:token:${roomId}`;
  let token = sessionStorage.getItem(tokenKey);
  if (!token) {
    token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    sessionStorage.setItem(tokenKey, token);
  }
  pending = { key };
  const transport = await getTransport();
  const guest = new GuestClient({ transport, roomId, name, token, now });
  guest.subscribe(bump);
  current = { role: "guest", roomId, guest };
  pending = null;
  bump();
  await guest.connect();
}

export function leave() {
  if (!current) return;
  if (current.role === "host") current.host.dispose();
  else current.guest.dispose();
  current = null;
  bump();
}

export const pendingError = () => pending?.error;

/** Flattened view of whichever session is active, for components. */
export interface SessionView {
  role: PlayerId;
  roomId: string;
  state: MatchState | null;
  status: GuestStatus | "hosting";
  error: string;
  /** This device's clock time when the current round starts. */
  localStartAt: () => number | null;
  go: () => void;
  submitScore: (round: number, attempt: number, value: number) => void;
  rttMs: number;
  /** Live progress for the current round only (stale rounds are dropped). */
  progress: Partial<Record<PlayerId, Progress>>;
  reportProgress: (round: number, attempt: number, p: Progress) => void;
}

type ProgressMap = Partial<Record<PlayerId, { round: number; attempt: number; p: Progress }>>;
function currentProgress(state: MatchState | null, map: ProgressMap): Partial<Record<PlayerId, Progress>> {
  const cur = state?.current;
  const out: Partial<Record<PlayerId, Progress>> = {};
  if (!cur) return out;
  for (const k of ["host", "guest"] as const) {
    const e = map[k];
    if (e && e.round === cur.round && e.attempt === cur.attempt) out[k] = e.p;
  }
  return out;
}

function view(s: Session): SessionView {
  if (s.role === "host") {
    const h = s.host;
    return {
      role: "host", roomId: s.roomId, state: h.state, status: "hosting", error: "",
      localStartAt: () => h.localStartAt(), go: () => h.go(),
      submitScore: (r, a, v) => h.submitScore(r, a, v), rttMs: 0,
      progress: currentProgress(h.state, h.progress), reportProgress: (r, a, p) => h.reportProgress(r, a, p),
    };
  }
  const g = s.guest;
  return {
    role: "guest", roomId: s.roomId, state: g.state, status: g.status, error: g.error,
    localStartAt: () => g.localStartAt(), go: () => g.go(),
    submitScore: (r, a, v) => g.submitScore(r, a, v), rttMs: g.rtt,
    progress: currentProgress(g.state, g.progress), reportProgress: (r, a, p) => g.reportProgress(r, a, p),
  };
}

let cachedVersion = -1;
let cachedView: SessionView | null = null;
function snapshot(): SessionView | null {
  if (cachedVersion !== version) {
    cachedVersion = version;
    cachedView = current ? view(current) : null;
  }
  return cachedView;
}

export function useSession(): SessionView | null {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    snapshot,
  );
}

export const getSession = () => current;

// Debug hook (also used by the e2e test to explain failures): window.__duel()
(window as unknown as { __duel: () => unknown }).__duel = () => current && view(current).state;
