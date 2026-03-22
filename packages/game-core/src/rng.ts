/**
 * Simple seedable PRNG (mulberry32).
 * Deterministic — same seed always produces same sequence.
 */
export function createRng(seed: number) {
  let state = seed | 0;

  function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Random integer in [min, max] inclusive */
  function int(min: number, max: number): number {
    return min + Math.floor(next() * (max - min + 1));
  }

  /** Shuffle array in place (Fisher-Yates) */
  function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = int(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Get current seed state for serialization */
  function getSeed(): number {
    return state;
  }

  return { next, int, shuffle, getSeed };
}

export type Rng = ReturnType<typeof createRng>;
