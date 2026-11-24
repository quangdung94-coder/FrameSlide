import { describe, expect, it } from 'vitest';
import {
  BG_STYLE_CODE,
  DEFAULT_BACKGROUND_OPTIONS,
  hexToLinearRgb,
  resolveSceneBackground,
} from './background';
import { SCENE_TRANSITION_FRAGMENT_SHADER } from './shaders/sceneTransitionShader';

describe('scene background', () => {
  it('uses the scene override first, then the project setting, then defaults', () => {
    expect(resolveSceneBackground(undefined, undefined)).toEqual({
      ...DEFAULT_BACKGROUND_OPTIONS,
      style: 'blur',
    });
    const project = resolveSceneBackground(
      { backgroundStyle: 'gradient', backgroundOptions: { ...DEFAULT_BACKGROUND_OPTIONS, angleDeg: 45 } },
      {}
    );
    expect(project.style).toBe('gradient');
    expect(project.angleDeg).toBe(45);
    const own = resolveSceneBackground(
      { backgroundStyle: 'gradient' },
      { background: { ...DEFAULT_BACKGROUND_OPTIONS, style: 'solid', color1: '#ff0000' } }
    );
    expect(own.style).toBe('solid');
    expect(own.color1).toBe('#ff0000');
  });

  it('converts sRGB hex to linear light', () => {
    expect(hexToLinearRgb('#ffffff')).toEqual([1, 1, 1]);
    expect(hexToLinearRgb('#000')).toEqual([0, 0, 0]);
    const [r] = hexToLinearRgb('#808080');
    expect(r).toBeCloseTo(0.2159, 3);
    expect(hexToLinearRgb('not a colour')).toEqual([0, 0, 0]);
  });

  it('every style code is handled by the shader', () => {
    for (const code of Object.values(BG_STYLE_CODE)) {
      if (code === 0) continue; // blur is the fallback branch
      expect(SCENE_TRANSITION_FRAGMENT_SHADER).toContain(`bgStyle == ${code}`);
    }
  });
});
