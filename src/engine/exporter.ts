import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import type { ExportCodec, FrameSlideAPI, RenderParams, SceneItem, SlideAsset } from '@shared/types';
import { getExportResolution } from './capabilities';
import type { FrameSlideEngine } from './FrameSlideEngine';
import { computeEffectiveTotalDurationSec, getTotalFrames } from './timeline';

export interface ExportProgressInfo {
  currentFrame: number;
  totalFrames: number;
  percent: number;
  clipIndex?: number;
  clipCount?: number;
}

export interface ExportSummary {
  codec: ExportCodec;
  totalFrames: number;
  durationMs: number;
  speedFactor: number;
  filePath?: string;
  clipCount?: number;
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
  const effectiveDurationSec = computeEffectiveTotalDurationSec(scenes.length, {
    durationMode: params.durationMode,
    totalDurationSec: params.totalDurationSec,
    defaultSlideDurationSec: params.defaultSlideDurationSec,
    slideDurations: scenes.map((s) => s.durationSec),
    handlesSec: params.handlesSec,
  });
  return {
    effectiveDurationSec,
    totalFrames: getTotalFrames(effectiveDurationSec, fps),
  };
}

export async function exportMp4WebCodecs(opts: {
  engine: FrameSlideEngine;
  fps: number;
  params: RenderParams;
  onProgress?: (info: ExportProgressInfo) => void;
  signal?: AbortSignal;
}): Promise<{ data: Uint8Array; summary: ExportSummary }> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    throw new Error('WebCodecs VideoEncoder không khả dụng trong môi trường này.');
  }

  const { width, height } = getExportResolution(opts.params.outputAspect);
  const { effectiveDurationSec, totalFrames } = getEffectiveDurationAndFrames(
    opts.engine,
    opts.fps,
    opts.params
  );
  await opts.engine.whenReady();
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

    for (let i = 0; i < totalFrames; i++) {
      if (opts.signal?.aborted) throw new ExportCanceledError();
      if (encodeError) throw encodeError;

      while (encoder.encodeQueueSize > 8) {
        if (opts.signal?.aborted) throw new ExportCanceledError();
        if (encodeError) throw encodeError;
        await new Promise((r) => setTimeout(r, 2));
      }

      await opts.engine.ensureFrameTextures(i, opts.fps, opts.params);
      opts.engine.renderFrame(i, opts.fps, opts.params, 'normal');

      const timestampUs = Math.round((i / opts.fps) * 1_000_000);
      const videoFrame = new VideoFrame(canvas, {
        timestamp: timestampUs,
        duration: frameDurationUs,
      });

      encoder.encode(videoFrame, { keyFrame: i % keyFrameInterval === 0 });
      videoFrame.close();

      if (i % 6 === 0 || i === totalFrames - 1) {
        opts.onProgress?.({
          currentFrame: i + 1,
          totalFrames,
          percent: Math.round(((i + 1) / totalFrames) * 100),
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
  onProgress?: (info: ExportProgressInfo) => void;
  signal?: AbortSignal;
}): Promise<ExportSummary | null> {
  const { width, height } = getExportResolution(opts.params.outputAspect);
  const { effectiveDurationSec, totalFrames } = getEffectiveDurationAndFrames(
    opts.engine,
    opts.fps,
    opts.params
  );
  await opts.engine.whenReady();
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

    for (let i = 0; i < totalFrames; i++) {
      if (opts.signal?.aborted) {
        await opts.api.ffmpegExportCancel(jobId);
        throw new ExportCanceledError();
      }

      await opts.engine.ensureFrameTextures(i, opts.fps, opts.params);
      opts.engine.renderFrameToBuffer(i, opts.fps, opts.params, rgbaBuffer);
      await opts.api.ffmpegExportFrame(jobId, rgbaBuffer);

      if (i % 4 === 0 || i === totalFrames - 1) {
        opts.onProgress?.({
          currentFrame: i + 1,
          totalFrames,
          percent: Math.round(((i + 1) / totalFrames) * 100),
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
      const filePath = `${opts.outputDir}${sep}FrameSlide_BRoll_${idxLabel}_1080p_${opts.fps}fps.${ext}`;

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
