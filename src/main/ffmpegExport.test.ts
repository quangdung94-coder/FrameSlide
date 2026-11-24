import { describe, expect, it } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  buildFfmpegArgs,
  cancelFfmpegJob,
  finishFfmpegJob,
  formatFfmpegFps,
  isFfmpegAvailable,
  startFfmpegJob,
  writeFfmpegFrame,
} from './ffmpegExport';

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

describe('FFmpeg job robustness', () => {
  const hasFfmpeg = isFfmpegAvailable();

  it.skipIf(!hasFfmpeg)(
    'rejects (instead of crashing the app) when FFmpeg exits while frames are still being written',
    async () => {
      // Output into a folder that does not exist: FFmpeg fails and closes its stdin pipe
      const jobId = startFfmpegJob({
        width: 64,
        height: 64,
        fps: 30,
        codec: 'h264',
        filePath: join(tmpdir(), 'frameslide-missing-dir-xyz', 'nested', 'out.mp4'),
      });
      const frame = new Uint8Array(64 * 64 * 4);
      let error: unknown = null;
      try {
        for (let i = 0; i < 300; i++) {
          await writeFfmpegFrame(jobId, frame);
          // Give FFmpeg time to die between frames, like a slow GPU render would
          await new Promise((r) => setTimeout(r, 5));
        }
        await finishFfmpegJob(jobId);
      } catch (err) {
        error = err;
      } finally {
        await cancelFfmpegJob(jobId);
      }
      expect(error).toBeInstanceOf(Error);
    },
    20_000
  );
});
