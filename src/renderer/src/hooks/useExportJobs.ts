import { useEffect, useRef, useState, type RefObject } from 'react';
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
import { usePrefsStore } from '../store/usePrefsStore';
import { codecExtension, defaultExportStem, pathStem, sanitizeFileStem } from '@shared/exportPath';

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
  /** Folder the dialog shows: the chosen one, else the Videos folder (Đợt 6.1). */
  const exportFolderPref = usePrefsStore((p) => p.exportFolder);
  const [defaultFolder, setDefaultFolder] = useState('');
  useEffect(() => {
    window.frameSlideAPI
      ?.getDefaultExportFolder()
      .then(setDefaultFolder)
      .catch(() => {});
  }, []);
  const outputFolder = exportFolderPref || defaultFolder;
  /** File name typed by the user (no extension); '' = the suggested name. */
  const [fileStem, setFileStem] = useState('');
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

  /** The name the clip gets when the user typed none (project name + fps + part). */
  const suggestedStem = (codec: ExportCodec) => {
    const { fps, projectFilePath } = useAppStore.getState();
    return defaultExportStem({ projectFilePath, codec, fps, rangeSuffix: currentExportRange(rangeMode).suffix });
  };

  const pickFolder = async () => {
    const api = window.frameSlideAPI;
    if (!api) return;
    const res = await api.pickOutputFolder(outputFolder || undefined);
    if (!res.canceled && res.folderPath) usePrefsStore.getState().setPrefs({ exportFolder: res.folderPath });
  };

  const revealWhenDone = (filePath: string | undefined) => {
    if (filePath && usePrefsStore.getState().openFolderAfterExport) {
      void window.frameSlideAPI?.revealInFolder(filePath);
    }
  };

  /** One clip in the chosen format, straight into the chosen folder (no save dialog). */
  const exportSingle = async () => {
    const api = window.frameSlideAPI;
    const { scenes, fps, renderParams } = useAppStore.getState();
    if (scenes.length === 0) return;
    const codec = usePrefsStore.getState().exportCodec;
    const { range } = currentExportRange(rangeMode);
    const fileName = `${sanitizeFileStem(fileStem) ?? suggestedStem(codec)}.${codecExtension(codec)}`;
    if (!api) {
      if (codec !== 'h264') return;
      await runJob(async (engine, signal) => {
        const { data, summary: done } = await exportMp4WebCodecs({ engine, fps, params: renderParams, range, signal, onProgress: setProgress });
        downloadInBrowser(data, fileName);
        return done;
      });
      return;
    }
    if (!outputFolder) {
      setError('Chưa chọn thư mục lưu. Bấm "Đổi thư mục…" để chọn.');
      return;
    }
    await runJob(async (engine, signal) => {
      const filePath = await api.freeExportPath(outputFolder, fileName);
      let result: ExportSummary | null;
      if (codec === 'h264') {
        const { data, summary: done } = await exportMp4WebCodecs({ engine, fps, params: renderParams, range, signal, onProgress: setProgress });
        await api.saveBinaryToPath(data, filePath);
        result = { ...done, filePath };
      } else {
        result = await exportViaFfmpeg({
          engine,
          api,
          codec,
          fps,
          params: renderParams,
          range,
          defaultName: fileName,
          directFilePath: filePath,
          signal,
          onProgress: setProgress,
        });
      }
      revealWhenDone(result?.filePath);
      return result;
    });
  };

  const exportBatch = async () => {
    const api = window.frameSlideAPI;
    const { slides, scenes, fps, renderParams, projectFilePath } = useAppStore.getState();
    if (!engineRef.current || !api || slides.length === 0) return;
    if (!outputFolder) {
      setError('Chưa chọn thư mục lưu. Bấm "Đổi thư mục…" để chọn.');
      return;
    }
    const outputDir = outputFolder;
    await runJob(async (engine, signal) => {
      const result = await exportBatchClips({
        engine,
        api,
        allSlides: slides,
        allScenes: scenes,
        slidesPerClip: batchSlidesPerClip,
        codec: usePrefsStore.getState().exportCodec,
        fps,
        params: renderParams,
        outputDir,
        namePrefix: pathStem(projectFilePath) ?? undefined,
        signal,
        onProgress: setProgress,
      });
      if (usePrefsStore.getState().openFolderAfterExport) void api.openFolder(outputDir);
      return result;
    });
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
    outputFolder,
    pickFolder,
    fileStem,
    setFileStem,
    suggestedStem,
    rangeMode,
    setRangeMode,
    cancel: () => abortRef.current?.abort(),
    exportSingle,
    exportBatch,
  };
}

export type ExportJobs = ReturnType<typeof useExportJobs>;
