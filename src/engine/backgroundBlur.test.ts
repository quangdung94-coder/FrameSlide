import { describe, expect, it } from 'vitest';
import { blurCacheKey, blurRecipe, blurShaderParams, resolveBlurSettings } from './backgroundBlur';

describe('background blur settings', () => {
  it('defaults reproduce the original dim, zoomed blur', () => {
    const b = resolveBlurSettings(undefined);
    expect(b).toEqual({ kind: 'smooth', amount: 60, darkness: 80, zoom: 118 });
    const p = blurShaderParams(b);
    expect(p.brightness).toBeCloseTo(0.24);
    expect(p.zoom).toBeCloseTo(1.18);
    expect(p.vignette).toBe(0);
  });

  it('clamps and rejects unknown kinds', () => {
    const b = resolveBlurSettings({ blurKind: 'swirl' as never, blurAmount: 300, blurDarkness: -5, blurZoom: 90 });
    expect(b).toEqual({ kind: 'smooth', amount: 100, darkness: 0, zoom: 100 });
    expect(blurShaderParams({ ...b, kind: 'vignette' }).vignette).toBeGreaterThan(0);
  });
});

describe('blurRecipe', () => {
  it('no blur at 0, stronger with the amount', () => {
    expect(blurRecipe('smooth', 0).filterPx).toBe(0);
    expect(blurRecipe('smooth', 80).filterPx).toBeGreaterThan(blurRecipe('smooth', 40).filterPx);
  });

  it('zoom and motion streaks average many passes evenly', () => {
    for (const kind of ['zoom', 'motion'] as const) {
      const r = blurRecipe(kind, 60);
      expect(r.passes.length).toBeGreaterThan(4);
      expect(r.passes[0].alpha).toBe(1);
      expect(r.passes[3].alpha).toBeCloseTo(1 / 4);
    }
    const zoom = blurRecipe('zoom', 60).passes;
    expect(zoom[zoom.length - 1].scale).toBeGreaterThan(1);
    const motion = blurRecipe('motion', 60).passes;
    expect(motion[0].dx).toBeCloseTo(-motion[motion.length - 1].dx);
  });

  it('frosted glass adds grain; recipes are deterministic', () => {
    expect(blurRecipe('frosted', 50).noise).toBeGreaterThan(0);
    expect(blurRecipe('zoom', 33)).toEqual(blurRecipe('zoom', 33));
  });

  it('vignette shares the smooth blurred copy', () => {
    expect(blurCacheKey('a.jpg', 'vignette', 60)).toBe(blurCacheKey('a.jpg', 'smooth', 60));
    expect(blurCacheKey('a.jpg', 'zoom', 60)).not.toBe(blurCacheKey('a.jpg', 'smooth', 60));
  });
});
