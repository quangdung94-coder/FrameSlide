import { describe, expect, it } from 'vitest';
import { isManualMotion, LAYOUT_MOTION_AFFINITY, planAutoMotion, type AutoMotionScene } from './autoMotion';

const scenes = (layouts: AutoMotionScene['layout'][]): AutoMotionScene[] => layouts.map((layout) => ({ layout }));
const noRepeats = (list: (string | null)[]) => list.every((v, i) => i === 0 || v === null || v !== list[i - 1]);

describe('planAutoMotion', () => {
  it('cycle: walks through templates, neighbours differ', () => {
    const r = planAutoMotion(scenes(Array(10).fill('single')), { mode: 'cycle' });
    expect(r).toHaveLength(10);
    expect(new Set(r).size).toBe(7);
    expect(noRepeats(r)).toBe(true);
  });

  it('random: same seed gives the same result, other seed differs, neighbours differ', () => {
    const list = scenes(Array(30).fill('diptych'));
    const a = planAutoMotion(list, { mode: 'random', seed: 42 });
    const b = planAutoMotion(list, { mode: 'random', seed: 42 });
    const c = planAutoMotion(list, { mode: 'random', seed: 7 });
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(noRepeats(a)).toBe(true);
  });

  it('by-layout: picks templates that suit each layout', () => {
    const list = scenes(['single', 'mosaic4', 'triptych', 'diptych', 'single', 'single']);
    const r = planAutoMotion(list, { mode: 'by-layout' });
    r.forEach((id, i) => expect(LAYOUT_MOTION_AFFINITY[list[i].layout]).toContain(id));
    expect(noRepeats(r)).toBe(true);
    expect(r[0]).toBe('ken-burns-classic');
    expect(r[1]).toBe('minimal-mosaic');
  });

  it('keeps hand-picked templates and avoids repeating them next door', () => {
    const list: AutoMotionScene[] = [
      { layout: 'single', motionTemplate: 'ken-burns-classic' },
      { layout: 'single' },
      { layout: 'single', motionTemplate: 'wall-3d', motionAuto: true },
    ];
    const r = planAutoMotion(list, { mode: 'by-layout' });
    expect(r[0]).toBeNull();
    expect(r[1]).not.toBe('ken-burns-classic');
    expect(r[2]).not.toBeNull();
    expect(isManualMotion(list[0])).toBe(true);
    expect(isManualMotion(list[2])).toBe(false);
  });

  it('uses the given pool only', () => {
    const r = planAutoMotion(scenes(['single', 'single', 'single']), {
      mode: 'cycle',
      pool: ['polaroid-memories', 'wall-3d'],
    });
    expect(r).toEqual(['polaroid-memories', 'wall-3d', 'polaroid-memories']);
  });
});
