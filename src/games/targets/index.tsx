import { useRef, useState } from "react";
import { sfx } from "../../audio/sfx";

import { useFinishOnce, useReportProgress, useTimeUp } from "../hooks";
import { type GameProps, defineGame } from "../types";
import { TARGET_COUNT, TARGET_TIME_LIMIT, type Point, createTargetsPuzzle, timeoutScore } from "./puzzle";

function TargetTap({ puzzle, onFinish, onProgress }: GameProps<Point[]>) {
  const finish = useFinishOnce(onFinish);
  const [hit, setHit] = useState(0);
  const startedAt = useRef(performance.now());
  useTimeUp(TARGET_TIME_LIMIT, () => finish(timeoutScore(hit)));

  useReportProgress(onProgress, {
    fraction: hit / TARGET_COUNT,
    headline: String(hit),
    unit: `of ${TARGET_COUNT} hit`,
    detail: hit === TARGET_COUNT ? "Cleared" : `${TARGET_COUNT - hit} to go`,
  });

  const p = puzzle[hit];
  const tap = (e: React.PointerEvent) => {
    e.stopPropagation();
    sfx("pop");
    const next = hit + 1;
    setHit(next);
    if (next === TARGET_COUNT) finish(Math.round(e.timeStamp - startedAt.current));
  };

  return (
    <div className="targets" data-testid="targets-arena">
      <div className="targets__count">{hit} / {TARGET_COUNT}</div>
      {hit > 0 && (
        <span key={`b${hit}`} className="burst" style={{ left: `${puzzle[hit - 1]!.x}%`, top: `${puzzle[hit - 1]!.y}%` }} aria-hidden="true" />
      )}
      {p && (
        <button
          key={hit}
          className="target"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          onPointerDown={tap}
          aria-label="target"
          data-testid="target"
        />
      )}
    </div>
  );
}

export const targetTapGame = defineGame<Point[]>({
  id: "targets",
  name: "Target Tap",
  emoji: "🎯",
  keyHint: "Click each target with the mouse",
  instructions: `Tap the ${TARGET_COUNT} targets as fast as you can. They appear one at a time.`,
  durationMs: TARGET_TIME_LIMIT,
  better: "lower",
  formatScore: (n) => `${(n / 1000).toFixed(2)} s`,
  formatMargin: (d) => `${(d / 1000).toFixed(2)} s faster`,
  createPuzzle: createTargetsPuzzle,
  Component: TargetTap,
});
