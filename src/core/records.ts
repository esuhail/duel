/**
 * Personal bests, kept on this device (localStorage), per player name.
 * Several people can share one device: each name has its own records.
 */
import type { Better } from "./match";

export interface Best {
  score: number;
  /** ms since epoch */
  at: number;
}
type Store = Record<string, { name: string; games: Record<string, Best> }>;

const KEY = "duel:records";
const norm = (name: string) => name.trim().toLowerCase() || "player";

export const isBetter = (better: Better, a: number, b: number) => (better === "higher" ? a > b : a < b);

export class Records {
  constructor(private readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = localStorage) {}

  private load(): Store {
    try {
      return JSON.parse(this.storage.getItem(KEY) ?? "{}") as Store;
    } catch {
      return {}; // corrupted storage shouldn't break the game
    }
  }

  /** Saves the score if it beats this player's best. Returns whether it did. */
  record(name: string, gameId: string, better: Better, score: number, now = Date.now()): { isBest: boolean; previous?: number } {
    const store = this.load();
    const entry = store[norm(name)] ?? { name: name.trim() || "Player", games: {} };
    const prev = entry.games[gameId];
    if (prev && !isBetter(better, score, prev.score)) return { isBest: false, previous: prev.score };
    entry.games[gameId] = { score, at: now };
    store[norm(name)] = entry;
    this.storage.setItem(KEY, JSON.stringify(store));
    return { isBest: true, previous: prev?.score };
  }

  bests(name: string): Record<string, Best> {
    return this.load()[norm(name)]?.games ?? {};
  }

  clear(name: string) {
    const store = this.load();
    delete store[norm(name)];
    this.storage.setItem(KEY, JSON.stringify(store));
  }
}
