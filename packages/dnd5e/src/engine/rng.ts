/**
 * Random number generation interface and implementations.
 *
 * Abstracting RNG allows for deterministic testing and custom dice.
 */

/**
 * Random number generator interface.
 */
export interface RNG {
  /**
   * Generate a random integer in the range [min, max] (inclusive).
   */
  rollInt(min: number, max: number): number;
}

/**
 * Default RNG using Math.random().
 */
export const defaultRNG: RNG = {
  rollInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
};

/**
 * Create a seeded RNG for deterministic testing.
 * Uses a simple linear congruential generator.
 */
export function createSeededRNG(seed: number): RNG {
  let state = seed;

  return {
    rollInt(min: number, max: number): number {
      // LCG parameters (same as glibc)
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      const normalized = state / 0x7fffffff;
      return Math.floor(normalized * (max - min + 1)) + min;
    },
  };
}

/**
 * Create a mock RNG that returns predetermined values.
 * Useful for testing specific scenarios.
 */
export function createMockRNG(values: number[]): RNG {
  let index = 0;

  return {
    rollInt(_min: number, _max: number): number {
      if (index >= values.length) {
        throw new Error('Mock RNG exhausted');
      }
      return values[index++]!;
    },
  };
}
