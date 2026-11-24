import { describe, expect, it } from 'vitest';
import { clampLayout, DEFAULT_LAYOUT, LAYOUT_LIMITS, useLayoutStore } from './useLayoutStore';

describe('layout prefs', () => {
  it('clamps sizes to sane limits and rejects NaN', () => {
    expect(clampLayout('binWidth', 10)).toBe(LAYOUT_LIMITS.binWidth[0]);
    expect(clampLayout('inspectorWidth', 9999)).toBe(LAYOUT_LIMITS.inspectorWidth[1]);
    expect(clampLayout('sceneZoom', Number.NaN)).toBe(DEFAULT_LAYOUT.sceneZoom);
  });

  it('sets and resets the layout', () => {
    useLayoutStore.getState().setLayout('timelineHeight', 420);
    useLayoutStore.getState().setLayout('sceneZoom', 5);
    expect(useLayoutStore.getState().timelineHeight).toBe(420);
    expect(useLayoutStore.getState().sceneZoom).toBe(LAYOUT_LIMITS.sceneZoom[1]);
    useLayoutStore.getState().resetLayout();
    expect(useLayoutStore.getState().timelineHeight).toBe(DEFAULT_LAYOUT.timelineHeight);
  });
});
