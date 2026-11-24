import { describe, expect, it } from 'vitest';
import { easeKeyframe, hasPhotoKeyframes, resolvePhotoTransform } from './photoKeyframes';

const start = { x: 0, y: 0, scale: 1, rotationDeg: 0 };
const end = { x: 0.2, y: -0.1, scale: 2, rotationDeg: 10 };

describe('photo keyframes', () => {
  it('eases map 0→0 and 1→1 and stay monotonic', () => {
    for (const e of ['linear', 'smooth', 'ease-in', 'ease-out'] as const) {
      expect(easeKeyframe(0, e)).toBe(0);
      expect(easeKeyframe(1, e)).toBe(1);
      let prev = -1;
      for (let i = 0; i <= 20; i++) {
        const v = easeKeyframe(i / 20, e);
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    }
    expect(easeKeyframe(0.5, 'ease-in')).toBeLessThan(0.5);
    expect(easeKeyframe(0.5, 'ease-out')).toBeGreaterThan(0.5);
    expect(easeKeyframe(NaN, 'smooth')).toBe(0);
  });

  it('without an End keyframe the Start transform is static', () => {
    const photo = { transform: { x: 0.1, y: 0, scale: 1.5, rotationDeg: 5 } };
    expect(hasPhotoKeyframes(photo)).toBe(false);
    expect(resolvePhotoTransform(photo, 0)).toEqual(resolvePhotoTransform(photo, 1));
    expect(resolvePhotoTransform(undefined, 0.5)).toEqual(start);
  });

  it('interpolates Start→End (zoom geometrically) and is deterministic', () => {
    const photo = { transform: start, transformEnd: end, keyframeEase: 'linear' as const };
    expect(resolvePhotoTransform(photo, 0)).toEqual(start);
    expect(resolvePhotoTransform(photo, 1)).toEqual(end);
    const mid = resolvePhotoTransform(photo, 0.5);
    expect(mid.x).toBeCloseTo(0.1);
    expect(mid.y).toBeCloseTo(-0.05);
    expect(mid.scale).toBeCloseTo(Math.SQRT2);
    expect(mid.rotationDeg).toBeCloseTo(5);
    expect(resolvePhotoTransform(photo, 0.37)).toEqual(resolvePhotoTransform(photo, 0.37));
  });

  it('preview pins to the Start or End keyframe regardless of progress', () => {
    const photo = { transform: start, transformEnd: end, keyframeEase: 'smooth' as const };
    expect(resolvePhotoTransform(photo, 0.5, 'start')).toEqual(start);
    expect(resolvePhotoTransform(photo, 0.5, 'end')).toEqual(end);
  });
});
