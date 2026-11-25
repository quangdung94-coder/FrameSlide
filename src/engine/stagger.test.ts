import { describe, expect, it } from 'vitest';
import { normalizeStagger, staggerAppear, staggerTotalSec } from './stagger';

describe('stagger', () => {
  it('is off (all visible) without settings or with one photo', () => {
    expect(staggerAppear(undefined, 4, 0)).toEqual([1, 1, 1, 1]);
    expect(staggerAppear({ style: 'fade' }, 1, 0)).toEqual([1, 1, 1, 1]);
  });

  it('photos appear one after another', () => {
    const st = { style: 'slide' as const, delaySec: 0.5, entrySec: 0.5 };
    const at = (t: number) => staggerAppear(st, 3, t);
    expect(at(0)).toEqual([0, 0, 0, 1]);
    expect(at(0.5)[0]).toBe(1);
    expect(at(0.5)[1]).toBe(0);
    expect(at(0.75)[1]).toBeGreaterThan(0);
    expect(at(0.75)[1]).toBeLessThan(1);
    expect(at(1.5)).toEqual([1, 1, 1, 1]);
    expect(staggerTotalSec(st, 3)).toBeCloseTo(1.5);
  });

  it('normalizes bad values', () => {
    expect(normalizeStagger({ style: 'bogus' as never, delaySec: 99, entrySec: -1 })).toEqual({
      style: 'fade',
      delaySec: 1.5,
      entrySec: 0.1,
    });
  });
});
