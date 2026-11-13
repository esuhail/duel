import { useState } from "react";
import { useFinishOnce, useKeys, useReportProgress, useTimeUp } from "../hooks";
import { type GameProps, defineGame } from "../types";
import { type ScrambledWord, createUnscramblePuzzle, isSolution } from "./puzzle";

function Unscramble({ puzzle, onFinish, onProgress }: GameProps<ScrambledWord[]>) {
  const finish = useFinishOnce(onFinish);
  const [index, setIndex] = useState(0);
  const [solved, setSolved] = useState(0);
  /** Indexes into the scrambled letters, in the order tapped. */
  const [picked, setPicked] = useState<number[]>([]);
  const [shake, setShake] = useState(0);
  useTimeUp(unscrambleGame.durationMs, () => finish(solved));

  const skipped = index - solved;
  useReportProgress(onProgress, {
    fraction: Math.min(1, solved / 15),
    headline: String(solved),
    unit: solved === 1 ? "word" : "words",
    detail: skipped ? `${skipped} skipped` : "No skips",
  });

  const item = puzzle[index % puzzle.length]!;
  const next = () => {
    setIndex((i) => i + 1);
    setPicked([]);
  };
  const pick = (i: number) => {
    if (picked.includes(i)) return;
    const p = [...picked, i];
    if (p.length < item.letters.length) return setPicked(p);
    if (isSolution(item.word, p.map((j) => item.letters[j]).join(""))) {
      setSolved((n) => n + 1);
      next();
    } else {
      setShake((n) => n + 1);
      setPicked([]);
    }
  };

  useKeys((e) => {
    const k = e.key.toLowerCase();
    if (k === "backspace") setPicked((p) => p.slice(0, -1));
    else if (k === " " || k === "enter") next();
    else if (/^[a-z]$/.test(k)) {
      const i = item.letters.findIndex((ch, j) => ch === k && !picked.includes(j));
      if (i >= 0) pick(i);
    } else return;
    e.preventDefault();
  });

  return (
    <div className="unscramble">
      <div className="math__solved">✓ {solved}</div>
      <div className={`slots ${shake ? "shake" : ""}`} key={shake} data-testid="unscramble-answer">
        {item.letters.map((_, i) => (
          <button key={i} className="slot" onPointerDown={() => setPicked((p) => p.slice(0, i))}>
            {picked[i] !== undefined ? item.letters[picked[i]!] : ""}
          </button>
        ))}
      </div>
      <div className="tiles" data-testid="unscramble-tiles">
        {item.letters.map((ch, i) => (
          <button key={`${index}-${i}`} className={picked.includes(i) ? "tile tile--used" : "tile"} onPointerDown={(e) => { e.preventDefault(); pick(i); }} data-testid={`tile-${i}`}>
            {ch}
          </button>
        ))}
      </div>
      <button className="key btn--small" onPointerDown={next} data-testid="skip">Skip</button>
    </div>
  );
}

export const unscrambleGame = defineGame<ScrambledWord[]>({
  id: "unscramble",
  name: "Unscramble",
  emoji: "🔤",
  keyHint: "Type the word, Backspace to undo, Space to skip",
  instructions: "Tap the letters in order to spell the word. Solve as many as you can in 45 seconds.",
  durationMs: 45_000,
  better: "higher",
  formatScore: (n) => `${n} word${n === 1 ? "" : "s"}`,
  formatMargin: (d) => `${d} more word${d === 1 ? "" : "s"}`,
  createPuzzle: createUnscramblePuzzle,
  Component: Unscramble,
});
