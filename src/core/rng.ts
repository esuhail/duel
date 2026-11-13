/**
 * Seeded random numbers.
 *
 * Fairness rests on this file: the host sends one 32-bit seed per round and
 * both browsers build the puzzle from it. Math.random() can't be seeded, so we
 * use mulberry32, a tiny, fast 32-bit generator. It is NOT cryptographically
 * secure (a player could predict the puzzle if they read the seed off the wire),
 * but between friends that's fine, and it gives identical output on every JS
 * engine because it only uses 32-bit integer math (Math.imul, >>>).
 */

/** Returns a function producing floats in [0, 1), fully determined by `seed`. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a: turns any string into a 32-bit number. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Mixes several values into one seed, e.g. deriveSeed(matchSeed, "round", 3).
 * Lets us get many independent streams (game order, each round's puzzle)
 * from a single match seed without sending more data over the network.
 */
export function deriveSeed(...parts: Array<number | string>): number {
  return hashString(parts.join("|"));
}

/** A fresh unpredictable seed. Only the host calls this. */
export function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]!;
}

/** Convenience wrapper with the helpers games actually need. */
export class Rng {
  private readonly nextFloat: () => number;

  constructor(seed: number) {
    this.nextFloat = mulberry32(seed);
  }

  /** Float in [0, 1). */
  next(): number {
    return this.nextFloat();
  }

  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.nextFloat() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("pick() from empty array");
    return items[this.int(0, items.length - 1)]!;
  }

  /** Fisher–Yates shuffle; returns a new array. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }
}
