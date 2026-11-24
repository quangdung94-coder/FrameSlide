import { describe, expect, it } from 'vitest';
import { isIdentityPhotoAdjust, normalizePhotoAdjust, photoAdjustToUniform } from './photoAdjust';

describe('photo colour adjustments', () => {
  it('missing values are neutral and ranges are clamped', () => {
    expect(photoAdjustToUniform(undefined)).toEqual([1, 1, 0, 1]);
    expect(normalizePhotoAdjust({ contrast: 9, saturation: -3, warmth: 5, opacity: 2 })).toEqual({
      contrast: 1.6,
      saturation: 0,
      warmth: 1,
      opacity: 1,
    });
    expect(normalizePhotoAdjust({ contrast: NaN }).contrast).toBe(1);
  });

  it('detects the identity', () => {
    expect(isIdentityPhotoAdjust({})).toBe(true);
    expect(isIdentityPhotoAdjust({ contrast: 1, opacity: 1 })).toBe(true);
    expect(isIdentityPhotoAdjust({ warmth: 0.2 })).toBe(false);
  });
});
