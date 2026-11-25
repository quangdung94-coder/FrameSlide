import { describe, expect, it } from 'vitest';
import { FILM_LOOK_PRESETS } from './presets/filmLookPresets';
import { LAYOUT_PREVIEW_CELLS, lookPreviewStyle } from './presetPreview';
import { LAYOUT_SLOT_COUNTS } from './sceneBuilder';

describe('presetPreview', () => {
  it('Clean look has no filter or overlays', () => {
    const clean = FILM_LOOK_PRESETS.find((p) => p.id === 'clean')!;
    expect(lookPreviewStyle(clean.params)).toMatchObject({ filter: 'none', grain: 0, vignette: 0 });
  });

  it('every look gives finite, bounded values', () => {
    for (const p of FILM_LOOK_PRESETS) {
      const s = lookPreviewStyle(p.params);
      expect(s.filter).not.toMatch(/NaN|Infinity/);
      for (const v of [s.vignette, s.grain, s.glow, s.fade]) expect(v).toBeGreaterThanOrEqual(0);
      expect(s.grain).toBeLessThanOrEqual(0.5);
    }
  });

  it('layout cells match slot counts and stay inside the frame', () => {
    for (const [layout, cells] of Object.entries(LAYOUT_PREVIEW_CELLS)) {
      expect(cells.length).toBe(LAYOUT_SLOT_COUNTS[layout as keyof typeof LAYOUT_SLOT_COUNTS]);
      for (const [x, y, w, h] of cells) {
        expect(x + w).toBeLessThanOrEqual(1);
        expect(y + h).toBeLessThanOrEqual(1);
      }
    }
  });
});
