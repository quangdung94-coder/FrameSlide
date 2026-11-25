import { describe, expect, it } from 'vitest';
import { fitSceneZoom, wheelZoom } from './sceneTrackFit';

const base = {
  areaWidth: 1200,
  areaHeight: 400,
  itemWidth: 232 + 100,
  itemHeight: 120 + 80,
  measuredZoom: 1,
  cardWidthPerZoom: 232,
  miniHeightPerZoom: 120,
  gap: 6,
  minZoom: 0.6,
  maxZoom: 1.8,
};

describe('fitSceneZoom', () => {
  it('few scenes fit at a large zoom', () => {
    expect(fitSceneZoom({ ...base, sceneCount: 2 })).toBeGreaterThanOrEqual(1.5);
  });
  it('more scenes need a smaller zoom, never below the minimum', () => {
    const z10 = fitSceneZoom({ ...base, sceneCount: 10 });
    const z40 = fitSceneZoom({ ...base, sceneCount: 40 });
    expect(z10).toBeLessThan(fitSceneZoom({ ...base, sceneCount: 2 }));
    expect(z40).toBeLessThanOrEqual(z10);
    expect(z40).toBeGreaterThanOrEqual(0.6);
  });
  it('the chosen zoom really fits', () => {
    const z = fitSceneZoom({ ...base, sceneCount: 6 });
    expect(z).toBeGreaterThan(0.6);
    const w = 100 + 232 * z;
    const h = 80 + 120 * z;
    const cols = Math.floor((1200 + 6) / (w + 6));
    const rows = Math.ceil(6 / cols);
    expect(rows * h + (rows - 1) * 6).toBeLessThanOrEqual(400);
    // One step larger would not fit.
    const w2 = 100 + 232 * (z + 0.05);
    const cols2 = Math.floor((1200 + 6) / (w2 + 6));
    const rows2 = Math.ceil(6 / cols2);
    expect(rows2 * (80 + 120 * (z + 0.05)) + (rows2 - 1) * 6).toBeGreaterThan(400);
  });
  it('falls back to the minimum when nothing fits', () => {
    expect(fitSceneZoom({ ...base, sceneCount: 200 })).toBe(0.6);
  });
});

describe('wheelZoom', () => {
  it('wheel up zooms in, down zooms out, within limits', () => {
    expect(wheelZoom(1, -100, 0.6, 1.8)).toBe(1.1);
    expect(wheelZoom(1, 100, 0.6, 1.8)).toBe(0.9);
    expect(wheelZoom(1.8, -1, 0.6, 1.8)).toBe(1.8);
    expect(wheelZoom(0.6, 1, 0.6, 1.8)).toBe(0.6);
  });
});
