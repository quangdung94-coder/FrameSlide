import { describe, expect, it } from 'vitest';
import {
  computeSlotFrameUniform,
  getEffectiveSlotFrameRect,
  hasCustomSingleFrame,
  resolveCardFitMode,
} from './slotFrame';

describe('slotFrame', () => {
  it('defaults to fit mode and narrows portrait photos in mosaic4 so top & bottom are not cropped', () => {
    expect(resolveCardFitMode(null, null)).toBe('fit');

    const [dx, dyUp, scaleX, scaleY] = computeSlotFrameUniform({
      layout: 'mosaic4',
      slotIdx: 2,
      canvasAspect: 16 / 9,
      photoAspect: 2 / 3, // vertical portrait photo
      fitMode: 'fit',
    });

    expect(dx).toBe(0);
    expect(dyUp).toBe(0);
    expect(scaleY).toBe(1);
    // Portrait aspect (0.667) inside wide mosaic4 box (~1.86) shrinks width proportionally
    expect(scaleX).toBeLessThan(0.45);
    expect(scaleX).toBeGreaterThan(0.3);

    const rect = getEffectiveSlotFrameRect({
      layout: 'mosaic4',
      slotIdx: 2,
      canvasAspect: 16 / 9,
      photoAspect: 2 / 3,
      fitMode: 'fit',
    });
    // Resulting on-screen aspect ratio matches the portrait photo's aspect ratio!
    const onScreenAspect = (rect.w * (16 / 9)) / rect.h;
    expect(onScreenAspect).toBeCloseTo(2 / 3, 2);
  });

  it('keeps uniform box dimensions in cover mode', () => {
    const [, , scaleX, scaleY] = computeSlotFrameUniform({
      layout: 'mosaic4',
      slotIdx: 2,
      canvasAspect: 16 / 9,
      photoAspect: 2 / 3,
      fitMode: 'cover',
    });
    expect(scaleX).toBe(1);
    expect(scaleY).toBe(1);
  });

  it('applies group frameScale, frameGap, and per-slot manual overrides symmetrically', () => {
    const [dx0, , sx0, sy0] = computeSlotFrameUniform({
      layout: 'diptych',
      slotIdx: 0,
      canvasAspect: 16 / 9,
      fitMode: 'cover',
      frameScale: 1.2,
      frameGap: 1.5,
      override: { dx: 0.05, dy: -0.04, scaleX: 1.1, scaleY: 0.9 },
    });
    // Left slot moves further left for gap > 1, then +0.05 right from override; dyUp flips sign
    expect(dx0).toBeLessThan(0.05);
    expect(sx0).toBeCloseTo(1.2 * 1.1, 3);
    expect(sy0).toBeCloseTo(1.2 * 0.9, 3);
  });

  it('detects custom single-scene frames', () => {
    expect(hasCustomSingleFrame({ id: 'a', layout: 'single', durationSec: 3, transitionType: 'film-dissolve', slots: ['p1'] })).toBe(false);
    expect(hasCustomSingleFrame({ id: 'a', layout: 'single', durationSec: 3, transitionType: 'film-dissolve', slots: ['p1'], frameScale: 0.8 })).toBe(true);
    expect(
      hasCustomSingleFrame({
        id: 'a',
        layout: 'single',
        durationSec: 3,
        transitionType: 'film-dissolve',
        slots: ['p1'],
        slotFrames: [{ dx: 0.1, dy: 0, scaleX: 1, scaleY: 1 }],
      })
    ).toBe(true);
  });

  it('matches unframed single 1.0x1.0 base when forceFrame=true and shrinks on forceTilt3d', () => {
    const unframed = getEffectiveSlotFrameRect({
      layout: 'single',
      slotIdx: 0,
      canvasAspect: 16 / 9,
      photoAspect: 1.5,
      fitMode: 'fit',
      forceFrame: true,
      override: { dx: 0, dy: 0, scaleX: 0.8, scaleY: 0.8 },
    });
    expect(unframed.w).toBeCloseTo(0.8, 3);
    expect(unframed.h).toBeCloseTo(0.8, 3);

    const tilt = getEffectiveSlotFrameRect({
      layout: 'single',
      slotIdx: 0,
      canvasAspect: 16 / 9,
      photoAspect: 1.5,
      fitMode: 'fit',
      forceTilt3d: true,
    });
    expect(tilt.h).toBeCloseTo(0.78, 3);
  });
});
