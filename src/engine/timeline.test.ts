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

  it('keeps slide motion continuous when the incoming slide becomes the main slide', () => {
    const base = {
      fps: 30,
      slideCount: 3,
      totalDurationSec: 15,
      transitionDurationSec: 0.9,
      simulate18fps: false,
      durationMode: 'per-slide' as const,
      defaultSlideDurationSec: 3.5,
      slideDurations: [3.5, 2, 4],
    };
    // Track the motion progress of each slide index across every frame
    const lastProgress = new Map<number, number>();
    const totalFrames = getTotalFrames(9.5, 30);
    for (let f = 0; f < totalFrames; f++) {
      const st = evaluateTimeline({ ...base, frameIndex: f });
      const seen: [number, number][] = [[st.slideAIndex, st.motionProgressA]];
      if (st.isInTransition) seen.push([st.slideBIndex, st.motionProgressB]);
      for (const [idx, p] of seen) {
        const prev = lastProgress.get(idx);
        if (prev !== undefined) {
          // Never jumps backwards and never leaps more than a few frames' worth
          expect(p).toBeGreaterThanOrEqual(prev - 1e-9);
          expect(p - prev).toBeLessThan(0.05);
        }
        lastProgress.set(idx, p);
      }
    }
    expect(lastProgress.get(0)).toBeCloseTo(1, 1);
  });

  it('lets each scene have its own transition length into the next scene', () => {
    // 3 scenes x 5s. Scene 0 → 1 uses 2s, scene 1 → 2 uses the project's 0.8s.
    const base = {
      fps: 30,
      slideCount: 3,
      totalDurationSec: 15,
      transitionDurationSec: 0.8,
      transitionDurations: [2, undefined, undefined],
      simulate18fps: false,
    };
    // t = 3.5s: inside scene 0's 2s transition (starts at 3s) but outside the default 0.8s one.
    const own = evaluateTimeline({ ...base, frameIndex: 105 });
    expect(own.isInTransition).toBe(true);
    expect(own.transitionProgress).toBeCloseTo(0.25, 2);
    const without = evaluateTimeline({ ...base, transitionDurations: undefined, frameIndex: 105 });
    expect(without.isInTransition).toBe(false);
    // Scene 1 keeps the project's length: its 0.8s window starts at 9.2s, so t = 9.5s is in it
    const second = evaluateTimeline({ ...base, frameIndex: 9.5 * 30 });
    expect(second.slideAIndex).toBe(1);
    expect(second.isInTransition).toBe(true);
    expect(second.transitionProgress).toBeCloseTo(0.375, 2);
    // Own length is still capped at 45% of the scene
    const capped = evaluateTimeline({ ...base, transitionDurations: [10, undefined, undefined], frameIndex: 2.9 * 30 });
    // 45% of 5s = 2.25s, so it starts at 2.75s: (2.9 - 2.75) / 2.25 ≈ 0.067
    expect(capped.isInTransition).toBe(true);
    expect(capped.transitionProgress).toBeCloseTo(0.067, 2);
  });
});
