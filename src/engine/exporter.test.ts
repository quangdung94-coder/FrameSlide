import { describe, expect, it, vi } from 'vitest';
import { ExportCanceledError, exportViaFfmpeg, exportWorkspaceBatch } from './exporter';
import type { FrameSlideEngine } from './FrameSlideEngine';
import type { FrameSlideAPI, RenderParams, SceneItem, SlideAsset } from '@shared/types';

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

describe('exportWorkspaceBatch', () => {
  function setupMulti(opts?: { failOnSecond?: boolean }) {
    const events: string[] = [];
    const writtenFiles: string[] = [];
    let currentScenes: SceneItem[] = [{ id: 's0', layout: 'single', durationSec: 1, transitionType: 'film-dissolve', slots: ['p0'] }];

    const engine = {
      getScenes: () => currentScenes,
      whenReady: async () => {},
      getSize: () => ({ width: 10, height: 10 }),
      resize: () => {},
      clearTextureCache: () => void events.push('clearCache'),
      setCustomCubeLut: (c: string | null) => {
        events.push(`lut:${c ?? 'none'}`);
        return null;
      },
      setProjectMedia: async (_slides: SlideAsset[], scenes: SceneItem[]) => {
        currentScenes = scenes;
        events.push(`media:${scenes.map((s) => s.id).join(',')}`);
      },
      ensureFrameTextures: async () => {},
      renderFrameToBuffer: () => {},
    } as unknown as FrameSlideEngine;

    const api = {
      readTextFile: async (p: string) => `LUT(${p})`,
      freeExportPath: async (folder: string, fileName: string) => `${folder}\\${fileName}`,
      ffmpegExportStartDirect: async ({ filePath }: { filePath: string }) => {
        if (opts?.failOnSecond && filePath.includes('02_Fail')) {
          throw new Error('Disk full');
        }
        writtenFiles.push(filePath);
        return { jobId: filePath };
      },
      ffmpegExportFrame: async () => {},
      ffmpegExportFinish: async ({}: string) => ({ filePath: 'done.mov', durationMs: 10 }),
      ffmpegExportCancel: async () => {},
    } as unknown as FrameSlideAPI;

    const params = {
      durationMode: 'per-slide',
      defaultSlideDurationSec: 1,
      handlesSec: 0,
      outputAspect: '16:9',
      portraitMode: 'smart-pairing',
      motionTemplate: 'ken-burns-classic',
      transitionType: 'film-dissolve',
      super8: { enabled: false, simulate18fps: false },
    } as unknown as RenderParams;

    const slide = { id: 'p0', name: 'a.jpg', originalPath: '', proxyUrl: 'u', thumbUrl: 't', width: 100, height: 100, orientation: 'landscape', takenAtMs: 0, focalPoint: { x: 0.5, y: 0.5 } } as SlideAsset;
    const sc1: SceneItem = { id: 'sc1', layout: 'single', durationSec: 1, transitionType: 'film-dissolve', slots: ['p0'] };
    const sc2: SceneItem = { id: 'sc2', layout: 'single', durationSec: 1, transitionType: 'film-dissolve', slots: ['p0'] };

    return { engine, api, params, events, writtenFiles, slide, sc1, sc2 };
  }

  it('exports workspaces sequentially into 1 folder, clears VRAM, and restores active workspace', async () => {
    const t = setupMulti();
    const doneIds: string[] = [];
    const summary = await exportWorkspaceBatch({
      engine: t.engine,
      api: t.api,
      workspaces: [
        { id: 'w1', name: '01_MoDau', slides: [t.slide], scenes: [t.sc1], renderParams: t.params, customLutPath: 'D:/a.cube' },
        { id: 'w2', name: '02_Ket', slides: [t.slide], scenes: [t.sc2], renderParams: t.params, customLutPath: null },
      ],
      restoreState: { slides: [t.slide], scenes: [t.sc1], renderParams: t.params, customLutPath: 'D:/orig.cube' },
      codec: 'dnxhr_hq',
      fps: 30,
      outputDir: 'D:\\Exports',
      onWorkspaceDone: (id) => doneIds.push(id),
    });

    expect(summary.clipCount).toBe(2);
    expect(t.writtenFiles).toEqual(['D:\\Exports\\01_MoDau.mov', 'D:\\Exports\\02_Ket.mov']);
    expect(doneIds).toEqual(['w1', 'w2']);
    expect(t.events.filter((e) => e === 'clearCache')).toHaveLength(3);
    expect(t.events.at(-2)).toBe('lut:LUT(D:/orig.cube)');
    expect(t.events.at(-1)).toBe('media:sc1');
  });

  it('continues exporting remaining workspaces when one fails and reports failedClips', async () => {
    const t = setupMulti({ failOnSecond: true });
    const summary = await exportWorkspaceBatch({
      engine: t.engine,
      api: t.api,
      workspaces: [
        { id: 'w1', name: '01_Ok', slides: [t.slide], scenes: [t.sc1], renderParams: t.params, customLutPath: null },
        { id: 'w2', name: '02_Fail', slides: [t.slide], scenes: [t.sc2], renderParams: t.params, customLutPath: null },
        { id: 'w3', name: '03_OkAfter', slides: [t.slide], scenes: [t.sc2], renderParams: t.params, customLutPath: null },
      ],
      restoreState: { slides: [t.slide], scenes: [t.sc1], renderParams: t.params, customLutPath: null },
      codec: 'prores422',
      fps: 30,
      outputDir: 'D:\\Exports',
    });

    expect(summary.clipCount).toBe(2);
    expect(summary.failedClips).toEqual([{ name: '02_Fail', error: 'Disk full' }]);
    expect(t.writtenFiles).toEqual(['D:\\Exports\\01_Ok.mov', 'D:\\Exports\\03_OkAfter.mov']);
  });

  it('aborts cleanly and restores active workspace when canceled mid-batch', async () => {
    const t = setupMulti();
    const ac = new AbortController();
    const onProgress = vi.fn(() => ac.abort());

    await expect(
      exportWorkspaceBatch({
        engine: t.engine,
        api: t.api,
        workspaces: [
          { id: 'w1', name: '01_MoDau', slides: [t.slide], scenes: [t.sc1], renderParams: t.params, customLutPath: null },
          { id: 'w2', name: '02_Ket', slides: [t.slide], scenes: [t.sc2], renderParams: t.params, customLutPath: null },
        ],
        restoreState: { slides: [t.slide], scenes: [t.sc1], renderParams: t.params, customLutPath: null },
        codec: 'prores422',
        fps: 30,
        outputDir: 'D:\\Exports',
        onProgress,
        signal: ac.signal,
      })
    ).rejects.toBeInstanceOf(ExportCanceledError);

    expect(t.events.at(-1)).toBe('media:sc1');
  });
});
