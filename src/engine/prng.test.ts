import { describe, expect, it } from 'vitest';
import { frameTimeSeconds, hashFrameSeed } from './prng';

describe('deterministic frame utilities', () => {
  it('produces identical pseudo-random values for the same frameIndex', () => {
    const a = hashFrameSeed(120, 7);
    const b = hashFrameSeed(120, 7);
    const c = hashFrameSeed(121, 7);

    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
  });

  it('computes exact frame timestamp in seconds', () => {
    expect(frameTimeSeconds(24, 24)).toBe(1);
    expect(frameTimeSeconds(15, 30)).toBe(0.5);
    expect(() => frameTimeSeconds(10, 0)).toThrow();
  });
});
