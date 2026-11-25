import { describe, expect, it } from 'vitest';
import { exportViaFfmpeg } from './exporter';
import type { FrameSlideEngine } from './FrameSlideEngine';
import type { FrameSlideAPI, RenderParams } from '@shared/types';

/** Fake engine / API: record which project frames get rendered and sent to FFmpeg. */
function setup() {
  const rendered: number[] = [];
  let sent = 0;
  const engine = {
    getScenes: () => [{ durationSec: 2 }, { durationSec: 2 }],
    whenReady: async () => {},
    getSize: () => ({ width: 10, height: 10 }),
    resize: () => {},
    ensureFrameTextures: async () => {},
    renderFrameToBuffer: (i: number) => void rendered.push(i),
  } as unknown as FrameSlideEngine;
  const api = {
    ffmpegExportStart: async () => ({ canceled: false, jobId: 'job' }),
    ffmpegExportFrame: async () => void sent++,
    ffmpegExportFinish: async () => ({ filePath: 'out.mov' }),
    ffmpegExportCancel: async () => {},
  } as unknown as FrameSlideAPI;
  const params = { durationMode: 'per-slide', defaultSlideDurationSec: 2, handlesSec: 0, outputAspect: '16:9' } as unknown as RenderParams;
  return { engine, api, params, rendered, sentCount: () => sent };
}

describe('exportViaFfmpeg range (In/Out)', () => {
  it('exports the whole clip by default', async () => {
    const t = setup();
    const res = await exportViaFfmpeg({ engine: t.engine, api: t.api, codec: 'prores422', fps: 30, params: t.params, defaultName: 'a.mov' });
    expect(res?.totalFrames).toBe(120);
    expect(t.rendered[0]).toBe(0);
    expect(t.rendered[119]).toBe(119);
  });

  it('exports only the range, keeping project frame numbers', async () => {
    const t = setup();
    const res = await exportViaFfmpeg({
      engine: t.engine,
      api: t.api,
      codec: 'prores422',
      fps: 30,
      params: t.params,
      defaultName: 'a.mov',
      range: { start: 45, end: 75 },
    });
    expect(res?.totalFrames).toBe(30);
    expect(t.rendered).toEqual(Array.from({ length: 30 }, (_, k) => 45 + k));
    expect(t.sentCount()).toBe(30);
  });

  it('clamps a range past the end of the clip', async () => {
    const t = setup();
    const res = await exportViaFfmpeg({
      engine: t.engine,
      api: t.api,
      codec: 'prores422',
      fps: 30,
      params: t.params,
      defaultName: 'a.mov',
      range: { start: 100, end: 400 },
    });
    expect(res?.totalFrames).toBe(20);
    expect(t.rendered.at(-1)).toBe(119);
  });
});
