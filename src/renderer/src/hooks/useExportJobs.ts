import { useRef, useState, type RefObject } from 'react';
import type { FrameSlideEngine } from '@engine/FrameSlideEngine';
import {
  ExportCanceledError,
  exportBatchClips,
  exportMp4WebCodecs,
  exportViaFfmpeg,
  type ExportProgressInfo,
  type ExportSummary,
} from '@engine/exporter';
import type { ExportCodec } from '@shared/types';
import {
  rangeFileSuffix,
  resolveExportRange,
  sceneFrameRange,
  type ExportRangeMode,
  type FrameRange,
} from '@engine/frameRange';
import { computeProjectDurationSec, getTotalFrames, projectDurationInput, resolveSlideDurations } from '@engine/timeline';
import { useAppStore } from '../store/useAppStore';

/** Frames the export covers for the chosen mode (null = whole clip) and the file-name suffix. */
export function currentExportRange(mode: ExportRangeMode): { range: FrameRange | null; suffix: string } {
  const { scenes, renderParams, fps, markIn, markOut, activeSceneId } = useAppStore.getState();
  const totalFrames = getTotalFrames(computeProjectDurationSec(scenes, renderParams), fps);
  const durations = resolveSlideDurations(scenes.length, projectDurationInput(scenes, renderParams));
  const sceneIdx = scenes.findIndex((sc) => sc.id === activeSceneId);
  const range = resolveExportRange(mode, {
    markIn,
    markOut,
    totalFrames,
    sceneRange: sceneFrameRange(sceneIdx, durations, fps),
  });
  return { range, suffix: range ? rangeFileSuffix(range, fps) : '' };
}

function downloadInBrowser(data: Uint8Array, fileName: string): void {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export state (progress, result, errors) + the three export actions (MP4, FFmpeg codec, batch). */
export function useExportJobs(engineRef: RefObject<FrameSlideEngine | null>) {
  const abortRef = useRef<AbortController | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgressInfo | null>(null);
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchSlidesPerClip, setBatchSlidesPerClip] = useState(4);
  const [batchCodec, setBatchCodec] = useState<ExportCodec>('h264');
  /** Whole clip, the In/Out part, or the selected scene (single-clip exports only). */
  const [rangeMode, setRangeMode] = useState<ExportRangeMode>('all');

  /** Shared wrapper: stop playback, reset messages, run the job with an abort signal, clean up. */
  const runJob = async (
    job: (engine: FrameSlideEngine, signal: AbortSignal) => Promise<ExportSummary | null | undefined>
  ) => {
    const engine = engineRef.current;
    if (!engine) return;
    useAppStore.getState().setIsPlaying(false);
    setIsExporting(true);
    setError(null);
    setStatusMsg(null);
    setSummary(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await job(engine, controller.signal);
      if (result) setSummary(result);
    } catch (err) {
      if (err instanceof ExportCanceledError) setStatusMsg(err.message);
      else setError(err instanceof Error ? err.message : String(err));
    } finally {
      abortRef.current = null;
      setProgress(null);
      setIsExporting(false);
    }
  };

  const exportMp4 = async () => {
    const { scenes, fps, renderParams } = useAppStore.getState();
    if (scenes.length === 0) return;
    const { range, suffix } = currentExportRange(rangeMode);
    await runJob(async (engine, signal) => {
      const { data, summary: done } = await exportMp4WebCodecs({
        engine,
        fps,
        params: renderParams,
        range,
        signal,
        onProgress: setProgress,
      });
      const defaultName = `FrameSlide_1080p_${fps}fps${suffix}.mp4`;
      if (!window.frameSlideAPI) {
        downloadInBrowser(data, defaultName);
        return done;
      }
      const saved = await window.frameSlideAPI.saveBinaryFile(data, defaultName);
      return saved.canceled ? null : { ...done, filePath: saved.filePath };
    });
  };

  const exportFfmpeg = async (codec: Exclude<ExportCodec, 'h264'>) => {
    const api = window.frameSlideAPI;
    const { scenes, fps, renderParams } = useAppStore.getState();
    if (!api || scenes.length === 0) return;
    const codecName = codec === 'prores422' ? 'ProRes422' : 'DNxHR_HQ';
    const { range, suffix } = currentExportRange(rangeMode);
    await runJob((engine, signal) =>
      exportViaFfmpeg({
        engine,
        api,
        codec,
        fps,
        params: renderParams,
        range,
        defaultName: `FrameSlide_1080p_${fps}fps_${codecName}${suffix}.mov`,
        signal,
        onProgress: setProgress,
      })
    );
  };

  const exportBatch = async () => {
    const api = window.frameSlideAPI;
    const { slides, scenes, fps, renderParams } = useAppStore.getState();
    if (!engineRef.current || !api || slides.length === 0) return;
    const folderRes = await api.pickOutputFolder();
    if (folderRes.canceled || !folderRes.folderPath) return;
    const outputDir = folderRes.folderPath;
    await runJob((engine, signal) =>
      exportBatchClips({
        engine,
        api,
        allSlides: slides,
        allScenes: scenes,
        slidesPerClip: batchSlidesPerClip,
        codec: batchCodec,
        fps,
        params: renderParams,
        outputDir,
        signal,
        onProgress: setProgress,
      })
    );
  };

  return {
    isExporting,
    progress,
    summary,
    statusMsg,
    error,
    setError,
    batchSlidesPerClip,
    setBatchSlidesPerClip,
    batchCodec,
    setBatchCodec,
    rangeMode,
    setRangeMode,
    cancel: () => abortRef.current?.abort(),
    exportMp4,
    exportFfmpeg,
    exportBatch,
  };
}

export type ExportJobs = ReturnType<typeof useExportJobs>;
