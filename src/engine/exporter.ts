import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import type { ExportCodec, FrameSlideAPI, RenderParams, SceneItem, SlideAsset } from '@shared/types';
import { codecExtension, joinExportPath, sanitizeFileStem } from '@shared/exportPath';
import { getExportResolution } from './capabilities';
import type { FrameSlideEngine } from './FrameSlideEngine';
import { computeProjectDurationSec, getTotalFrames } from './timeline';
import { rangeFrameCount, type FrameRange } from './frameRange';
import { loadTextFonts } from './textOverlay';

export interface ExportProgressInfo {
  currentFrame: number;
  totalFrames: number;
  percent: number;
  clipIndex?: number;
  clipCount?: number;
  clipName?: string;
}

export interface ExportSummary {
  codec: ExportCodec;
  totalFrames: number;
  durationMs: number;
  speedFactor: number;
  filePath?: string;
  clipCount?: number;
  failedClips?: { name: string; error: string }[];
}

export class ExportCanceledError extends Error {
  constructor() {
    super('Đã hủy xuất video.');
    this.name = 'ExportCanceledError';
  }
}

async function resolveH264Config(
  width: number,
  height: number,
  fps: number
): Promise<VideoEncoderConfig> {
  const candidates: VideoEncoderConfig[] = [
    {
      codec: 'avc1.64002a',
      width,
      height,
      bitrate: 20_000_000,
      framerate: fps,
      hardwareAcceleration: 'prefer-hardware',
    },
    {
      codec: 'avc1.64002a',
      width,
      height,
      bitrate: 20_000_000,
      framerate: fps,
      hardwareAcceleration: 'no-preference',
    },
    {
      codec: 'avc1.4d002a',
      width,
      height,
      bitrate: 18_000_000,
      framerate: fps,
      hardwareAcceleration: 'no-preference',
    },
  ];

  for (const cfg of candidates) {
    const support = await VideoEncoder.isConfigSupported(cfg);
    if (support.supported) {
      return cfg;
    }
  }
  throw new Error('Trình duyệt/GPU không hỗ trợ WebCodecs H.264 VideoEncoder.');
}

function getEffectiveDurationAndFrames(
  engine: FrameSlideEngine,
  fps: number,
  params: RenderParams
): { effectiveDurationSec: number; totalFrames: number } {
  const scenes = engine.getScenes();
  const effectiveDurationSec = computeProjectDurationSec(scenes, params);
  return {
    effectiveDurationSec,
    totalFrames: getTotalFrames(effectiveDurationSec, fps),
  };
}

/**
 * Frames to export: the whole clip, or only `range` (In/Out, one scene). Frames keep their
 * project index so the film grain etc. match the preview; only the file timestamps restart at 0.
 */
function resolveFrameSpan(totalFrames: number, range?: FrameRange | null): FrameRange {
  if (!range) return { start: 0, end: totalFrames };
  const end = Math.max(0, Math.min(totalFrames, Math.round(range.end)));
  const start = Math.max(0, Math.min(end, Math.round(range.start)));
  return end > start ? { start, end } : { start: 0, end: totalFrames };
}

export async function exportMp4WebCodecs(opts: {
  engine: FrameSlideEngine;
  fps: number;
  params: RenderParams;
  /** Export only these frames (In/Out or one scene). Missing = whole clip. */
  range?: FrameRange | null;
  onProgress?: (info: ExportProgressInfo) => void;
  signal?: AbortSignal;
}): Promise<{ data: Uint8Array; summary: ExportSummary }> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    throw new Error('WebCodecs VideoEncoder không khả dụng trong môi trường này.');
  }

  const { width, height } = getExportResolution(opts.params.outputAspect);
  const { totalFrames: clipFrames } = getEffectiveDurationAndFrames(opts.engine, opts.fps, opts.params);
  const span = resolveFrameSpan(clipFrames, opts.range);
  const totalFrames = rangeFrameCount(span);
  const effectiveDurationSec = totalFrames / opts.fps;
  await opts.engine.whenReady();
  await loadTextFonts(); // text in the video must never fall back to another font
  const prevSize = opts.engine.getSize();

  const encoderConfig = await resolveH264Config(width, height, opts.fps);
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: 'avc',
      width,
      height,
      frameRate: opts.fps,
    },
    fastStart: 'in-memory',
  });

  let encodeError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      const enrichedMeta: EncodedVideoChunkMetadata = meta?.decoderConfig
        ? {
            ...meta,
            decoderConfig: {
              ...meta.decoderConfig,
              colorSpace: meta.decoderConfig.colorSpace ?? {
                primaries: 'bt709',
                transfer: 'iec61966-2-1',
                matrix: 'bt709',
                fullRange: false,
              },
            },
          }
        : (meta ?? {});
      muxer.addVideoChunk(chunk, enrichedMeta);
    },
    error: (err) => {
      encodeError = err instanceof Error ? err : new Error(String(err));
    },
  });
  encoder.configure(encoderConfig);

  const startedAt = performance.now();
  const frameDurationUs = Math.round(1_000_000 / opts.fps);
  const keyFrameInterval = Math.max(1, Math.round(opts.fps));

  try {
    opts.engine.resize(width, height);
    const canvas = opts.engine.getCanvas();

    for (let n = 0; n < totalFrames; n++) {
      const i = span.start + n; // project frame index (deterministic grain etc.)
      if (opts.signal?.aborted) throw new ExportCanceledError();
      if (encodeError) throw encodeError;

      while (encoder.encodeQueueSize > 8) {
        if (opts.signal?.aborted) throw new ExportCanceledError();
        if (encodeError) throw encodeError;
        await new Promise((r) => setTimeout(r, 2));
      }

      await opts.engine.ensureFrameTextures(i, opts.fps, opts.params);
      opts.engine.renderFrame(i, opts.fps, opts.params, 'normal');

      const timestampUs = Math.round((n / opts.fps) * 1_000_000);
      const videoFrame = new VideoFrame(canvas, {
        timestamp: timestampUs,
        duration: frameDurationUs,
      });

      encoder.encode(videoFrame, { keyFrame: n % keyFrameInterval === 0 });
      videoFrame.close();

      if (n % 6 === 0 || n === totalFrames - 1) {
        opts.onProgress?.({
          currentFrame: n + 1,
          totalFrames,
          percent: Math.round(((n + 1) / totalFrames) * 100),
        });
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    await encoder.flush();
    if (encodeError) throw encodeError;
    encoder.close();
    muxer.finalize();

    const durationMs = Math.max(1, Math.round(performance.now() - startedAt));
    const speedFactor = (effectiveDurationSec * 1000) / durationMs;

    return {
      data: new Uint8Array(target.buffer),
      summary: {
        codec: 'h264',
        totalFrames,
        durationMs,
        speedFactor,
      },
    };
  } finally {
    if (encoder.state !== 'closed') {
      try {
        encoder.close();
      } catch {
        // ignore
      }
    }
    opts.engine.resize(prevSize.width, prevSize.height);
  }
}

export async function exportViaFfmpeg(opts: {
  engine: FrameSlideEngine;
  api: FrameSlideAPI;
  codec: ExportCodec;
  fps: number;
  params: RenderParams;
  defaultName: string;
  directFilePath?: string;
  /** Export only these frames (In/Out or one scene). Missing = whole clip. */
  range?: FrameRange | null;
  onProgress?: (info: ExportProgressInfo) => void;
  signal?: AbortSignal;
}): Promise<ExportSummary | null> {
  const { width, height } = getExportResolution(opts.params.outputAspect);
  const { totalFrames: clipFrames } = getEffectiveDurationAndFrames(opts.engine, opts.fps, opts.params);
  const span = resolveFrameSpan(clipFrames, opts.range);
  const totalFrames = rangeFrameCount(span);
  const effectiveDurationSec = totalFrames / opts.fps;
  await opts.engine.whenReady();
  await loadTextFonts(); // text in the video must never fall back to another font
  const prevSize = opts.engine.getSize();

  let jobId: string;
  if (opts.directFilePath) {
    const started = await opts.api.ffmpegExportStartDirect({
      width,
      height,
      fps: opts.fps,
      codec: opts.codec,
      filePath: opts.directFilePath,
    });
    jobId = started.jobId;
  } else {
    const startRes = await opts.api.ffmpegExportStart({
      width,
      height,
      fps: opts.fps,
      codec: opts.codec,
      defaultName: opts.defaultName,
    });
    if (startRes.canceled || !startRes.jobId) {
      return null;
    }
    jobId = startRes.jobId;
  }

  const rgbaBuffer = new Uint8Array(width * height * 4);
  const startedAt = performance.now();

  try {
    opts.engine.resize(width, height);

    for (let n = 0; n < totalFrames; n++) {
      const i = span.start + n;
      if (opts.signal?.aborted) {
        await opts.api.ffmpegExportCancel(jobId);
        throw new ExportCanceledError();
      }

      await opts.engine.ensureFrameTextures(i, opts.fps, opts.params);
      opts.engine.renderFrameToBuffer(i, opts.fps, opts.params, rgbaBuffer);
      await opts.api.ffmpegExportFrame(jobId, rgbaBuffer);

      if (n % 4 === 0 || n === totalFrames - 1) {
        opts.onProgress?.({
          currentFrame: n + 1,
          totalFrames,
          percent: Math.round(((n + 1) / totalFrames) * 100),
        });
      }
    }

    const finishRes = await opts.api.ffmpegExportFinish(jobId);
    const durationMs = Math.max(1, Math.round(performance.now() - startedAt));
    const speedFactor = (effectiveDurationSec * 1000) / durationMs;

    return {
      codec: opts.codec,
      totalFrames,
      durationMs,
      speedFactor,
      filePath: finishRes.filePath,
    };
  } catch (err) {
    await opts.api.ffmpegExportCancel(jobId).catch(() => {});
    throw err;
  } finally {
    opts.engine.resize(prevSize.width, prevSize.height);
  }
}

/**
 * Splits a large slide list into chunks of `slidesPerClip` and exports sequential B-roll clips
 * directly into `outputDir` without prompting for each file.
 */
export async function exportBatchClips(opts: {
  engine: FrameSlideEngine;
  api: FrameSlideAPI;
  allSlides: SlideAsset[];
  allScenes: SceneItem[];
  slidesPerClip: number;
  codec: ExportCodec;
  fps: number;
  params: RenderParams;
  outputDir: string;
  /** Start of each clip's file name (project name); default "FrameSlide". */
  namePrefix?: string;
  onProgress?: (info: ExportProgressInfo) => void;
  signal?: AbortSignal;
}): Promise<ExportSummary> {
  const chunkSize = Math.max(1, Math.floor(opts.slidesPerClip));
  const chunks: SlideAsset[][] = [];
  for (let i = 0; i < opts.allSlides.length; i += chunkSize) {
    chunks.push(opts.allSlides.slice(i, i + chunkSize));
  }

  const startedAt = performance.now();
  let grandTotalFrames = 0;
  let grandDurationSec = 0;
  const ext = opts.codec === 'h264' ? 'mp4' : 'mov';
  const sep = opts.outputDir.includes('\\') ? '\\' : '/';

  try {
    for (let c = 0; c < chunks.length; c++) {
      if (opts.signal?.aborted) throw new ExportCanceledError();
      const clipSlides = chunks[c];
      await opts.engine.setProjectMedia(clipSlides, [], {
        portraitMode: opts.params.portraitMode,
        motionTemplate: opts.params.motionTemplate,
        defaultDurationSec: opts.params.defaultSlideDurationSec,
        defaultTransition: opts.params.transitionType,
      });

      const { effectiveDurationSec } = getEffectiveDurationAndFrames(
        opts.engine,
        opts.fps,
        opts.params
      );
      grandDurationSec += effectiveDurationSec;

      const idxLabel = String(c + 1).padStart(2, '0');
      const fileName = `${opts.namePrefix ?? 'FrameSlide'}_BRoll_${idxLabel}_1080p_${opts.fps}fps.${ext}`;
      // Never overwrite a clip of an earlier batch: "_2", "_3"… (Đợt 6.1).
      const filePath = opts.api.freeExportPath
        ? await opts.api.freeExportPath(opts.outputDir, fileName)
        : `${opts.outputDir}${sep}${fileName}`;

      if (opts.codec === 'h264') {
        const { data, summary } = await exportMp4WebCodecs({
          engine: opts.engine,
          fps: opts.fps,
          params: opts.params,
          signal: opts.signal,
          onProgress: (info) =>
            opts.onProgress?.({ ...info, clipIndex: c + 1, clipCount: chunks.length }),
        });
        await opts.api.saveBinaryToPath(data, filePath);
        grandTotalFrames += summary.totalFrames;
      } else {
        const summary = await exportViaFfmpeg({
          engine: opts.engine,
          api: opts.api,
          codec: opts.codec,
          fps: opts.fps,
          params: opts.params,
          defaultName: filePath,
          directFilePath: filePath,
          signal: opts.signal,
          onProgress: (info) =>
            opts.onProgress?.({ ...info, clipIndex: c + 1, clipCount: chunks.length }),
        });
        if (summary) grandTotalFrames += summary.totalFrames;
      }
    }
  } finally {
    await opts.engine.setProjectMedia(opts.allSlides, opts.allScenes, {
      portraitMode: opts.params.portraitMode,
      motionTemplate: opts.params.motionTemplate,
      defaultDurationSec: opts.params.defaultSlideDurationSec,
      defaultTransition: opts.params.transitionType,
    });
  }

  const durationMs = Math.max(1, Math.round(performance.now() - startedAt));
  return {
    codec: opts.codec,
    totalFrames: grandTotalFrames,
    durationMs,
    speedFactor: (grandDurationSec * 1000) / durationMs,
    filePath: opts.outputDir,
    clipCount: chunks.length,
  };
}

export interface ExportWorkspaceInput {
  id: string;
  name: string;
  slides: SlideAsset[];
  scenes: SceneItem[];
  renderParams: RenderParams;
  customLutPath: string | null;
}

async function applyWorkspaceLut(
  engine: FrameSlideEngine,
  api: FrameSlideAPI,
  customLutPath: string | null
): Promise<void> {
  if (!customLutPath) {
    engine.setCustomCubeLut(null);
    return;
  }
  try {
    const content = await api.readTextFile(customLutPath);
    if (content) {
      engine.setCustomCubeLut(content);
      return;
    }
  } catch {
    // Missing or unreadable LUT falls back to clean output
  }
  engine.setCustomCubeLut(null);
}

/**
 * Exports multiple independent workspace tabs sequentially into one shared `outputDir`,
 * clearing GPU texture caches between workspaces and always restoring the active workspace on exit.
 */
export async function exportWorkspaceBatch(opts: {
  engine: FrameSlideEngine;
  api: FrameSlideAPI;
  workspaces: ExportWorkspaceInput[];
  restoreState: {
    slides: SlideAsset[];
    scenes: SceneItem[];
    renderParams: RenderParams;
    customLutPath: string | null;
  };
  codec: ExportCodec;
  fps: number;
  outputDir: string;
  onProgress?: (info: ExportProgressInfo) => void;
  onWorkspaceDone?: (id: string) => void;
  signal?: AbortSignal;
}): Promise<ExportSummary> {
  const startedAt = performance.now();
  let grandTotalFrames = 0;
  let grandDurationSec = 0;
  let succeeded = 0;
  const failedClips: { name: string; error: string }[] = [];
  const ext = codecExtension(opts.codec);

  try {
    for (let i = 0; i < opts.workspaces.length; i++) {
      if (opts.signal?.aborted) throw new ExportCanceledError();
      const ws = opts.workspaces[i];
      if (ws.scenes.length === 0) continue;

      try {
        opts.engine.clearTextureCache();
        await applyWorkspaceLut(opts.engine, opts.api, ws.customLutPath);
        await opts.engine.setProjectMedia(ws.slides, ws.scenes, {
          portraitMode: ws.renderParams.portraitMode,
          motionTemplate: ws.renderParams.motionTemplate,
          defaultDurationSec: ws.renderParams.defaultSlideDurationSec,
          defaultTransition: ws.renderParams.transitionType,
        });

        const { effectiveDurationSec } = getEffectiveDurationAndFrames(
          opts.engine,
          opts.fps,
          ws.renderParams
        );

        const stem =
          sanitizeFileStem(ws.name) ?? `DuAn_${String(i + 1).padStart(2, '0')}`;
        const fileName = `${stem}.${ext}`;
        const filePath = opts.api.freeExportPath
          ? await opts.api.freeExportPath(opts.outputDir, fileName)
          : joinExportPath(opts.outputDir, fileName);

        const forwardProgress = (info: ExportProgressInfo) =>
          opts.onProgress?.({
            ...info,
            clipIndex: i + 1,
            clipCount: opts.workspaces.length,
            clipName: ws.name,
          });

        if (opts.codec === 'h264') {
          const { data, summary } = await exportMp4WebCodecs({
            engine: opts.engine,
            fps: opts.fps,
            params: ws.renderParams,
            signal: opts.signal,
            onProgress: forwardProgress,
          });
          await opts.api.saveBinaryToPath(data, filePath);
          grandTotalFrames += summary.totalFrames;
        } else {
          const summary = await exportViaFfmpeg({
            engine: opts.engine,
            api: opts.api,
            codec: opts.codec,
            fps: opts.fps,
            params: ws.renderParams,
            defaultName: filePath,
            directFilePath: filePath,
            signal: opts.signal,
            onProgress: forwardProgress,
          });
          if (summary) grandTotalFrames += summary.totalFrames;
        }

        grandDurationSec += effectiveDurationSec;
        succeeded++;
        opts.onWorkspaceDone?.(ws.id);
      } catch (err) {
        if (err instanceof ExportCanceledError) throw err;
        failedClips.push({
          name: ws.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } finally {
    opts.engine.clearTextureCache();
    await applyWorkspaceLut(opts.engine, opts.api, opts.restoreState.customLutPath);
    await opts.engine.setProjectMedia(
      opts.restoreState.slides,
      opts.restoreState.scenes,
      {
        portraitMode: opts.restoreState.renderParams.portraitMode,
        motionTemplate: opts.restoreState.renderParams.motionTemplate,
        defaultDurationSec: opts.restoreState.renderParams.defaultSlideDurationSec,
        defaultTransition: opts.restoreState.renderParams.transitionType,
      }
    );
  }

  if (succeeded === 0 && failedClips.length > 0) {
    throw new Error(
      `Không xuất được dự án nào (${failedClips[0].name}: ${failedClips[0].error})`
    );
  }

  const durationMs = Math.max(1, Math.round(performance.now() - startedAt));
  return {
    codec: opts.codec,
    totalFrames: grandTotalFrames,
    durationMs,
    speedFactor: grandDurationSec > 0 ? (grandDurationSec * 1000) / durationMs : 0,
    filePath: opts.outputDir,
    clipCount: succeeded,
    ...(failedClips.length > 0 ? { failedClips } : {}),
  };
}
