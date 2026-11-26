import { describe, expect, it } from 'vitest';
import { formatSecondsClock, formatTimecode, parseDurationInput, rulerMarks, scenePositionAt } from './timecode';

describe('formatTimecode', () => {
  it('shows minutes, seconds and frame', () => {
    expect(formatTimecode(0, 30)).toBe('00:00:00');
    expect(formatTimecode(528, 30)).toBe('00:17:18');
    expect(formatTimecode(30 * 75 + 5, 30)).toBe('01:15:05');
    expect(formatTimecode(-3, 30)).toBe('00:00:00');
  });
  it('handles 23.976 / 25 fps', () => {
    expect(formatTimecode(25, 25)).toBe('00:01:00');
    expect(formatTimecode(24, 23.976)).toBe('00:01:00');
  });
});

describe('formatSecondsClock', () => {
  it('keeps the old mm:ss.s format', () => {
    expect(formatSecondsClock(17.6)).toBe('00:17.6');
    expect(formatSecondsClock(59.96)).toBe('01:00.0');
  });
});

describe('rulerMarks', () => {
  it('picks a round step with at most 12 labels', () => {
    expect(rulerMarks(10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(rulerMarks(28)).toEqual([0, 5, 10, 15, 20, 25]);
    expect(rulerMarks(170).length).toBeLessThanOrEqual(12);
    expect(rulerMarks(0)).toEqual([]);
  });
});

describe('scenePositionAt', () => {
  const d = [3.5, 3.5, 2];
  it('finds the scene and the offset inside it', () => {
    expect(scenePositionAt(0, d)).toEqual({ index: 0, offsetSec: 0, durationSec: 3.5 });
    expect(scenePositionAt(5.6, d)?.index).toBe(1);
    expect(scenePositionAt(5.6, d)?.offsetSec).toBeCloseTo(2.1);
    expect(scenePositionAt(99, d)).toEqual({ index: 2, offsetSec: 2, durationSec: 2 });
    expect(scenePositionAt(1, [])).toBeNull();
  });
});

describe('parseDurationInput', () => {
  it('parses seconds and mm:ss values and rejects invalid input', () => {
    expect(parseDurationInput('90')).toBe(90);
    expect(parseDurationInput('45.5')).toBe(45.5);
    expect(parseDurationInput('1:30')).toBe(90);
    expect(parseDurationInput('02:15')).toBe(135);
    expect(parseDurationInput('')).toBeNull();
    expect(parseDurationInput('-5')).toBeNull();
    expect(parseDurationInput('1:75')).toBeNull();
    expect(parseDurationInput('abc')).toBeNull();
  });
});
