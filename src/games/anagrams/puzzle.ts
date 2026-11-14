import { Rng } from "../../core/rng";
import BASES_RAW from "./bases.txt?raw";
import WORDS_RAW from "./words.txt?raw";

/** Every accepted word (3-6 letters). Built by scripts/build-anagram-words.mjs. */
export const DICT: ReadonlySet<string> = new Set(WORDS_RAW.split(" "));
const BASES = BASES_RAW.split(" ");

/** GamePigeon-style scoring: long words are worth far more than short ones. */
export const POINTS: Record<number, number> = { 3: 100, 4: 400, 5: 1200, 6: 2000 };
export const MIN_LEN = 3;

export interface AnagramsPuzzle {
  /** The 6 letters, shuffled. */
  letters: string[];
  /** Every accepted word these letters can make, longest first. */
  answers: string[];
}

const counts = (w: string) => {
  const c = new Array<number>(26).fill(0);
  for (const ch of w) c[ch.charCodeAt(0) - 97]!++;
  return c;
};

/** Can `word` be spelled from `letters`, using each tile at most once? */
export function canSpell(word: string, letters: readonly string[]): boolean {
  const pool = counts(letters.join(""));
  return counts(word).every((n, i) => n <= pool[i]!);
}

export function createAnagramsPuzzle(seed: number): AnagramsPuzzle {
  const rng = new Rng(seed);
  const base = rng.pick(BASES);
  let letters: string[];
  do letters = rng.shuffle([...base]);
  while (letters.join("") === base);
  const answers = [...DICT].filter((w) => canSpell(w, letters)).sort((a, b) => b.length - a.length || a.localeCompare(b));
  return { letters, answers };
}

export type Verdict = { ok: true; points: number } | { ok: false; reason: "short" | "used" | "unknown" | "letters" };

export function judge(word: string, puzzle: AnagramsPuzzle, found: ReadonlySet<string>): Verdict {
  if (word.length < MIN_LEN) return { ok: false, reason: "short" };
  if (!canSpell(word, puzzle.letters)) return { ok: false, reason: "letters" };
  if (found.has(word)) return { ok: false, reason: "used" };
  if (!DICT.has(word)) return { ok: false, reason: "unknown" };
  return { ok: true, points: POINTS[word.length]! };
}
