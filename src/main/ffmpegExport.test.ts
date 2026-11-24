import { describe, expect, it } from 'vitest';
import { buildFfmpegArgs, formatFfmpegFps } from './ffmpegExport';

describe('FFmpeg export arguments & Rec.709 color conversion', () => {
  it('converts 23.976 fps to exact NTSC fraction 24000/1001', () => {
    expect(formatFfmpegFps(23.976)).toBe('24000/1001');
    expect(formatFfmpegFps(24)).toBe('24');
    expect(formatFfmpegFps(25)).toBe('25');
    expect(formatFfmpegFps(30)).toBe('30');
  });

  it('includes explicit full-to-bt709-tv matrix conversion and color metadata', () => {
    const args = buildFfmpegArgs({
      width: 1920,
      height: 1080,
      fps: 23.976,
      codec: 'prores422',
      filePath: 'D:/out/test.mov',
    });

    expect(args).toContain('24000/1001');
    expect(args).toContain('vflip,scale=in_range=full:out_color_matrix=bt709:out_range=tv');
    expect(args).toContain('-colorspace');
    expect(args).toContain('bt709');
    expect(args).toContain('prores_ks');
  });

  it('supports DNxHR HQ args', () => {
    const args = buildFfmpegArgs({
      width: 1920,
      height: 1080,
      fps: 25,
      codec: 'dnxhr_hq',
      filePath: 'D:/out/test_dnx.mov',
    });
    expect(args).toContain('dnxhd');
    expect(args).toContain('dnxhr_hq');
  });
});
