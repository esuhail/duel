import { useState } from "react";
import { sfx } from "../../audio/sfx";

import { useFinishOnce, useKeys, useReportProgress, useTimeUp } from "../hooks";
import { type GameProps, defineGame } from "../types";
import { type AnagramsPuzzle, POINTS, createAnagramsPuzzle, judge } from "./puzzle";

type Flash = { id: number; text: string; good: boolean };

const REASONS = { short: "3 letters minimum", used: "Already found", unknown: "Not in the word list", letters: "Use the tiles" } as const;

function Anagrams({ puzzle, onFinish, onProgress }: GameProps<AnagramsPuzzle>) {
  const finish = useFinishOnce(onFinish);
  /** Tile order on screen (indexes into puzzle.letters); shuffling only changes this. */
  const [order, setOrder] = useState(() => puzzle.letters.map((_, i) => i));
  /** Tiles used in the word being built, in order. */
  const [picked, setPicked] = useState<number[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [points, setPoints] = useState(0);
  const [flash, setFlash] = useState<Flash | null>(null);
  useTimeUp(anagramsGame.durationMs, () => finish(points));

  const longest = found.reduce((m, w) => Math.max(m, w.length), 0);
  useReportProgress(onProgress, {
    fraction: Math.min(1, points / 8000),
    headline: String(points),
    unit: "pts",
    detail: found.length ? `${found.length} word${found.length === 1 ? "" : "s"}, longest ${longest}` : "No words yet",
  });

  const word = picked.map((i) => puzzle.letters[i]).join("");
  const say = (text: string, good: boolean) => setFlash({ id: Date.now(), text, good });

  const pick = (i: number) => {
    if (picked.includes(i)) return;
    sfx("key");
    setPicked([...picked, i]);
  };
  const submit = () => {
    if (!word) return;
    const v = judge(word, puzzle, new Set(found));
    if (v.ok) {
      setFound([word, ...found]);
      setPoints(points + v.points);
      say(`${word.toUpperCase()} +${v.points}`, true);
      sfx("correct", word.length - 2);
    } else {
      say(REASONS[v.reason], false);
      sfx("wrong");
    }
    setPicked([]);
  };
  const shuffle = () => {
    sfx("move");
    setOrder((o) => [...o].sort(() => Math.random() - 0.5));
  };

  useKeys((e) => {
    const k = e.key.toLowerCase();
    if (k === "enter") submit();
    else if (k === "backspace") setPicked((p) => p.slice(0, -1));
    else if (k === " ") shuffle();
    else if (k === "escape") setPicked([]);
    else if (/^[a-z]$/.test(k)) {
      const i = order.find((j) => puzzle.letters[j] === k && !picked.includes(j));
      if (i === undefined) return;
      pick(i);
    } else return;
    e.preventDefault();
  });

  return (
    <div className="anagrams">
      <div className="anagrams__score" data-testid="anagrams-score">
        <span className="anagrams__points" key={points}>{points}</span>
        <span className="anagrams__label">pts, {found.length} word{found.length === 1 ? "" : "s"}</span>
      </div>

      <div className="anagrams__word" data-testid="anagrams-word">
        {puzzle.letters.map((_, i) => (
          <span key={i} className={picked[i] !== undefined ? "slot is-filled" : "slot"}>{picked[i] !== undefined ? puzzle.letters[picked[i]!] : ""}</span>
        ))}
        {flash && (
          <span key={flash.id} className={flash.good ? "anagrams__flash is-good" : "anagrams__flash is-bad"}>{flash.text}</span>
        )}
      </div>

      <div className="anagrams__tiles" data-testid="anagrams-tiles">
        {order.map((i) => (
          <button
            key={i}
            className={picked.includes(i) ? "tile tile--used" : "tile"}
            onPointerDown={(e) => { e.preventDefault(); pick(i); }}
            data-letter={puzzle.letters[i]}
          >
            {puzzle.letters[i]}
          </button>
        ))}
      </div>

      <div className="anagrams__actions">
        <button className="key" onPointerDown={(e) => { e.preventDefault(); shuffle(); }}>Shuffle</button>
        <button className="key" onPointerDown={(e) => { e.preventDefault(); setPicked([]); }}>Clear</button>
        <button className="key key--go" onPointerDown={(e) => { e.preventDefault(); submit(); }} data-testid="anagrams-enter" disabled={word.length < 3}>Enter</button>
      </div>

      <ul className="anagrams__found" aria-label="Words found">
        {found.map((w) => (
          <li key={w} className={`len-${w.length}`}>{w}<small>{POINTS[w.length]}</small></li>
        ))}
      </ul>
    </div>
  );
}

export const anagramsGame = defineGame<AnagramsPuzzle>({
  id: "anagrams",
  name: "Anagrams",
  emoji: "🔤",
  instructions: "Make as many words as you can from 6 letters. Longer words score far more: 3 letters 100, 4 letters 400, 5 letters 1200, all 6 letters 2000.",
  keyHint: "Type a word, Enter to submit, Space to shuffle",
  durationMs: 60_000,
  better: "higher",
  formatScore: (n) => `${n} pts`,
  formatMargin: (d) => `${d} pts ahead`,
  createPuzzle: createAnagramsPuzzle,
  Component: Anagrams,
});
