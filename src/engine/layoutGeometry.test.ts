import { describe, expect, it } from 'vitest';
import { getLayoutRects } from './layoutGeometry';
import { LAYOUT_SLOT_COUNTS } from './sceneBuilder';
import type { SceneLayoutId } from '@shared/types';

describe('getLayoutRects', () => {
  it('returns one rect per slot, inside the frame, without overlaps', () => {
    for (const aspect of [16 / 9, 1, 9 / 16]) {
      for (const layout of Object.keys(LAYOUT_SLOT_COUNTS) as SceneLayoutId[]) {
        const rects = getLayoutRects(layout, aspect);
        expect(rects).toHaveLength(LAYOUT_SLOT_COUNTS[layout]);
        for (const r of rects) {
          expect(r.x).toBeGreaterThanOrEqual(-1e-6);
          expect(r.y).toBeGreaterThanOrEqual(-1e-6);
          expect(r.x + r.w).toBeLessThanOrEqual(1 + 1e-6);
          expect(r.y + r.h).toBeLessThanOrEqual(1 + 1e-6);
        }
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            const a = rects[i];
            const b = rects[j];
            const overlap =
              a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;
            expect(overlap).toBe(false);
          }
        }
      }
    }
  });

  it('places diptych side by side and mosaic as a 2x2 grid in reading order', () => {
    const [l, r] = getLayoutRects('diptych', 16 / 9);
    expect(l.x).toBeLessThan(r.x);
    expect(l.y).toBeCloseTo(r.y);
    const m = getLayoutRects('mosaic4', 16 / 9);
    expect(m[0].y).toBeCloseTo(m[1].y);
    expect(m[0].y).toBeLessThan(m[2].y);
    expect(m[0].x).toBeLessThan(m[1].x);
  });
});
