/**
 * Builds the word lists for the Anagrams game. Run once; the output is
 * committed so the app doesn't depend on this package at runtime:
 *
 *   node scripts/build-anagram-words.mjs
 *
 * Source: SCOWL via `wordlist-english` (MIT). Size 50 and below = words a
 * typical person knows, which keeps obscure "dictionary words" out.
 *
 *   words.txt : every accepted word, 3-6 letters
 *   bases.txt : very common 6-letter words (size <= 20) whose letters make
 *               at least 15 accepted words, so every round has plenty to find
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

const wl = createRequire(import.meta.url)("wordlist-english");
const tiers = (max) =>
  Object.keys(wl).filter((k) => /^english\/(american\/)?\d+$/.test(k) && Number(k.split("/").pop()) <= max);
const collect = (max) => {
  const set = new Set();
  for (const k of tiers(max)) for (const w of wl[k]) if (/^[a-z]{3,6}$/.test(w)) set.add(w);
  return set;
};

const all = collect(50);
const counts = (w) => {
  const c = new Array(26).fill(0);
  for (const ch of w) c[ch.charCodeAt(0) - 97]++;
  return c;
};
const fits = (word, pool) => counts(word).every((n, i) => n <= pool[i]);

const words = [...all].sort();
const bases = [...collect(20)]
  .filter((w) => w.length === 6)
  .filter((w) => {
    const pool = counts(w);
    return words.filter((x) => fits(x, pool)).length >= 15;
  })
  .sort();

const out = new URL("../src/games/anagrams/", import.meta.url);
writeFileSync(new URL("words.txt", out), words.join(" "));
writeFileSync(new URL("bases.txt", out), bases.join(" "));
console.log(`${words.length} words, ${bases.length} bases`);
