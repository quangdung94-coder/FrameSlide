import { describe, expect, it } from 'vitest';
import { applySceneSettings, copySceneSettings, SCENE_SETTING_PARTS } from './sceneSettings';
import { createEmptyScene } from './sceneBuilder';

describe('scene settings copy/paste', () => {
  const src = {
    ...createEmptyScene('diptych', 5, 'dip-black'),
    motionDirection: 'zoom-out' as const,
    caption: 'Lễ cưới',
    background: {
      style: 'solid' as const,
      color1: '#102030',
      color2: '#000000',
      angleDeg: 0,
      pattern: 'dots' as const,
    },
  };

  it('pastes only the chosen parts and keeps the target photos', () => {
    const target = { ...createEmptyScene('single', 3, 'film-dissolve'), slots: ['A'] };
    const out = applySceneSettings(target, copySceneSettings(src), ['transition', 'motion']);
    expect(out.transitionType).toBe('dip-black');
    expect(out.motionDirection).toBe('zoom-out');
    expect(out.durationSec).toBe(3);
    expect(out.layout).toBe('single');
    expect(out.slots).toEqual(['A']);
    expect(out.id).toBe(target.id);
    expect(target.transitionType).toBe('film-dissolve'); // input not mutated
  });

  it('resizes slots on layout paste without losing existing photos', () => {
    const target = { ...createEmptyScene('single', 3), slots: ['A'] };
    const out = applySceneSettings(target, copySceneSettings(src), ['layout']);
    expect(out.layout).toBe('diptych');
    expect(out.slots).toEqual(['A', null]);
  });

  it('pastes everything, and the copy is independent from the source', () => {
    const target = createEmptyScene('single', 3);
    const snap = copySceneSettings(src);
    const out = applySceneSettings(target, snap, SCENE_SETTING_PARTS.map((p) => p.id));
    expect(out.background?.color1).toBe('#102030');
    expect(out.background).not.toBe(src.background);
    expect(out.caption).toBe('Lễ cưới');
    expect(out.durationSec).toBe(5);
  });
});
