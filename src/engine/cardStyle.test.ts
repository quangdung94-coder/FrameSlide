import { describe, expect, it } from 'vitest';
import { cardStyleToUniform, isNeutralCardStyle, normalizeCardStyle } from './cardStyle';

describe('scene card style', () => {
  it('missing values equal today\'s look (square, normal shadow, normal border, hard edge)', () => {
    expect(cardStyleToUniform(undefined)).toEqual([0, 1, 1, 0]);
    expect(isNeutralCardStyle({})).toBe(true);
    expect(isNeutralCardStyle({ corner: 0.3 })).toBe(false);
  });
  it('clamps to safe ranges', () => {
    expect(normalizeCardStyle({ corner: 5, shadow: -1, border: 9, feather: NaN })).toEqual({
      corner: 1,
      shadow: 0,
      border: 3,
      feather: 0,
    });
  });
});
