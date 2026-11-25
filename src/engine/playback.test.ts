import { describe, expect, it } from 'vitest';
import { applyShuttleKey, computePlaybackFrame, formatPlaybackRate, playbackStartFrame } from './playback';

const base = { startFrame: 10, elapsedSec: 1, fps: 30, rate: 1, direction: 1 as const, totalFrames: 100, loop: true };

describe('computePlaybackFrame', () => {
  it('plays forward at 1× like before', () => {
    expect(computePlaybackFrame(base)).toEqual({ frame: 40, ended: false });
  });
  it('scales by speed', () => {
    expect(computePlaybackFrame({ ...base, rate: 2 }).frame).toBe(70);
    expect(computePlaybackFrame({ ...base, rate: 0.5 }).frame).toBe(25);
  });
  it('plays backwards and wraps when looping', () => {
    expect(computePlaybackFrame({ ...base, direction: -1, elapsedSec: 0.2 }).frame).toBe(4);
    expect(computePlaybackFrame({ ...base, direction: -1 }).frame).toBe(80);
    expect(computePlaybackFrame({ ...base, elapsedSec: 4 }).frame).toBe(30);
  });
  it('stops at the ends when loop is off', () => {
    expect(computePlaybackFrame({ ...base, loop: false, elapsedSec: 10 })).toEqual({ frame: 99, ended: true });
    expect(computePlaybackFrame({ ...base, loop: false, direction: -1 })).toEqual({ frame: 0, ended: true });
    expect(computePlaybackFrame({ ...base, loop: false })).toEqual({ frame: 40, ended: false });
  });
  it('loops inside the In/Out range', () => {
    const r = { start: 30, end: 60 };
    expect(computePlaybackFrame({ ...base, startFrame: 50, elapsedSec: 0.5, loopRange: r }).frame).toBe(35);
    expect(computePlaybackFrame({ ...base, startFrame: 31, direction: -1, elapsedSec: 0.1, loopRange: r }).frame).toBe(58);
    expect(computePlaybackFrame({ ...base, startFrame: 50, elapsedSec: 0.5, loopRange: { start: 0, end: 500 } }).frame).toBe(65);
  });
  it('survives bad input', () => {
    expect(computePlaybackFrame({ ...base, totalFrames: 0, rate: Number.NaN }).frame).toBe(0);
  });
});

describe('applyShuttleKey', () => {
  const stopped = { isPlaying: false, direction: 1 as const, rate: 0.5 };
  it('L starts forward at 1× and speeds up 2× then 4×', () => {
    const a = applyShuttleKey(stopped, 'l');
    expect(a).toEqual({ isPlaying: true, direction: 1, rate: 1 });
    const b = applyShuttleKey(a, 'l');
    expect(b.rate).toBe(2);
    const c = applyShuttleKey(b, 'l');
    expect(c.rate).toBe(4);
    expect(applyShuttleKey(c, 'l').rate).toBe(4);
  });
  it('J plays backwards; switching direction resets to 1×', () => {
    const fwd4 = { isPlaying: true, direction: 1 as const, rate: 4 };
    expect(applyShuttleKey(fwd4, 'j')).toEqual({ isPlaying: true, direction: -1, rate: 1 });
    expect(applyShuttleKey({ isPlaying: true, direction: -1, rate: 1 }, 'j').rate).toBe(2);
  });
  it('slow speed then L goes to the next shuttle step', () => {
    expect(applyShuttleKey({ isPlaying: true, direction: 1, rate: 0.5 }, 'l').rate).toBe(1);
  });
  it('K pauses and faces forward', () => {
    expect(applyShuttleKey({ isPlaying: true, direction: -1, rate: 2 }, 'k')).toEqual({
      isPlaying: false,
      direction: 1,
      rate: 2,
    });
  });
});

describe('helpers', () => {
  it('formats speeds', () => {
    expect(formatPlaybackRate(1)).toBe('1×');
    expect(formatPlaybackRate(0.25)).toBe('0.25×');
  });
  it('restarts from the other end when play is pressed at an end', () => {
    expect(playbackStartFrame(99, 1, 100)).toBe(0);
    expect(playbackStartFrame(0, -1, 100)).toBe(99);
    expect(playbackStartFrame(50, 1, 100)).toBe(50);
  });
});
