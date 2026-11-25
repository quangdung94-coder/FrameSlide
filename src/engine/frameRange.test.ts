import { describe, expect, it } from 'vitest';
import { marksToRange, rangeFileSuffix, rangeFrameCount, resolveExportRange, sceneFrameRange } from './frameRange';

describe('marksToRange', () => {
  it('In and Out set: Out frame included', () => {
    expect(marksToRange(180, 480, 840)).toEqual({ start: 180, end: 481 });
  });
  it('only one mark', () => {
    expect(marksToRange(100, null, 300)).toEqual({ start: 100, end: 300 });
    expect(marksToRange(null, 99, 300)).toEqual({ start: 0, end: 100 });
  });
  it('swaps reversed marks and clamps to the clip', () => {
    expect(marksToRange(500, 100, 300)).toEqual({ start: 100, end: 300 });
    expect(marksToRange(-5, 10, 300)).toEqual({ start: 0, end: 11 });
  });
  it('nothing marked or empty clip', () => {
    expect(marksToRange(null, null, 300)).toBeNull();
    expect(marksToRange(5, 10, 0)).toBeNull();
  });
});

describe('sceneFrameRange', () => {
  it('matches the scene track rounding', () => {
    expect(sceneFrameRange(0, [3.5, 3.5, 2], 30)).toEqual({ start: 0, end: 105 });
    expect(sceneFrameRange(2, [3.5, 3.5, 2], 30)).toEqual({ start: 210, end: 270 });
    expect(sceneFrameRange(3, [3.5], 30)).toBeNull();
  });
});

describe('helpers', () => {
  it('file suffix and count', () => {
    expect(rangeFileSuffix({ start: 180, end: 481 }, 30)).toBe('_00m06s-00m16s');
    expect(rangeFileSuffix({ start: 1800, end: 3900 }, 30)).toBe('_01m00s-02m10s');
    expect(rangeFrameCount({ start: 10, end: 40 })).toBe(30);
  });
  it('resolveExportRange by mode', () => {
    const input = { markIn: 30, markOut: 59, totalFrames: 300, sceneRange: { start: 105, end: 210 } };
    expect(resolveExportRange('all', input)).toBeNull();
    expect(resolveExportRange('inout', input)).toEqual({ start: 30, end: 60 });
    expect(resolveExportRange('scene', input)).toEqual({ start: 105, end: 210 });
    expect(resolveExportRange('scene', { ...input, sceneRange: null })).toBeNull();
    expect(resolveExportRange('inout', { ...input, markIn: null, markOut: null })).toBeNull();
  });
});
