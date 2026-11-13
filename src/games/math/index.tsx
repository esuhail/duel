import { useState } from "react";
import { useFinishOnce, useKeys, useReportProgress, useTimeUp } from "../hooks";
import { type GameProps, defineGame } from "../types";
import { type MathProblem, createMathPuzzle } from "./puzzle";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "C"];

function QuickMath({ puzzle, onFinish, onProgress }: GameProps<MathProblem[]>) {
  const finish = useFinishOnce(onFinish);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [shake, setShake] = useState(0);
  useTimeUp(quickMathGame.durationMs, () => finish(index));

  const [misses, setMisses] = useState(0);
  const [lastRight, setLastRight] = useState(false);
  useReportProgress(onProgress, {
    fraction: Math.min(1, index / 25),
    headline: String(index),
    unit: "solved",
    detail: misses ? `${misses} wrong` : "No mistakes",
  });

  const p = puzzle[index]!;
  const press = (k: string) => {
    if (k === "⌫") return setInput((s) => s.slice(0, -1));
    if (k === "C") return setInput("");
    const next = input + k;
    const target = String(p.answer);
    // Auto-submit once enough digits are typed: no "enter" key to aim for.
    if (next.length < target.length) return setInput(next);
    setLastRight(next === target);
    if (next === target) {
      setIndex((i) => Math.min(i + 1, puzzle.length - 1));
      if (index + 1 >= puzzle.length) finish(index + 1);
    } else {
      setShake((n) => n + 1);
      setMisses((n) => n + 1);
    }
    setInput("");
  };

  useKeys((e) => {
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === "Backspace") press("⌫");
    else if (e.key === "Escape" || e.key === "Delete") press("C");
    else return;
    e.preventDefault();
  });

  return (
    <div className="math">
      <div className="math__solved" data-testid="math-solved">✓ {index}</div>
      <div className={`math__problem ${!lastRight && shake ? "shake" : ""} ${index > 0 && !input && lastRight ? "is-right" : ""}`} key={`${shake}:${index}`} data-testid="math-problem">
        {p.a} {p.op} {p.b} = <span className="math__input">{input || "?"}</span>
      </div>
      <div className="numpad">
        {KEYS.map((k) => (
          <button key={k} className="numpad__key" onPointerDown={(e) => { e.preventDefault(); press(k); }} data-testid={`key-${k}`}>
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

export const quickMathGame = defineGame<MathProblem[]>({
  id: "math",
  name: "Quick Math",
  emoji: "🧮",
  keyHint: "Type the answer with number keys, Backspace to fix",
  instructions: "Solve as many as you can in 30 seconds. Answers submit themselves.",
  durationMs: 30_000,
  better: "higher",
  formatScore: (n) => `${n} solved`,
  formatMargin: (d) => `${d} more solved`,
  createPuzzle: createMathPuzzle,
  Component: QuickMath,
});
