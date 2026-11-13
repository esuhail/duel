/**
 * Reaction, head-to-head on ONE screen: both players watch the same light.
 * P1 hits A (or taps the left half), P2 hits L (or taps the right half).
 * Same rules as the online version (3 tries, 1000 ms penalty), so scores
 * mean the same thing in both modes.
 */
import { useEffect, useRef, useState } from "react";
import type { PlayerId } from "../../core/match";
import { ATTEMPTS, MISS_AFTER_MS, PENALTY_MS, type ReactionPuzzle, averageMs } from "./puzzle";

type Stage = "wait" | "go" | "feedback";
type Pair<T> = Record<PlayerId, T>;

export const DUEL_KEYS: Pair<string> = { host: "a", guest: "l" };

export function ReactionDuel({ puzzle, onFinish }: { puzzle: ReactionPuzzle; onFinish: (scores: Pair<number>) => void }) {
  const [attempt, setAttempt] = useState(0);
  const [stage, setStage] = useState<Stage>("wait");
  const [times, setTimes] = useState<Pair<number[]>>({ host: [], guest: [] });
  /** This attempt's result per player; undefined = hasn't hit yet. */
  const [hit, setHit] = useState<Partial<Pair<{ ms: number; label: string }>>>({});
  const greenAt = useRef(0);
  const done = useRef(false);

  // Refs mirror state so the key handler (registered once) sees fresh values.
  const live = useRef({ stage, hit });
  live.current = { stage, hit };

  const record = (p: PlayerId, ms: number, label: string) => {
    if (live.current.hit[p]) return;
    const next = { ...live.current.hit, [p]: { ms, label } };
    live.current.hit = next;
    setHit(next);
    if (next.host && next.guest) setStage("feedback");
  };

  const tap = (p: PlayerId, timeStamp: number) => {
    const s = live.current.stage;
    if (s === "wait") record(p, PENALTY_MS, "Too early");
    else if (s === "go") {
      const ms = Math.max(0, Math.round(timeStamp - greenAt.current));
      record(p, ms, `${ms} ms`);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === DUEL_KEYS.host) tap("host", e.timeStamp);
      if (k === DUEL_KEYS.guest) tap("guest", e.timeStamp);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (stage === "wait") {
      const id = setTimeout(() => setStage("go"), puzzle.delaysMs[attempt]);
      return () => clearTimeout(id);
    }
    if (stage === "go") {
      greenAt.current = performance.now();
      const raf = requestAnimationFrame((t) => (greenAt.current = t));
      const miss = setTimeout(() => {
        for (const p of ["host", "guest"] as const) record(p, PENALTY_MS, "Too slow");
      }, MISS_AFTER_MS);
      return () => { cancelAnimationFrame(raf); clearTimeout(miss); };
    }
    // feedback: bank this attempt, then next attempt or finish
    const h = live.current.hit;
    const next = { host: [...times.host, h.host!.ms], guest: [...times.guest, h.guest!.ms] };
    const id = setTimeout(() => {
      setTimes(next);
      if (next.host.length === ATTEMPTS) {
        if (!done.current) {
          done.current = true;
          onFinish({ host: averageMs(next.host), guest: averageMs(next.guest) });
        }
        return;
      }
      setHit({});
      setAttempt((a) => a + 1);
      setStage("wait");
    }, 1100);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, attempt]);

  const fastest = stage === "feedback" && hit.host && hit.guest
    ? hit.host.ms < hit.guest.ms ? "host" : hit.guest.ms < hit.host.ms ? "guest" : null
    : null;

  return (
    <div className={`duel duel--${stage}`} data-testid="reaction-duel">
      <div className="duel__light">{stage === "wait" ? "Hold" : stage === "go" ? "Hit!" : `Try ${attempt + 1} of ${ATTEMPTS}`}</div>
      <div className="duel__pads">
        {(["host", "guest"] as const).map((p) => (
          <button
            key={p}
            className={`duel__pad duel__pad--${p === "host" ? "p1" : "p2"} ${hit[p] ? "is-hit" : ""} ${fastest === p ? "is-fastest" : ""}`}
            onPointerDown={(e) => { e.preventDefault(); tap(p, e.timeStamp); }}
            data-testid={`duel-pad-${p}`}
          >
            <span className="duel__key">{DUEL_KEYS[p].toUpperCase()}</span>
            <span className="duel__result">{hit[p]?.label ?? ""}</span>
            <span className="duel__tries">
              {Array.from({ length: ATTEMPTS }, (_, i) => <i key={i} className={i < times[p].length ? "on" : ""} />)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
