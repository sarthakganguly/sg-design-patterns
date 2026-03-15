import { describe, it, expect } from 'vitest';
import { PRNG } from '../packages/core/src/math/RNG';

describe('Deterministic Generation', () => {
  it('should produce identical sequences for the same seed', () => {
    const seed = 'test-seed-123';
    const rng1 = new PRNG(seed);
    const rng2 = new PRNG(seed);

    for (let i = 0; i < 100; i++) {
      expect(rng1.random()).toBe(rng2.random());
    }
  });
});