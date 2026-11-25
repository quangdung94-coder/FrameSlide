import { describe, expect, it } from 'vitest';
import {
  applyCropBox,
  coverSourceRect,
  FULL_CROP_BOX,
  IDENTITY_PHOTO_TRANSFORM,
  resizeCropBox,
  rotatePhotoAbout,
  straightenDelta,
} from './photoTransform';

describe('crop box → photo transform', () => {
  it('full box keeps the transform', () => {
    const t = { x: 0.1, y: -0.2, scale: 1.3, rotationDeg: 12 };
    expect(applyCropBox(t, FULL_CROP_BOX)).toEqual(t);
  });

  it('half-size box in the top-left quarter zooms 2× and shifts the photo', () => {
    const out = applyCropBox(IDENTITY_PHOTO_TRANSFORM, { x: -0.25, y: -0.25, size: 0.5 });
    expect(out.scale).toBeCloseTo(2);
    expect(out.x).toBeCloseTo(0.5);
    expect(out.y).toBeCloseTo(0.5);
    expect(out.rotationDeg).toBe(0);
  });

  it('a box bigger than the frame zooms out', () => {
    expect(applyCropBox(IDENTITY_PHOTO_TRANSFORM, { x: 0, y: 0, size: 2 }).scale).toBeCloseTo(0.5);
  });
});

describe('rotatePhotoAbout', () => {
  it('rotating about the photo centre only changes the angle', () => {
    const t = { x: 0.2, y: 0.1, scale: 1, rotationDeg: 5 };
    const out = rotatePhotoAbout(t, { x: 0.2, y: 0.1 }, 10, 16 / 9);
    expect(out.x).toBeCloseTo(0.2);
    expect(out.y).toBeCloseTo(0.1);
    expect(out.rotationDeg).toBeCloseTo(15);
  });

  it('90° clockwise about the frame centre moves a right offset downwards (in pixels)', () => {
    const a = 2; // frame twice as wide as tall
    const out = rotatePhotoAbout({ x: 0.25, y: 0, scale: 1, rotationDeg: 0 }, { x: 0, y: 0 }, 90, a);
    // 0.25 of width = 0.5 of height; after the turn it sits 0.5 frame heights below.
    expect(out.x).toBeCloseTo(0);
    expect(out.y).toBeCloseTo(0.5);
  });
});

describe('straightenDelta', () => {
  it('levels a slightly tilted horizon', () => {
    // Line going down to the right by 5° → rotate 5° counter-clockwise.
    const r = (5 * Math.PI) / 180;
    expect(straightenDelta(0, 0, 100 * Math.cos(r), 100 * Math.sin(r))).toBeCloseTo(-5);
  });

  it('makes a near-vertical line upright, whatever way it was drawn', () => {
    const r = (93 * Math.PI) / 180;
    expect(straightenDelta(0, 0, 100 * Math.cos(r), 100 * Math.sin(r))).toBeCloseTo(-3);
    expect(straightenDelta(100 * Math.cos(r), 100 * Math.sin(r), 0, 0)).toBeCloseTo(-3);
  });

  it('ignores a click without a line', () => {
    expect(straightenDelta(10, 10, 11, 11)).toBe(0);
  });
});

describe('resizeCropBox', () => {
  it('dragging the SE corner keeps the NW corner fixed', () => {
    const out = resizeCropBox(FULL_CROP_BOX, 'se', 0.25, 0.1);
    // anchor (-0.5,-0.5); x distance 0.75 wins over y 0.6
    expect(out.size).toBeCloseTo(0.75);
    expect(out.x - out.size / 2).toBeCloseTo(-0.5);
    expect(out.y - out.size / 2).toBeCloseTo(-0.5);
  });

  it('dragging the west edge keeps the east edge and the vertical centre', () => {
    const out = resizeCropBox(FULL_CROP_BOX, 'w', -0.1, 0.4);
    expect(out.size).toBeCloseTo(0.6);
    expect(out.x + out.size / 2).toBeCloseTo(0.5);
    expect(out.y).toBe(0);
  });

  it('never collapses or flips', () => {
    expect(resizeCropBox(FULL_CROP_BOX, 'e', -3, 0).size).toBeGreaterThan(0.05);
  });
});

describe('coverSourceRect', () => {
  it('wide photo in a 16:9 frame keeps the full height, centred on the focal point', () => {
    const r = coverSourceRect(3000, 1000, 16 / 9, { x: 0.5, y: 0.5 });
    expect(r.h).toBe(1);
    expect(r.w).toBeCloseTo(16 / 9 / 3);
    expect(r.x + r.w / 2).toBeCloseTo(0.5);
  });

  it('portrait photo crops top/bottom and stays inside the image', () => {
    const r = coverSourceRect(1000, 1500, 16 / 9, { x: 0.5, y: 0 });
    expect(r.w).toBe(1);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.y + r.h).toBeLessThanOrEqual(1);
  });
});
