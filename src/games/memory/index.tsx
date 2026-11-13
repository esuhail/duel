import { useEffect, useState } from "react";
import { useFinishOnce, useReportProgress, useTimeUp } from "../hooks";
import { type GameProps, defineGame } from "../types";
import { COLORS, type Color, MAX_LENGTH, START_LENGTH, createMemoryPuzzle, flashMs } from "./puzzle";

type Stage = { kind: "show"; step: number; lit: boolean } | { kind: "input"; pos: number } | { kind: "between" };

function MemorySequence({ puzzle, onFinish, onProgress }: GameProps<Color[]>) {
  const finish = useFinishOnce(onFinish);
  const [length, setLength] = useState(START_LENGTH);
  const [stage, setStage] = useState<Stage>({ kind: "between" });
  const [flash, setFlash] = useState<Color | null>(null);
  // Longest sequence fully repeated so far (0 if the first one was missed).
  const best = length === START_LENGTH ? 0 : length - 1;
  useTimeUp(memoryGame.durationMs, () => finish(best));

  // Playback: drive the "show" stage with timeouts.
  useEffect(() => {
    const ms = flashMs(length);
    let id: ReturnType<typeof setTimeout>;
    if (stage.kind === "between") id = setTimeout(() => setStage({ kind: "show", step: 0, lit: true }), 700);
    else if (stage.kind === "show") {
      id = setTimeout(() => {
        if (stage.lit) setStage({ ...stage, lit: false });
        else if (stage.step + 1 < length) setStage({ kind: "show", step: stage.step + 1, lit: true });
        else setStage({ kind: "input", pos: 0 });
      }, stage.lit ? ms : ms * 0.35);
    }
    return () => clearTimeout(id);
  }, [stage, length]);

  useReportProgress(onProgress, {
    fraction: Math.min(1, best / 12),
    headline: String(best),
    unit: "long",
    detail: stage.kind === "input" ? `Repeating ${length}` : `Watching ${length}`,
  });

  const lit = stage.kind === "show" && stage.lit ? puzzle[stage.step] : flash;

  const press = (c: Color) => {
    if (stage.kind !== "input") return;
    setFlash(c);
    setTimeout(() => setFlash(null), 150);
    if (c !== puzzle[stage.pos]) return finish(best);
    if (stage.pos + 1 < length) return setStage({ kind: "input", pos: stage.pos + 1 });
    if (length >= MAX_LENGTH) return finish(length);
    setLength(length + 1);
    setStage({ kind: "between" });
  };

  return (
    <div className="memory">
      <div className="memory__status" data-testid="memory-status">
        {stage.kind === "input" ? `Your turn: ${stage.pos}/${length}` : `Watch… (${length})`}
      </div>
      <div className="memory__pads" data-stage={stage.kind}>
        {COLORS.map((c) => (
          <button
            key={c}
            className={`pad pad--${c} ${lit === c ? "pad--lit" : ""}`}
            onPointerDown={(e) => { e.preventDefault(); press(c); }}
            data-testid={`pad-${c}`}
            aria-label={c}
          />
        ))}
      </div>
    </div>
  );
}

export const memoryGame = defineGame<Color[]>({
  id: "memory",
  name: "Memory Sequence",
  emoji: "🧠",
  instructions: "Watch the colors flash, then repeat them. Each round adds one more. One mistake ends it.",
  durationMs: 60_000,
  better: "higher",
  formatScore: (n) => `length ${n}`,
  formatMargin: (d) => `${d} longer`,
  createPuzzle: createMemoryPuzzle,
  Component: MemorySequence,
});
