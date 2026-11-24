import { describe, expect, it } from 'vitest';
import {
  computeEffectiveTotalDurationSec,
  evaluateTimeline,
  getTotalFrames,
  resolveSlideDurations,
} from './timeline';

describe('timeline evaluator', () => {
  it('computes total frames accurately', () => {
    expect(getTotalFrames(15, 30)).toBe(450);
    expect(getTotalFrames(15, 24)).toBe(360);
  });

  it('evaluates slide index and transition window deterministically', () => {
    const midSlide = evaluateTimeline({
      frameIndex: 60,
      fps: 30,
      slideCount: 3,
      totalDurationSec: 15,
      transitionDurationSec: 0.8,
      simulate18fps: false,
    });
    expect(midSlide.slideAIndex).toBe(0);
    expect(midSlide.isInTransition).toBe(false);
    expect(midSlide.slideAProgress).toBeCloseTo(0.4, 3);

    const midTransition = evaluateTimeline({
      frameIndex: 138,
      fps: 30,
      slideCount: 3,
      totalDurationSec: 15,
      transitionDurationSec: 0.8,
      simulate18fps: false,
    });
    expect(midTransition.slideAIndex).toBe(0);
    expect(midTransition.slideBIndex).toBe(1);
    expect(midTransition.isInTransition).toBe(true);
    expect(midTransition.transitionProgress).toBeCloseTo(0.5, 2);
  });

  it('quantizes effectiveFrameIndex when simulate18fps is enabled', () => {
    const a = evaluateTimeline({
      frameIndex: 30,
      fps: 30,
      slideCount: 3,
      totalDurationSec: 15,
      transitionDurationSec: 0.8,
      simulate18fps: true,
    });
    const b = evaluateTimeline({
      frameIndex: 31,
      fps: 30,
      slideCount: 3,
      totalDurationSec: 15,
      transitionDurationSec: 0.8,
      simulate18fps: true,
    });
    expect(a.effectiveFrameIndex).toBe(18);
    expect(b.effectiveFrameIndex).toBe(18);
    expect(a.timeSec).toBe(b.timeSec);
  });

  it('supports per-slide custom durations and editorial head/tail handles', () => {
    const durations = resolveSlideDurations(3, {
      durationMode: 'per-slide',
      totalDurationSec: 15,
      defaultSlideDurationSec: 3,
      slideDurations: [2, undefined, 4],
      handlesSec: 0.5,
    });
    expect(durations).toEqual([2.5, 3, 4.5]);
    expect(
      computeEffectiveTotalDurationSec(3, {
        durationMode: 'per-slide',
        totalDurationSec: 15,
        defaultSlideDurationSec: 3,
        slideDurations: [2, undefined, 4],
        handlesSec: 0.5,
      })
    ).toBe(10);
  });
});
