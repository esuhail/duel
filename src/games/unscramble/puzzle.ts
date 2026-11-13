import { Rng } from "../../core/rng";
import { WORDS } from "./words";

export interface ScrambledWord {
  word: string;
  letters: string[];
}

export const WORD_COUNT = 40;
const sortKey = (w: string) => [...w].sort().join("");
const BY_KEY = new Map<string, Set<string>>();
for (const w of WORDS) {
  const k = sortKey(w);
  if (!BY_KEY.has(k)) BY_KEY.set(k, new Set());
  BY_KEY.get(k)!.add(w);
}

/** Correct if it's any listed word made of the same letters (e.g. "heart" or "earth"). */
export function isSolution(target: string, guess: string): boolean {
  return sortKey(guess) === sortKey(target) && (BY_KEY.get(sortKey(target))?.has(guess) ?? false);
}

export function createUnscramblePuzzle(seed: number): ScrambledWord[] {
  const rng = new Rng(seed);
  return rng.shuffle(WORDS).slice(0, WORD_COUNT).map((word) => {
    let letters: string[];
    // Re-shuffle until the scramble isn't already a valid answer.
    do letters = rng.shuffle([...word]);
    while (isSolution(word, letters.join("")));
    return { word, letters };
  });
}
