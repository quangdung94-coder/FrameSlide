import { describe, expect, it } from 'vitest';
import { createEmptyScene } from './sceneBuilder';
import { applySceneStyle, BUILT_IN_SCENE_STYLES, sceneStyleFromScene } from './sceneStyles';

describe('scene styles', () => {
  it('a saved style never carries the caption text, and applying keeps photos and text', () => {
    const src = { ...createEmptyScene('diptych', 6), caption: 'Lời', stagger: { style: 'zoom' as const }, captionTiming: { inSec: 1 } };
    const style = sceneStyleFromScene(src, '  Của tôi ', 'u1');
    expect(style.name).toBe('Của tôi');
    expect(style.settings.caption).toBeUndefined();

    const target = { ...createEmptyScene('single'), slots: ['p1'], caption: 'Giữ nguyên' };
    const out = applySceneStyle(target, style);
    expect(out.layout).toBe('diptych');
    expect(out.slots).toEqual(['p1', null]);
    expect(out.durationSec).toBe(6);
    expect(out.stagger?.style).toBe('zoom');
    expect(out.captionTiming).toEqual({ inSec: 1 });
    expect(out.caption).toBe('Giữ nguyên');
    expect(out.id).toBe(target.id);
  });

  it('built-in styles cover opening, ending, couple and grid', () => {
    expect(BUILT_IN_SCENE_STYLES.map((s) => s.name)).toEqual(['Mở đầu', 'Kết thúc', 'Chân dung đôi', 'Lưới kỷ niệm']);
    const grid = applySceneStyle(createEmptyScene('single'), BUILT_IN_SCENE_STYLES[3]);
    expect(grid.slots.length).toBe(4);
    expect(grid.background?.style).toBe('paper');
  });
});
