import { describe, expect, it } from 'vitest';
import { clamp, clampOr, finiteOr, isNearDefaults, normalizeByLimits } from './num';

describe('num helpers', () => {
  it('clamp / finiteOr / clampOr', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(finiteOr(NaN, 3)).toBe(3);
    expect(finiteOr('2', 3)).toBe(3);
    expect(clampOr(9, 1, [0, 2])).toBe(2);
    expect(clampOr(undefined, 1, [0, 2])).toBe(1);
  });

  it('normalizeByLimits fills defaults and clamps', () => {
    const defaults = { a: 1, b: 0 };
    const limits = { a: [0, 2], b: [-1, 1] } as const;
    expect(normalizeByLimits({ a: 5 }, defaults, limits)).toEqual({ a: 2, b: 0 });
    expect(normalizeByLimits(null, defaults, limits)).toEqual(defaults);
    expect(isNearDefaults({ a: 1.00001, b: 0 }, defaults)).toBe(true);
    expect(isNearDefaults({ a: 1.1, b: 0 }, defaults)).toBe(false);
  });
});
