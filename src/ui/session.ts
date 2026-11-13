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
import { randomSeed } from "../core/rng";
import { GAME_RULES } from "../games/registry";
import { HostController } from "../host/hostController";
import { GuestClient, type GuestStatus } from "../net/guestClient";
import { getTransport } from "../net/select";

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
    current = { role: "host", roomId, host };
    pending = null;
  } catch (e) {
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
}

function view(s: Session): SessionView {
  if (s.role === "host") {
    const h = s.host;
    return {
      role: "host", roomId: s.roomId, state: h.state, status: "hosting", error: "",
      localStartAt: () => h.localStartAt(), go: () => h.go(),
      submitScore: (r, a, v) => h.submitScore(r, a, v), rttMs: 0,
    };
  }
  const g = s.guest;
  return {
    role: "guest", roomId: s.roomId, state: g.state, status: g.status, error: g.error,
    localStartAt: () => g.localStartAt(), go: () => g.go(),
    submitScore: (r, a, v) => g.submitScore(r, a, v), rttMs: g.rtt,
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
