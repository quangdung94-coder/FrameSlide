import { describe, expect, it } from 'vitest';
import { hexToRgba, lookAlign, lookFont, normalizeTextLook, parseHexColor, TEXT_FONTS } from './textLook';

const def = { family: '"Be Vietnam Pro", sans-serif', weight: 300, italic: false, sizePx: 60 };

describe('lookFont', () => {
  it('without a look keeps the style font', () => {
    expect(lookFont(def, undefined, 1)).toBe('300 60px "Be Vietnam Pro", sans-serif');
  });

  it('applies font, size %, bold and italic, scaled to the frame', () => {
    const f = lookFont(def, { font: 'great-vibes', sizePct: 150, bold: true, italic: true }, 0.5);
    expect(f).toBe(`italic 700 45px ${TEXT_FONTS.find((x) => x.id === 'great-vibes')!.family}`);
  });

  it('bold off on a bold style falls back to regular', () => {
    expect(lookFont({ ...def, weight: 600 }, { bold: false }, 1)).toMatch(/^400 /);
  });
});

describe('lookAlign', () => {
  it('keeps the style position until the user picks another alignment', () => {
    expect(lookAlign('center', 960, undefined, 1920, 72)).toEqual({ align: 'center', x: 960 });
    expect(lookAlign('center', 960, { align: 'left' }, 1920, 72)).toEqual({ align: 'left', x: 72 });
    expect(lookAlign('left', 94, { align: 'right' }, 1920, 94)).toEqual({ align: 'right', x: 1826 });
    expect(lookAlign('left', 94, { align: 'left' }, 1920, 72)).toEqual({ align: 'left', x: 94 });
  });
});

describe('colours and normalising', () => {
  it('parses short and long hex, rejects junk', () => {
    expect(parseHexColor('F5E')).toBe('#ff55ee');
    expect(parseHexColor('#F5E6C8')).toBe('#f5e6c8');
    expect(parseHexColor('#f5e6c')).toBeNull();
    expect(hexToRgba('#ff8000', 0.5)).toBe('rgba(255, 128, 0, 0.5)');
  });

  it('drops invalid fields, clamps numbers, empty → undefined', () => {
    expect(normalizeTextLook({ font: 'comic-sans', color: 'red', sizePct: 999, outline: -3, shadow: 'x' })).toEqual({
      sizePct: 250,
      outline: 0,
    });
    expect(normalizeTextLook({})).toBeUndefined();
    expect(normalizeTextLook(null)).toBeUndefined();
    expect(normalizeTextLook({ color: '#AABBCC', align: 'right', bold: false })).toEqual({
      color: '#aabbcc',
      align: 'right',
      bold: false,
    });
  });
});
