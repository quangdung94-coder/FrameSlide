import { describe, expect, it } from 'vitest';
import { parseCubeLut } from './cubeLutParser';

describe('.cube 3D LUT parser', () => {
  it('parses a valid 2x2x2 identity .cube LUT into a 2D strip', () => {
    const sample = `
      # Test DaVinci Resolve 3D LUT
      TITLE "Resolve Warm Test"
      LUT_3D_SIZE 2
      DOMAIN_MIN 0.0 0.0 0.0
      DOMAIN_MAX 1.0 1.0 1.0
      0.0 0.0 0.0
      1.0 0.0 0.0
      0.0 1.0 0.0
      1.0 1.0 0.0
      0.0 0.0 1.0
      1.0 0.0 1.0
      0.0 1.0 1.0
      1.0 1.0 1.0
    `;

    const parsed = parseCubeLut(sample);
    expect(parsed.title).toBe('Resolve Warm Test');
    expect(parsed.size).toBe(2);
    expect(parsed.stripRgba.length).toBe(4 * 2 * 4); // width=4, height=2, RGBA

    // Check (r=1, g=0, b=1) => x = 1*2 + 1 = 3, y = 0 => (255, 0, 255, 255)
    const offset = (0 * 4 + 3) * 4;
    expect(parsed.stripRgba[offset]).toBe(255);
    expect(parsed.stripRgba[offset + 1]).toBe(0);
    expect(parsed.stripRgba[offset + 2]).toBe(255);
    expect(parsed.stripRgba[offset + 3]).toBe(255);
  });

  it('throws on invalid size or 1D LUT', () => {
    expect(() => parseCubeLut('LUT_1D_SIZE 33\n0 0 0')).toThrow();
    expect(() => parseCubeLut('LUT_3D_SIZE 17\n0 0 0')).toThrow();
  });
});
