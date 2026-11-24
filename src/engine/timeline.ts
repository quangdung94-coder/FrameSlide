import type { DurationMode } from '@shared/types';

export interface TimelineState {
  timeSec: number;
  effectiveFrameIndex: number;
  slideAIndex: number;
  slideBIndex: number;
  slideAProgress: number;     // 0..1 within slide A
  slideBProgress: number;     // 0..1 within slide B
  transitionProgress: number; // 0..1 (0 when not in transition)
  isInTransition: boolean;
}

export interface TimelineDurationInput {
  durationMode?: DurationMode;
  totalDurationSec: number;
  defaultSlideDurationSec?: number;
  slideDurations?: (number | undefined)[];
  handlesSec?: number;
}

export function resolveSlideDurations(
  slideCount: number,
  input: TimelineDurationInput
): number[] {
  const safeCount = Math.max(1, slideCount);
  const handles = Math.max(0, input.handlesSec ?? 0);

  let baseDurations: number[];
  if (input.durationMode === 'per-slide') {
    const def = Math.max(0.5, input.defaultSlideDurationSec ?? 3.5);
    baseDurations = Array.from({ length: safeCount }, (_, i) => {
      const custom = input.slideDurations?.[i];
      return custom && custom >= 0.5 ? custom : def;
    });
  } else {
    const slot = Math.max(0.5, input.totalDurationSec / safeCount);
    baseDurations = Array.from({ length: safeCount }, () => slot);
  }

  // Add editorial handles to first & last slide for Resolve dissolve flexibility
  if (handles > 0) {
    baseDurations[0] += handles;
    baseDurations[baseDurations.length - 1] += handles;
  }

  return baseDurations;
}

export function computeEffectiveTotalDurationSec(
  slideCount: number,
  input: TimelineDurationInput
): number {
  const durations = resolveSlideDurations(slideCount, input);
  return durations.reduce((acc, d) => acc + d, 0);
}

export function getTotalFrames(totalDurationSec: number, fps: number): number {
  return Math.max(1, Math.round(totalDurationSec * fps));
}

/**
 * Deterministic timeline evaluator supporting:
 * - Fixed total duration OR per-slide custom durations
 * - Editorial Handles (extra head/tail seconds)
 * - Super 8 18fps cadence simulation inside 23.976 / 24 / 25 / 30fps containers
 */
export function evaluateTimeline(opts: {
  frameIndex: number;
  fps: number;
  slideCount: number;
  totalDurationSec: number;
  transitionDurationSec: number;
  simulate18fps: boolean;
  durationMode?: DurationMode;
  defaultSlideDurationSec?: number;
  slideDurations?: (number | undefined)[];
  handlesSec?: number;
}): TimelineState {
  const { fps, slideCount, simulate18fps } = opts;
  const safeCount = Math.max(1, slideCount);
  const durations = resolveSlideDurations(safeCount, opts);
  const effectiveTotalSec = durations.reduce((a, b) => a + b, 0);

  const rawTime = Math.max(0, Math.min(effectiveTotalSec, opts.frameIndex / fps));

  const effectiveFrameIndex = simulate18fps
    ? Math.floor(rawTime * 18)
    : Math.max(0, Math.floor(opts.frameIndex));
  const timeSec = simulate18fps
    ? Math.min(effectiveTotalSec, effectiveFrameIndex / 18)
    : rawTime;

  if (safeCount === 1) {
    const p = effectiveTotalSec > 0 ? Math.min(1, timeSec / effectiveTotalSec) : 0;
    return {
      timeSec,
      effectiveFrameIndex,
      slideAIndex: 0,
      slideBIndex: 0,
      slideAProgress: p,
      slideBProgress: p,
      transitionProgress: 0,
      isInTransition: false,
    };
  }

  // Locate current slide slot from cumulative durations
  let acc = 0;
  let slideIdx = safeCount - 1;
  let localTime = 0;
  let slotDuration = durations[safeCount - 1];

  for (let i = 0; i < safeCount; i++) {
    const d = durations[i];
    if (timeSec < acc + d || i === safeCount - 1) {
      slideIdx = i;
      localTime = Math.max(0, timeSec - acc);
      slotDuration = d;
      break;
    }
    acc += d;
  }

  const slideAProgress = Math.max(0, Math.min(1, localTime / slotDuration));
  const clampedTrans = Math.max(0, Math.min(opts.transitionDurationSec, slotDuration * 0.45));
  const transitionStart = slotDuration - clampedTrans;
  const hasNextSlide = slideIdx < safeCount - 1;

  if (hasNextSlide && clampedTrans > 0 && localTime >= transitionStart) {
    const transitionProgress = Math.max(
      0,
      Math.min(1, (localTime - transitionStart) / clampedTrans)
    );
    const nextDuration = durations[slideIdx + 1];
    const slideBProgress = Math.max(
      0,
      Math.min(1, (localTime - transitionStart) / Math.max(0.5, nextDuration))
    );
    return {
      timeSec,
      effectiveFrameIndex,
      slideAIndex: slideIdx,
      slideBIndex: slideIdx + 1,
      slideAProgress,
      slideBProgress,
      transitionProgress,
      isInTransition: true,
    };
  }

  return {
    timeSec,
    effectiveFrameIndex,
    slideAIndex: slideIdx,
    slideBIndex: slideIdx,
    slideAProgress,
    slideBProgress: 0,
    transitionProgress: 0,
    isInTransition: false,
  };
}
