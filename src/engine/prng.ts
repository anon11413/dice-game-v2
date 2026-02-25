/**
 * Seeded pseudo-random number generator — xoshiro128** (Blackman & Vigna, 2018).
 *
 * 128-bit state (4 × 32-bit integers), period 2^128 − 1 ≈ 3.4 × 10^38.
 * Uses only 32-bit operations (shifts, XOR, rotations) — fast in JS, no BigInt.
 * Passes BigCrush and PractRand statistical test suites.
 *
 * Seeded via SplitMix32: a single 32-bit seed is expanded into the 4-word state.
 * All engine randomness flows through this single instance.
 *
 * Replaces Mulberry32 (32-bit state, period 2^32 ≈ 4.3 billion) which exhausted
 * its period ~20× during a 75-year simulation run (88.4 billion PRNG calls).
 */

/** 32-bit left rotation */
function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) | 0;
}

/** SplitMix32 — expands a single seed into independent 32-bit state words */
function splitmix32(seed: number): () => number {
  let z = seed | 0;
  return () => {
    z = (z + 0x9e3779b9) | 0;
    let t = z ^ (z >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    t = t ^ (t >>> 15);
    return t >>> 0;
  };
}

export class PRNG {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(seed: number) {
    // Expand single seed into 4 × 32-bit state via SplitMix32
    const sm = splitmix32(seed);
    this.s0 = sm();
    this.s1 = sm();
    this.s2 = sm();
    this.s3 = sm();

    // Guard against all-zero state (period degenerates to 0)
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) {
      this.s0 = 1;
    }
  }

  /** Returns a float in [0, 1) */
  next(): number {
    // xoshiro128** scrambler: rotl(s1 * 5, 7) * 9
    const result = (Math.imul(rotl(Math.imul(this.s1, 5), 7), 9)) >>> 0;

    // State update
    const t = this.s1 << 9;

    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;

    this.s2 ^= t;
    this.s3 = rotl(this.s3, 11);

    return result / 4294967296;  // [0, 1)
  }

  /** Returns an integer in [min, max] inclusive */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Returns a float in [min, max) */
  uniform(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Fisher-Yates shuffle (in-place) */
  shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
  }
}
