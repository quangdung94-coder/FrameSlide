/**
 * Preview transport maths (Đợt 5.1b): playback speed, direction and loop, plus the J/K/L
 * shuttle of Premiere / Resolve. Preview only: export always renders every frame in order.
 */

export type PlayDirection = 1 | -1;

/** Speeds offered in the speed menu. */
export const PLAYBACK_RATES = [0.25, 0.5, 1, 2, 4] as const;
/** Speeds that repeated J or L presses step through. */
export const SHUTTLE_RATES = [1, 2, 4] as const;
export const MAX_PLAYBACK_RATE = 4;

export interface PlaybackFrameInput {
  /** Frame shown when playback (or the last speed change) started. */
  startFrame: number;
  /** Wall-clock seconds since then. */
  elapsedSec: number;
  fps: number;
  rate: number;
  direction: PlayDirection;
  totalFrames: number;
  loop: boolean;
  /** Loop only inside this range (In/Out), end exclusive. Used when looping. */
  loopRange?: { start: number; end: number } | null;
}

export interface PlaybackFrameResult {
  frame: number;
  /** True when playback hit the first / last frame with loop off; the caller stops. */
  ended: boolean;
}

export function computePlaybackFrame(input: PlaybackFrameInput): PlaybackFrameResult {
  const total = Math.max(1, Math.floor(input.totalFrames));
  const last = total - 1;
  const rate = Number.isFinite(input.rate) && input.rate > 0 ? input.rate : 1;
  const advanced = Math.floor(Math.max(0, input.elapsedSec) * input.fps * rate);
  const raw = Math.round(input.startFrame) + input.direction * advanced;
  if (input.loop) {
    const r = input.loopRange;
    if (r && r.end > r.start && r.start >= 0 && r.end <= total) {
      const len = r.end - r.start;
      return { frame: r.start + ((((raw - r.start) % len) + len) % len), ended: false };
    }
    return { frame: ((raw % total) + total) % total, ended: false };
  }
  if (raw >= last && input.direction === 1) return { frame: last, ended: true };
  if (raw <= 0 && input.direction === -1) return { frame: 0, ended: true };
  return { frame: Math.max(0, Math.min(last, raw)), ended: false };
}

export interface TransportState {
  isPlaying: boolean;
  direction: PlayDirection;
  rate: number;
}

export type ShuttleKey = 'j' | 'k' | 'l';

/**
 * One press of J, K or L:
 * - L: start forward at 1×; pressed again while going forward, 2× then 4×.
 * - J: same backwards.
 * - K: pause (direction back to forward, speed kept for Space).
 */
export function applyShuttleKey(state: TransportState, key: ShuttleKey): TransportState {
  if (key === 'k') return { isPlaying: false, direction: 1, rate: state.rate };
  const direction: PlayDirection = key === 'l' ? 1 : -1;
  if (state.isPlaying && state.direction === direction) {
    const next = SHUTTLE_RATES.find((r) => r > state.rate + 1e-6);
    return { isPlaying: true, direction, rate: next ?? MAX_PLAYBACK_RATE };
  }
  return { isPlaying: true, direction, rate: 1 };
}

/** "1×", "0.5×", "0.25×". */
export function formatPlaybackRate(rate: number): string {
  return `${Number(rate.toFixed(2))}×`;
}

/**
 * Frame to start from when playback begins. Pressing play at the very end (forward) or the
 * very start (backward) restarts from the other end instead of stopping at once.
 */
export function playbackStartFrame(frame: number, direction: PlayDirection, totalFrames: number): number {
  const last = Math.max(0, totalFrames - 1);
  if (direction === 1 && frame >= last) return 0;
  if (direction === -1 && frame <= 0) return last;
  return frame;
}
