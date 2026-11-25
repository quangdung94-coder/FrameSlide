import { describe, expect, it } from 'vitest';
import { clampTextOffset, computeTextAnim, resolveCaptionWindow } from './textAnimation';
import { revealText, typewriterCharCount } from './textOverlay';
import { DEFAULT_TEXT_OVERLAY } from '@shared/types';

const base = {
  timing: 'per-scene' as const,
  sceneIndex: 1,
  sceneCount: 3,
  slotSec: 4,
  timeSec: 10,
  charCount: 20,
};

describe('computeTextAnim', () => {
  it('fade without caption timing keeps the original per-scene fades', () => {
    const p = 0.5;
    const st = computeTextAnim({ ...base, sceneLocalSec: p * 4 });
    expect(st.alpha).toBe(1);
    expect(computeTextAnim({ ...base, sceneLocalSec: 0.3 }).alpha).toBeCloseTo(Math.min(1, 0.075 / 0.15));
    expect(st.revealChars).toBe(Infinity);
  });

  it('intro text only on the first scene', () => {
    expect(computeTextAnim({ ...base, timing: 'intro', sceneLocalSec: 2 }).alpha).toBe(0);
    expect(computeTextAnim({ ...base, timing: 'intro', sceneIndex: 0, sceneLocalSec: 2 }).alpha).toBe(1);
  });

  it('caption timing hides the text outside its window', () => {
    const ct = { inSec: 1, outSec: 3 };
    expect(computeTextAnim({ ...base, captionTiming: ct, sceneLocalSec: 0.5 }).alpha).toBe(0);
    expect(computeTextAnim({ ...base, captionTiming: ct, sceneLocalSec: 2 }).alpha).toBe(1);
    expect(computeTextAnim({ ...base, captionTiming: ct, sceneLocalSec: 3.5 }).alpha).toBe(0);
    expect(resolveCaptionWindow({ inSec: 5 }, 4)).toEqual([3.8, 4]);
  });

  it('typewriter reveals letters over time from the caption start', () => {
    const at = (t: number) => computeTextAnim({ ...base, animation: 'typewriter', captionTiming: { inSec: 1 }, sceneLocalSec: t });
    expect(at(1).revealChars).toBe(0);
    expect(at(1.5).revealChars).toBeGreaterThan(0);
    expect(at(1.5).revealChars).toBeLessThan(20);
    expect(at(3).revealChars).toBe(20);
  });

  it('slide-up starts low and settles', () => {
    const at = (t: number) => computeTextAnim({ ...base, animation: 'slide-up', sceneLocalSec: t });
    expect(at(0).slideY).toBeCloseTo(0.05);
    expect(at(2).slideY).toBe(0);
  });
});

describe('text helpers', () => {
  it('revealText keeps whole Vietnamese letters', () => {
    expect(revealText('Hà Nội', 2)).toBe('Hà');
    expect(revealText('Hà Nội', Infinity)).toBe('Hà Nội');
  });

  it('typewriterCharCount counts the date for the date stamp', () => {
    expect(typewriterCharCount({ ...DEFAULT_TEXT_OVERLAY, style: 'date-stamp-90s' }, 'Title', "'26 11 24")).toBe(9);
    expect(typewriterCharCount({ ...DEFAULT_TEXT_OVERLAY, subtitle: 'ab' }, 'Title', 'x')).toBe(7);
  });

  it('clampTextOffset limits dragging', () => {
    expect(clampTextOffset({ x: 2, y: -2 })).toEqual({ x: 0.45, y: -0.45 });
    expect(clampTextOffset(undefined)).toEqual({ x: 0, y: 0 });
  });
});
