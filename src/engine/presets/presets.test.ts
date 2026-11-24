import { describe, expect, it } from 'vitest';
import { FILM_LOOK_PRESETS, getFilmLookPreset } from './filmLookPresets';
import { MOTION_TEMPLATE_PRESETS } from './motionTemplates';
import { TRANSITION_PRESETS } from './transitions';

describe('Step 5+ presets catalog integrity', () => {
  it('provides 20 transitions (including 4 3D transitions) with unique shader codes 0..19', () => {
    expect(TRANSITION_PRESETS).toHaveLength(20);
    const codes = new Set(TRANSITION_PRESETS.map((t) => t.shaderCode));
    expect(codes.size).toBe(20);
  });

  it('provides Clean mode + 12 distinct Film Look presets', () => {
    expect(FILM_LOOK_PRESETS).toHaveLength(13);
    expect(getFilmLookPreset('clean').enabled).toBe(false);
    expect(getFilmLookPreset('classic-bw').saturation).toBe(0);
    expect(getFilmLookPreset('vhs-90s').scanlines).toBeGreaterThan(0);
    expect(getFilmLookPreset('film-projector').sprockets).toBe(true);
  });

  it('provides 7 distinct Motion Templates (including 2 3D templates) referencing valid Film Looks & Transitions', () => {
    expect(MOTION_TEMPLATE_PRESETS).toHaveLength(7);
    const lookIds = new Set(FILM_LOOK_PRESETS.map((l) => l.id));
    const transIds = new Set(TRANSITION_PRESETS.map((t) => t.id));
    for (const tpl of MOTION_TEMPLATE_PRESETS) {
      expect(lookIds.has(tpl.recommendedLook)).toBe(true);
      expect(transIds.has(tpl.recommendedTransition)).toBe(true);
    }
  });
});
