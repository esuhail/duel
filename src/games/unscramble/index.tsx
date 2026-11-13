import { useState } from "react";
import { useFinishOnce, useTimeUp } from "../hooks";
import { defineGame } from "../types";
import { type ScrambledWord, createUnscramblePuzzle, isSolution } from "./puzzle";

function Unscramble({ puzzle, onFinish }: { puzzle: ScrambledWord[]; onFinish: (n: number) => void }) {
  const finish = useFinishOnce(onFinish);
  const [index, setIndex] = useState(0);
  const [solved, setSolved] = useState(0);
  /** Indexes into the scrambled letters, in the order tapped. */
  const [picked, setPicked] = useState<number[]>([]);
  const [shake, setShake] = useState(0);
  useTimeUp(unscrambleGame.durationMs, () => finish(solved));

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
  instructions: "Tap the letters in order to spell the word. Solve as many as you can in 45 seconds.",
  durationMs: 45_000,
  better: "higher",
  formatScore: (n) => `${n} word${n === 1 ? "" : "s"}`,
  createPuzzle: createUnscramblePuzzle,
  Component: Unscramble,
});
