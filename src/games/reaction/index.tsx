import { useEffect, useRef, useState } from "react";
import { type GameProps, defineGame } from "../types";
import { useFinishOnce, useKeys, useReportProgress } from "../hooks";
import {
  ATTEMPTS,
  MISS_AFTER_MS,
  PENALTY_MS,
  type ReactionPuzzle,
  averageMs,
  createReactionPuzzle,
} from "./puzzle";

type Stage = "wait" | "go" | "feedback";

function Reaction({ puzzle, onFinish, onProgress }: GameProps<ReactionPuzzle>) {
  const finish = useFinishOnce(onFinish);
  const [attempt, setAttempt] = useState(0);
  const [stage, setStage] = useState<Stage>("wait");
  const [times, setTimes] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  // performance.now() of the frame where green was painted. A ref, not state:
  // it's read in the event handler and never rendered.
  const greenAt = useRef(0);

  const record = (ms: number, msg: string) => {
    const next = [...times, ms];
    setTimes(next);
    setMessage(msg);
    setStage("feedback");
    if (next.length === ATTEMPTS) setTimeout(() => finish(averageMs(next)), 900);
    else setTimeout(() => { setAttempt((a) => a + 1); setStage("wait"); }, 900);
  };

  useEffect(() => {
    if (stage === "wait") {
      const id = setTimeout(() => setStage("go"), puzzle.delaysMs[attempt]);
      return () => clearTimeout(id);
    }
    if (stage === "go") {
      // rAF fires just before the browser paints the green frame, which is
      // the closest JS gets to "the moment the player could see it".
      greenAt.current = performance.now(); // fallback if a tap beats the first frame
      const raf = requestAnimationFrame((t) => (greenAt.current = t));
      const miss = setTimeout(() => record(PENALTY_MS, "Too slow +1s"), MISS_AFTER_MS);
      return () => { cancelAnimationFrame(raf); clearTimeout(miss); };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, attempt]);

  useReportProgress(onProgress, {
    fraction: times.length / ATTEMPTS,
    headline: times.length ? String(averageMs(times)) : "-",
    unit: "ms avg",
    detail: times.length === ATTEMPTS ? "All tries done" : `Try ${Math.min(times.length + 1, ATTEMPTS)} of ${ATTEMPTS}`,
  });

  useKeys((e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onTap(e);
    }
  });

  const onTap = (e: { timeStamp: number }) => {
    if (stage === "wait") record(PENALTY_MS, "Too early +1s");
    // pointerdown + event.timeStamp (same clock as rAF) avoids click's delay.
    else if (stage === "go") {
      const ms = Math.max(0, Math.round(e.timeStamp - greenAt.current));
      record(ms, `${ms} ms`);
    }
  };

  return (
    <div className={`reaction reaction--${stage}`} onPointerDown={onTap} data-testid="reaction-pad">
      <div className="reaction__lamp" aria-hidden="true" />
      <div className="reaction__label">
        {stage === "wait" && "Hold…"}
        {stage === "go" && "Hit!"}
        {stage === "feedback" && message}
      </div>
      <div className="reaction__dots">
        {Array.from({ length: ATTEMPTS }, (_, i) => (
          <span key={i} className={i < times.length ? "dot dot--done" : "dot"} />
        ))}
      </div>
    </div>
  );
}

export const reactionGame = defineGame<ReactionPuzzle>({
  id: "reaction",
  name: "Reaction",
  emoji: "⚡",
  keyHint: "Space or click when it turns green",
  instructions: "Tap the moment the screen turns green. 3 tries. Tapping early costs you a second!",
  durationMs: 20_000,
  better: "lower",
  formatScore: (n) => `${n} ms`,
  formatMargin: (d) => `${d} ms faster`,
  createPuzzle: createReactionPuzzle,
  Component: Reaction,
});
