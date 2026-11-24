import { describe, expect, it } from 'vitest';
import { isIdentityTransform, normalizePhotoTransform, PHOTO_TRANSFORM_LIMITS } from './photoTransform';
import { SCENE_TRANSITION_FRAGMENT_SHADER } from './shaders/sceneTransitionShader';

describe('photo transform', () => {
  it('clamps values, wraps rotation and treats missing data as identity', () => {
    expect(normalizePhotoTransform(undefined)).toEqual({ x: 0, y: 0, scale: 1, rotationDeg: 0 });
    const n = normalizePhotoTransform({ x: 5, y: -5, scale: 99, rotationDeg: 270 });
    expect(n.x).toBe(PHOTO_TRANSFORM_LIMITS.offset);
    expect(n.y).toBe(-PHOTO_TRANSFORM_LIMITS.offset);
    expect(n.scale).toBe(PHOTO_TRANSFORM_LIMITS.scaleMax);
    expect(n.rotationDeg).toBe(-90);
    expect(normalizePhotoTransform({ scale: Number.NaN }).scale).toBe(1);
    expect(isIdentityTransform({ x: 0, y: 0, scale: 1, rotationDeg: 360 })).toBe(true);
    expect(isIdentityTransform({ x: 0.1, y: 0, scale: 1, rotationDeg: 0 })).toBe(false);
  });

  it('is applied in both the full-frame and the card paths of the shader', () => {
    const calls = SCENE_TRANSITION_FRAGMENT_SHADER.match(/applyUserXf\(/g) ?? [];
    expect(calls.length).toBe(3); // definition + 2 call sites
  });
});
