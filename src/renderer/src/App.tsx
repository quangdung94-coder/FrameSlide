import { useEffect, useMemo, useRef, useState } from 'react';
import { FrameSlideEngine } from '@engine/FrameSlideEngine';
import { getExportResolution, resolvePreviewResolution } from '@engine/capabilities';
import {
  ExportCanceledError,
  exportBatchClips,
  exportMp4WebCodecs,
  exportViaFfmpeg,
  type ExportProgressInfo,
  type ExportSummary,
} from '@engine/exporter';
import { FILM_LOOK_PRESETS } from '@engine/presets/filmLookPresets';
import { MOTION_TEMPLATE_PRESETS } from '@engine/presets/motionTemplates';
import { TRANSITION_PRESETS } from '@engine/presets/transitions';
import { computeEffectiveTotalDurationSec, getTotalFrames } from '@engine/timeline';
import { BackgroundPanel } from './components/BackgroundPanel';
import { PhotoBin } from './components/PhotoBin';
import { PhotoTransformOverlay } from './components/PhotoTransformOverlay';
import { Splitter } from './components/Splitter';
import { Group, SliderRow } from './components/ui';
import { DEFAULT_LAYOUT, useLayoutStore } from './store/useLayoutStore';
import { PlaybackBar } from './components/PlaybackBar';
import { SceneTrack } from './components/SceneTrack';
import { useAppStore } from './store/useAppStore';
import type {
  AppInfo,
  AspectMaskId,
  DurationMode,
  ExportCodec,
  FrameBorderStyle,
  FrameSlideAPI,
  MotionDirection,
  OutputAspectId,
  PortraitMode,
  PreviewQuality,
  ProjectFileData,
  SlideAsset,
  SupportedFps,
  TextStyleId,
  TextTimingMode,
  TransitionType,
} from '@shared/types';

declare global {
  interface Window {
    frameSlideAPI?: FrameSlideAPI;
    frameSlideGetFilePath?: (file: File) => string;
  }
}

type InspectorTab = 'template' | 'look' | 'text' | 'export';

const FPS_OPTIONS: SupportedFps[] = [23.976, 24, 25, 30];
const DURATION_OPTIONS = [10, 15, 20, 30];
const HANDLES_OPTIONS = [0, 0.5, 1.0];
const QUALITY_OPTIONS: { value: PreviewQuality; label: string }[] = [
  { value: 'auto', label: 'Tự động' },
  { value: 'half', label: 'Nửa (540p)' },
  { value: 'full', label: 'Đầy đủ (1080p)' },
];

function createBrowserFallbackSamples(): SlideAsset[] {
  const makeSvg = (w: number, h: number, bg1: string, bg2: string, accent: string, label: string) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${bg1}"/><stop offset="100%" stop-color="${bg2}"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <circle cx="${Math.round(w * 0.65)}" cy="${Math.round(h * 0.35)}" r="${Math.round(Math.min(w, h) * 0.14)}" fill="${accent}"/>
      <text x="50%" y="85%" fill="#ffffff" fill-opacity="0.7" font-family="sans-serif" font-size="48" text-anchor="middle">${label}</text>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };

  return [
    {
      id: 'web-1',
      name: 'Sample_01_Ngang.jpg',
      originalPath: '',
      proxyUrl: makeSvg(1920, 1280, '#2a2038', '#c96f3c', '#fff7df', 'GOLDEN HOUR 16:9'),
      thumbUrl: makeSvg(320, 213, '#2a2038', '#c96f3c', '#fff7df', '01'),
      width: 1920,
      height: 1280,
      orientation: 'landscape',
      takenAtMs: 1700000001000,
      focalPoint: { x: 0.5, y: 0.5 },
    },
    {
      id: 'web-2',
      name: 'Sample_02_DocA.jpg',
      originalPath: '',
      proxyUrl: makeSvg(1280, 1920, '#2b362e', '#61503e', '#fff4d2', 'PORTRAIT A'),
      thumbUrl: makeSvg(213, 320, '#2b362e', '#61503e', '#fff4d2', '02'),
      width: 1280,
      height: 1920,
      orientation: 'portrait',
      takenAtMs: 1700000002000,
      focalPoint: { x: 0.5, y: 0.36 },
    },
    {
      id: 'web-3',
      name: 'Sample_03_DocB.jpg',
      originalPath: '',
      proxyUrl: makeSvg(1280, 1920, '#3c2f2f', '#7c5c4c', '#ffd599', 'PORTRAIT B'),
      thumbUrl: makeSvg(213, 320, '#3c2f2f', '#7c5c4c', '#ffd599', '03'),
      width: 1280,
      height: 1920,
      orientation: 'portrait',
      takenAtMs: 1700000003000,
      focalPoint: { x: 0.5, y: 0.36 },
    },
    {
      id: 'web-4',
      name: 'Sample_04_Ngang.jpg',
      originalPath: '',
      proxyUrl: makeSvg(1920, 1280, '#0f172a', '#24344d', '#ffd782', 'EVENING LIGHTS'),
      thumbUrl: makeSvg(320, 213, '#0f172a', '#24344d', '#ffd782', '04'),
      width: 1920,
      height: 1280,
      orientation: 'landscape',
      takenAtMs: 1700000004000,
      focalPoint: { x: 0.5, y: 0.5 },
    },
  ];
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<FrameSlideEngine | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);

  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [loadingSlides, setLoadingSlides] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [liveFps, setLiveFps] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<InspectorTab>('template');
  const [focalPickMode, setFocalPickMode] = useState(false);
  const [transformEditMode, setTransformEditMode] = useState(false);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [presetNameDraft, setPresetNameDraft] = useState('');
  const [autosaveBanner, setAutosaveBanner] = useState<ProjectFileData | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const [batchSlidesPerClip, setBatchSlidesPerClip] = useState(4);
  const [batchCodec, setBatchCodec] = useState<ExportCodec>('h264');

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgressInfo | null>(null);
  const [exportSummary, setExportSummary] = useState<ExportSummary | null>(null);
  const [exportStatusMsg, setExportStatusMsg] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const fps = useAppStore((s) => s.fps);
  const previewQuality = useAppStore((s) => s.previewQuality);
  const compareMode = useAppStore((s) => s.compareMode);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const slides = useAppStore((s) => s.slides);
  const scenes = useAppStore((s) => s.scenes);
  const binWidth = useLayoutStore((s) => s.binWidth);
  const inspectorWidth = useLayoutStore((s) => s.inspectorWidth);
  const timelineHeight = useLayoutStore((s) => s.timelineHeight);
  const setLayout = useLayoutStore((s) => s.setLayout);
  const resetLayout = useLayoutStore((s) => s.resetLayout);
  const layoutDragBase = useRef(0);
  // Never let the timeline squeeze the preview below ~220px on small windows.
  const effectiveTimelineHeight = Math.max(
    170,
    Math.min(timelineHeight, typeof window !== 'undefined' ? window.innerHeight - 330 : timelineHeight)
  );
  const activeSceneId = useAppStore((s) => s.activeSceneId);
  const activeSlotIndex = useAppStore((s) => s.activeSlotIndex);
  const selectedPhotoId = useAppStore((s) => s.selectedPhotoId);
  const renderParams = useAppStore((s) => s.renderParams);
  const engineCapabilities = useAppStore((s) => s.engineCapabilities);
  const customLut = useAppStore((s) => s.customLut);
  const userPresets = useAppStore((s) => s.userPresets);
  const projectFilePath = useAppStore((s) => s.projectFilePath);
  const canUndo = useAppStore((s) => s.past.length > 0);
  const canRedo = useAppStore((s) => s.future.length > 0);

  const setFps = useAppStore((s) => s.setFps);
  const setPreviewQuality = useAppStore((s) => s.setPreviewQuality);
  const setCompareMode = useAppStore((s) => s.setCompareMode);
  const setIsPlaying = useAppStore((s) => s.setIsPlaying);
  const setSlides = useAppStore((s) => s.setSlides);
  const addPhotosToBin = useAppStore((s) => s.addPhotosToBin);
  const updatePhotoFocalPoint = useAppStore((s) => s.updatePhotoFocalPoint);
  const rotatePhoto90 = useAppStore((s) => s.rotatePhoto90);
  const setPhotoExposure = useAppStore((s) => s.setPhotoExposure);
  const setSceneMotionDirection = useAppStore((s) => s.setSceneMotionDirection);
  const setSceneCaption = useAppStore((s) => s.setSceneCaption);
  const applyMotionTemplate = useAppStore((s) => s.applyMotionTemplate);
  const applyFilmLookPreset = useAppStore((s) => s.applyFilmLookPreset);
  const setMotionIntensity = useAppStore((s) => s.setMotionIntensity);
  const setFrameBorderStyle = useAppStore((s) => s.setFrameBorderStyle);
  const setOutputAspect = useAppStore((s) => s.setOutputAspect);
  const setDurationMode = useAppStore((s) => s.setDurationMode);
  const setTotalDurationSec = useAppStore((s) => s.setTotalDurationSec);
  const setDefaultSlideDurationSec = useAppStore((s) => s.setDefaultSlideDurationSec);
  const setHandlesSec = useAppStore((s) => s.setHandlesSec);
  const setVideoFadeInSec = useAppStore((s) => s.setVideoFadeInSec);
  const setVideoFadeOutSec = useAppStore((s) => s.setVideoFadeOutSec);
  const setTransitionType = useAppStore((s) => s.setTransitionType);
  const setTransitionDurationSec = useAppStore((s) => s.setTransitionDurationSec);
  const setPortraitMode = useAppStore((s) => s.setPortraitMode);
  const updateSuper8 = useAppStore((s) => s.updateSuper8);
  const setLutIntensity = useAppStore((s) => s.setLutIntensity);
  const setCustomLut = useAppStore((s) => s.setCustomLut);
  const updateTextOverlay = useAppStore((s) => s.updateTextOverlay);
  const saveUserPreset = useAppStore((s) => s.saveUserPreset);
  const deleteUserPreset = useAppStore((s) => s.deleteUserPreset);
  const applyUserPreset = useAppStore((s) => s.applyUserPreset);
  const setProjectFilePath = useAppStore((s) => s.setProjectFilePath);
  const loadProjectData = useAppStore((s) => s.loadProjectData);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const setEngineCapabilities = useAppStore((s) => s.setEngineCapabilities);

  // Right-click menu on a photo slot ("Đặt tâm điểm") asks the preview to enter focal-point mode.
  useEffect(() => {
    const onFocalPick = () => {
      setTransformEditMode(false);
      setFocalPickMode(true);
    };
    window.addEventListener('frameslide:focal-pick', onFocalPick);
    return () => window.removeEventListener('frameslide:focal-pick', onFocalPick);
  }, []);

  // Starting playback leaves the photo editor (handles would not follow the motion).
  useEffect(() => {
    if (isPlaying) setTransformEditMode(false);
  }, [isPlaying]);

  const activeScene = useMemo(
    () => scenes.find((sc) => sc.id === activeSceneId) ?? scenes[0] ?? null,
    [scenes, activeSceneId]
  );

  const focalTargetPhoto = useMemo(() => {
    if (selectedPhotoId) {
      const sel = slides.find((p) => p.id === selectedPhotoId);
      if (sel) return sel;
    }
    const slotPid =
      activeScene?.slots[activeSlotIndex] ??
      activeScene?.slots.find((id) => id !== null) ??
      null;
    return slotPid ? slides.find((p) => p.id === slotPid) ?? null : null;
  }, [selectedPhotoId, activeScene, activeSlotIndex, slides]);

  const effectiveDurationSec = useMemo(
    () =>
      computeEffectiveTotalDurationSec(scenes.length, {
        durationMode: renderParams.durationMode,
        totalDurationSec: renderParams.totalDurationSec,
        defaultSlideDurationSec: renderParams.defaultSlideDurationSec,
        slideDurations: scenes.map((sc) => sc.durationSec),
        handlesSec: renderParams.handlesSec,
      }),
    [scenes, renderParams]
  );

  const totalFrames = useMemo(
    () => getTotalFrames(effectiveDurationSec, fps),
    [effectiveDurationSec, fps]
  );

  const resolvedSize = useMemo(
    () => resolvePreviewResolution(previewQuality, engineCapabilities, renderParams.outputAspect),
    [previewQuality, engineCapabilities, renderParams.outputAspect]
  );

  const exportRes = useMemo(
    () => getExportResolution(renderParams.outputAspect),
    [renderParams.outputAspect]
  );

  useEffect(() => {
    window.frameSlideAPI?.getAppInfo().then(setAppInfo).catch(() => {});
    window.frameSlideAPI
      ?.loadAutosave()
      .then((saved) => {
        if (saved && saved.slides.length > 0) setAutosaveBanner(saved);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!window.frameSlideAPI) return;
    const timer = setInterval(() => {
      const state = useAppStore.getState();
      if (state.slides.length > 0) {
        void window.frameSlideAPI?.writeAutosave(state.toProjectFileData());
      }
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let prevCompareBeforeHold: 'normal' | 'before' | 'split' | null = null;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

      if (e.key === 'Escape') {
        if (isFullscreenPreview) setIsFullscreenPreview(false);
        if (showShortcutsModal) setShowShortcutsModal(false);
        if (focalPickMode) setFocalPickMode(false);
        if (transformEditMode && !inInput) setTransformEditMode(false);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        if (inInput) return;
        e.preventDefault();
        useAppStore.getState().undo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))
      ) {
        if (inInput) return;
        e.preventDefault();
        useAppStore.getState().redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSaveProject();
      } else if (e.code === 'Space' && !inInput && !isExporting) {
        e.preventDefault();
        const s = useAppStore.getState();
        s.setIsPlaying(!s.isPlaying);
      } else if (!inInput && !isExporting && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsFullscreenPreview((v) => !v);
      } else if (!inInput && !isExporting && e.key === '\\' && !e.repeat) {
        e.preventDefault();
        const s = useAppStore.getState();
        prevCompareBeforeHold = s.compareMode;
        s.setCompareMode('before');
      } else if (!inInput && !isExporting && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        const s = useAppStore.getState();
        if (e.shiftKey && s.scenes.length > 0) {
          const curIdx = Math.max(0, s.scenes.findIndex((sc) => sc.id === s.activeSceneId));
          const nextIdx =
            e.key === 'ArrowLeft'
              ? Math.max(0, curIdx - 1)
              : Math.min(s.scenes.length - 1, curIdx + 1);
          s.selectSceneAndSeek(s.scenes[nextIdx].id, 0);
        } else {
          s.setIsPlaying(false);
          const delta = e.key === 'ArrowLeft' ? -1 : 1;
          s.setFrameIndex(Math.max(0, Math.min(Math.max(0, totalFrames - 1), s.frameIndex + delta)));
        }
      } else if (!inInput && !isExporting && e.key === 'Delete') {
        const s = useAppStore.getState();
        if (s.activeSceneId && s.scenes.length > 1) {
          s.removeScene(s.activeSceneId);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === '\\' && prevCompareBeforeHold !== null) {
        useAppStore.getState().setCompareMode(prevCompareBeforeHold);
        prevCompareBeforeHold = null;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isExporting, isFullscreenPreview, showShortcutsModal, focalPickMode, transformEditMode, totalFrames]);

  useEffect(() => {
    let active = true;
    const initSamples = async () => {
      setLoadingSlides(true);
      try {
        const loaded = window.frameSlideAPI
          ? await window.frameSlideAPI.loadSampleImages()
          : createBrowserFallbackSamples();
        if (active) setSlides(loaded, false);
      } catch {
        if (active) setSlides(createBrowserFallbackSamples(), false);
      } finally {
        if (active) setLoadingSlides(false);
      }
    };
    void initSamples();
    return () => {
      active = false;
    };
  }, [setSlides]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initialState = useAppStore.getState();
    const initialSize = resolvePreviewResolution(
      initialState.previewQuality,
      initialState.engineCapabilities,
      initialState.renderParams.outputAspect
    );

    const engine = new FrameSlideEngine({
      canvas,
      width: initialSize.width,
      height: initialSize.height,
      onContextLost: () => setContextLost(true),
      onShadersReady: () => {
        const s = useAppStore.getState();
        engineRef.current?.renderFrame(s.frameIndex, s.fps, s.renderParams, s.compareMode);
      },
      onContextRestored: () => {
        setContextLost(false);
        const s = useAppStore.getState();
        engine.renderFrame(s.frameIndex, s.fps, s.renderParams, s.compareMode);
      },
    });

    engineRef.current = engine;
    const caps = engine.getCapabilities();
    setEngineCapabilities(caps);

    const adaptedSize = resolvePreviewResolution(
      initialState.previewQuality,
      caps,
      initialState.renderParams.outputAspect
    );
    engine.resize(adaptedSize.width, adaptedSize.height);
    engine.renderFrame(
      initialState.frameIndex,
      initialState.fps,
      initialState.renderParams,
      initialState.compareMode
    );

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [setEngineCapabilities]);

  // Sync photos + SceneTrack to GPU
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    let cancelled = false;
    engine
      .setProjectMedia(slides, scenes, {
        portraitMode: renderParams.portraitMode,
        motionTemplate: renderParams.motionTemplate,
        defaultDurationSec: renderParams.defaultSlideDurationSec,
        defaultTransition: renderParams.transitionType,
      })
      .then(() => {
        if (cancelled) return;
        const s = useAppStore.getState();
        engine.renderFrame(s.frameIndex, s.fps, s.renderParams, s.compareMode);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [
    slides,
    scenes,
    renderParams.portraitMode,
    renderParams.motionTemplate,
    renderParams.defaultSlideDurationSec,
    renderParams.transitionType,
  ]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || isExporting) return;
    engine.resize(resolvedSize.width, resolvedSize.height);
    const s = useAppStore.getState();
    engine.renderFrame(s.frameIndex, s.fps, s.renderParams, s.compareMode);
  }, [resolvedSize.width, resolvedSize.height, isExporting]);

  useEffect(() => {
    if (isPlaying || isExporting) return;
    const s = useAppStore.getState();
    engineRef.current?.renderFrame(s.frameIndex, s.fps, s.renderParams, s.compareMode);

    const unsub = useAppStore.subscribe((state, prev) => {
      if (state.isPlaying || isExporting) return;
      if (
        state.frameIndex !== prev.frameIndex ||
        state.renderParams !== prev.renderParams ||
        state.fps !== prev.fps ||
        state.compareMode !== prev.compareMode
      ) {
        const sceneIdx = engineRef.current?.renderFrame(
          state.frameIndex,
          state.fps,
          state.renderParams,
          state.compareMode
        );
        if (sceneIdx !== undefined && state.frameIndex !== prev.frameIndex) {
          const sc = state.scenes[sceneIdx];
          if (sc) state.setActiveSceneSilent(sc.id);
        }
      }
    });
    return unsub;
  }, [isPlaying, isExporting, renderParams, fps, compareMode]);

  useEffect(() => {
    if (!isPlaying || isExporting) {
      setLiveFps(null);
      return;
    }

    let rafId = 0;
    const startWallMs = performance.now();
    const startFrame = useAppStore.getState().frameIndex;
    let renderedCount = 0;
    let fpsWindowStart = startWallMs;

    const tick = (now: number) => {
      const s = useAppStore.getState();
      const effDur = computeEffectiveTotalDurationSec(s.scenes.length, {
        durationMode: s.renderParams.durationMode,
        totalDurationSec: s.renderParams.totalDurationSec,
        defaultSlideDurationSec: s.renderParams.defaultSlideDurationSec,
        slideDurations: s.scenes.map((sc) => sc.durationSec),
        handlesSec: s.renderParams.handlesSec,
      });
      const total = getTotalFrames(effDur, s.fps);
      const elapsedSec = (now - startWallMs) / 1000;
      const nextFrame = (startFrame + Math.floor(elapsedSec * s.fps)) % total;

      const sceneIdx = engineRef.current?.renderFrame(
        nextFrame,
        s.fps,
        s.renderParams,
        s.compareMode
      );
      s.setFrameIndex(nextFrame);
      if (sceneIdx !== undefined && s.scenes[sceneIdx]) {
        s.setActiveSceneSilent(s.scenes[sceneIdx].id);
      }

      renderedCount++;
      const windowMs = now - fpsWindowStart;
      if (windowMs >= 500) {
        setLiveFps(Math.round((renderedCount * 1000) / windowMs));
        renderedCount = 0;
        fpsWindowStart = now;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, isExporting, fps, effectiveDurationSec]);

  const flashNotice = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice((curr) => (curr === msg ? null : curr)), 3500);
  };

  const binImportNotice = (total: number, added: number) =>
    added === 0
      ? `${total} ảnh này đã có sẵn trong khay.`
      : `Đã thêm ${added} ảnh vào khay. Chọn ảnh rồi bấm "Thêm ảnh đã chọn" hoặc "Thêm cả thư mục" để đưa lên timeline.`;

  const handleLoadSamples = async () => {
    setIsPlaying(false);
    setLoadingSlides(true);
    try {
      const loaded = window.frameSlideAPI
        ? await window.frameSlideAPI.loadSampleImages()
        : createBrowserFallbackSamples();
      setSlides(loaded, true);
    } finally {
      setLoadingSlides(false);
    }
  };

  const handlePickImages = async () => {
    if (!window.frameSlideAPI) return;
    setIsPlaying(false);
    setLoadingSlides(true);
    try {
      const picked = await window.frameSlideAPI.pickImages();
      if (picked.length > 0) {
        const added = addPhotosToBin(picked);
        flashNotice(binImportNotice(picked.length, added));
      }
    } finally {
      setLoadingSlides(false);
    }
  };

  const handlePickFolder = async () => {
    if (!window.frameSlideAPI) return;
    setIsPlaying(false);
    setLoadingSlides(true);
    try {
      const picked = await window.frameSlideAPI.pickFolderImages();
      if (picked.length > 0) {
        const added = addPhotosToBin(picked);
        flashNotice(binImportNotice(picked.length, added));
      }
    } finally {
      setLoadingSlides(false);
    }
  };

  const handleWindowDrop = async (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-frameslide')) return;
    e.preventDefault();
    setIsDraggingFiles(false);
    if (!window.frameSlideAPI || !window.frameSlideGetFilePath || isExporting) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const paths = files.map((f) => window.frameSlideGetFilePath!(f)).filter(Boolean);
    if (paths.length === 0) return;

    setIsPlaying(false);
    setLoadingSlides(true);
    try {
      const imported = await window.frameSlideAPI.importPaths(paths);
      if (imported.length > 0) {
        const added = addPhotosToBin(imported);
        flashNotice(binImportNotice(imported.length, added));
      }
    } finally {
      setLoadingSlides(false);
    }
  };

  const handlePickCubeLut = async () => {
    if (!window.frameSlideAPI || !engineRef.current) return;
    const res = await window.frameSlideAPI.pickCubeLut();
    if (res.canceled || !res.content || !res.filePath) return;

    try {
      const parsed = engineRef.current.setCustomCubeLut(res.content);
      if (parsed) {
        setCustomLut({ name: res.name ?? parsed.title, filePath: res.filePath, size: parsed.size });
        const s = useAppStore.getState();
        engineRef.current.renderFrame(s.frameIndex, s.fps, s.renderParams);
        flashNotice(`Đã nạp 3D LUT ${res.name} (${parsed.size}³).`);
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleClearLut = () => {
    engineRef.current?.setCustomCubeLut(null);
    setCustomLut(null);
    const s = useAppStore.getState();
    engineRef.current?.renderFrame(s.frameIndex, s.fps, s.renderParams);
  };

  const handleSaveProject = async () => {
    if (!window.frameSlideAPI) return;
    const state = useAppStore.getState();
    const res = await window.frameSlideAPI.saveProject(
      state.toProjectFileData(),
      state.projectFilePath
    );
    if (!res.canceled && res.filePath) {
      setProjectFilePath(res.filePath);
      flashNotice('Đã lưu dự án (.frameslide).');
    }
  };

  const restoreProjectState = async (data: ProjectFileData, filePath: string | null) => {
    setIsPlaying(false);
    setLoadingSlides(true);
    try {
      const rehydratedSlides = window.frameSlideAPI
        ? await window.frameSlideAPI.rehydrateSlides(data.slides)
        : data.slides;
      loadProjectData({ ...data, slides: rehydratedSlides }, filePath);

      let lutRestored = false;
      if (data.customLutPath && window.frameSlideAPI) {
        const content = await window.frameSlideAPI.readTextFile(data.customLutPath);
        if (content && engineRef.current) {
          try {
            const parsed = engineRef.current.setCustomCubeLut(content);
            if (parsed) {
              setCustomLut({
                name: parsed.title,
                filePath: data.customLutPath,
                size: parsed.size,
              });
              lutRestored = true;
            }
          } catch {
            // Broken / moved .cube file: fall through and clear the LUT below
          }
        }
        if (!lutRestored) {
          flashNotice('Không tìm thấy file LUT của dự án, đã tắt LUT.');
        }
      }
      // Never keep the previous project's LUT active when this project has none (or it is missing)
      if (!lutRestored) handleClearLut();
    } finally {
      setLoadingSlides(false);
    }
  };

  const handleOpenProject = async () => {
    if (!window.frameSlideAPI) return;
    try {
      const res = await window.frameSlideAPI.openProject();
      if (res.canceled || !res.data) return;
      await restoreProjectState(res.data, res.filePath ?? null);
      flashNotice('Đã mở dự án thành công.');
    } catch (err) {
      setExportError(
        `Không mở được dự án (file .frameslide bị hỏng hoặc sai định dạng): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!focalPickMode || !focalTargetPhoto) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0.15, Math.min(0.85, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0.15, Math.min(0.85, (e.clientY - rect.top) / rect.height));
    updatePhotoFocalPoint(focalTargetPhoto.id, { x, y });
    flashNotice(`Đã đặt tâm ảnh ${focalTargetPhoto.name} (${Math.round(x * 100)}%, ${Math.round(y * 100)}%)`);
  };

  const handleExportMp4 = async () => {
    const engine = engineRef.current;
    if (!engine || scenes.length === 0) return;

    setIsPlaying(false);
    setIsExporting(true);
    setExportError(null);
    setExportStatusMsg(null);
    setExportSummary(null);
    const controller = new AbortController();
    exportAbortRef.current = controller;

    try {
      const { data, summary } = await exportMp4WebCodecs({
        engine,
        fps,
        params: renderParams,
        signal: controller.signal,
        onProgress: setExportProgress,
      });

      const defaultName = `FrameSlide_1080p_${fps}fps.mp4`;
      if (window.frameSlideAPI) {
        const saved = await window.frameSlideAPI.saveBinaryFile(data, defaultName);
        if (!saved.canceled) setExportSummary({ ...summary, filePath: saved.filePath });
      } else {
        const blob = new Blob([data.buffer as ArrayBuffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultName;
        a.click();
        URL.revokeObjectURL(url);
        setExportSummary(summary);
      }
    } catch (err) {
      if (err instanceof ExportCanceledError) setExportStatusMsg(err.message);
      else setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      exportAbortRef.current = null;
      setExportProgress(null);
      setIsExporting(false);
    }
  };

  const handleExportFfmpegCodec = async (codec: Exclude<ExportCodec, 'h264'>) => {
    const engine = engineRef.current;
    const api = window.frameSlideAPI;
    if (!engine || !api || scenes.length === 0) return;

    setIsPlaying(false);
    setIsExporting(true);
    setExportError(null);
    setExportStatusMsg(null);
    setExportSummary(null);
    const controller = new AbortController();
    exportAbortRef.current = controller;

    const suffix = codec === 'prores422' ? 'ProRes422' : 'DNxHR_HQ';

    try {
      const summary = await exportViaFfmpeg({
        engine,
        api,
        codec,
        fps,
        params: renderParams,
        defaultName: `FrameSlide_1080p_${fps}fps_${suffix}.mov`,
        signal: controller.signal,
        onProgress: setExportProgress,
      });
      if (summary) setExportSummary(summary);
    } catch (err) {
      if (err instanceof ExportCanceledError) setExportStatusMsg(err.message);
      else setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      exportAbortRef.current = null;
      setExportProgress(null);
      setIsExporting(false);
    }
  };

  const handleBatchExport = async () => {
    const engine = engineRef.current;
    const api = window.frameSlideAPI;
    if (!engine || !api || slides.length === 0) return;

    const folderRes = await api.pickOutputFolder();
    if (folderRes.canceled || !folderRes.folderPath) return;

    setIsPlaying(false);
    setIsExporting(true);
    setExportError(null);
    setExportStatusMsg(null);
    setExportSummary(null);
    const controller = new AbortController();
    exportAbortRef.current = controller;

    try {
      const summary = await exportBatchClips({
        engine,
        api,
        allSlides: slides,
        allScenes: scenes,
        slidesPerClip: batchSlidesPerClip,
        codec: batchCodec,
        fps,
        params: renderParams,
        outputDir: folderRes.folderPath,
        signal: controller.signal,
        onProgress: setExportProgress,
      });
      setExportSummary(summary);
    } catch (err) {
      if (err instanceof ExportCanceledError) setExportStatusMsg(err.message);
      else setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      exportAbortRef.current = null;
      setExportProgress(null);
      setIsExporting(false);
    }
  };

  const showIntegratedWarning =
    engineCapabilities?.gpuTier === 'integrated' || engineCapabilities?.gpuTier === 'software';
  const look = renderParams.super8;
  const textOverlay = renderParams.textOverlay;

  return (
    <div
      className="flex h-screen flex-col bg-[#0f0f12] text-zinc-100"
      onDragOver={(e) => {
        if (
          e.dataTransfer.types.includes('Files') &&
          !e.dataTransfer.types.includes('application/x-frameslide') &&
          !e.dataTransfer.types.includes('application/x-frameslide-scene')
        ) {
          e.preventDefault();
          setIsDraggingFiles(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setIsDraggingFiles(false);
        }
      }}
      onDrop={handleWindowDrop}
    >
      {/* Top Toolbar */}
      <header className="flex items-center justify-between border-b border-zinc-800 bg-[#16161b] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-wide text-amber-400">FRAMESLIDE</span>
          <div className="h-4 w-px bg-zinc-700" />
          <button
            onClick={handlePickImages}
            disabled={!window.frameSlideAPI || loadingSlides || isExporting}
            className="rounded bg-amber-500 px-2.5 py-1 text-xs font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
          >
            + Chọn ảnh
          </button>
          <button
            onClick={handlePickFolder}
            disabled={!window.frameSlideAPI || loadingSlides || isExporting}
            className="rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
          >
            + Thư mục
          </button>
          <button
            onClick={handleLoadSamples}
            disabled={loadingSlides || isExporting}
            className="rounded border border-zinc-800 bg-zinc-900 px-2 h-8 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
          >
            Ảnh mẫu
          </button>

          <div className="h-4 w-px bg-zinc-700" />

          <button
            onClick={undo}
            disabled={!canUndo || isExporting}
            title="Hoàn tác (Ctrl+Z)"
            className="rounded border border-zinc-800 px-2 h-8 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
          >
            ↶
          </button>
          <button
            onClick={redo}
            disabled={!canRedo || isExporting}
            title="Làm lại (Ctrl+Y)"
            className="rounded border border-zinc-800 px-2 h-8 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
          >
            ↷
          </button>
          <button
            onClick={handleOpenProject}
            disabled={!window.frameSlideAPI || isExporting}
            className="rounded border border-zinc-800 px-2 h-8 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
          >
            Mở
          </button>
          <button
            onClick={handleSaveProject}
            disabled={!window.frameSlideAPI || isExporting}
            title={projectFilePath ?? 'Lưu dự án (Ctrl+S)'}
            className="rounded border border-zinc-800 px-2 h-8 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
          >
            Lưu
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 text-zinc-400">
            FPS
            <select
              value={fps}
              disabled={isExporting}
              onChange={(e) => setFps(Number(e.target.value) as SupportedFps)}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 h-8 text-zinc-100"
            >
              {FPS_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v} fps
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-zinc-400">
            Xem trước
            <select
              value={previewQuality}
              disabled={isExporting}
              onChange={(e) => setPreviewQuality(e.target.value as PreviewQuality)}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 h-8 text-zinc-100"
            >
              {QUALITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={resetLayout}
            title="Đặt lại kích thước khay ảnh, timeline, bảng bên phải và zoom thẻ scene về mặc định"
            className="rounded border border-zinc-700 bg-zinc-900 px-2 h-8 text-xs text-zinc-300 hover:border-amber-400 hover:text-amber-300"
          >
            ⟲ Bố cục
          </button>

          <button
            type="button"
            onClick={() => setShowShortcutsModal(true)}
            title="Bảng phím tắt dựng phim"
            className="rounded border border-zinc-700 bg-zinc-900 px-2 h-8 text-xs font-semibold text-zinc-300 hover:border-amber-400 hover:text-amber-300"
          >
            ?
          </button>
        </div>
      </header>

      {/* Autosave Restore Banner */}
      {autosaveBanner && (
        <div className="flex items-center justify-between border-b border-amber-500/30 bg-amber-950/30 px-4 py-1.5 text-xs text-amber-200">
          <span>
            Phát hiện bản tự động lưu ({autosaveBanner.slides.length} ảnh lúc{' '}
            {new Date(autosaveBanner.savedAt).toLocaleTimeString()}). Khôi phục?
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const banner = autosaveBanner;
                setAutosaveBanner(null);
                void restoreProjectState(banner, null);
              }}
              className="rounded bg-amber-500 px-2.5 py-0.5 font-medium text-zinc-950"
            >
              Khôi phục
            </button>
            <button
              onClick={() => setAutosaveBanner(null)}
              className="text-zinc-400 hover:text-zinc-200"
            >
              Bỏ qua
            </button>
          </div>
        </div>
      )}

      {/* Main 3-Column Studio Workspace */}
      <div className="relative flex flex-1 overflow-hidden">
        {isDraggingFiles && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center border-2 border-dashed border-amber-400 bg-amber-500/15 backdrop-blur-[2px]">
            <div className="rounded-lg bg-zinc-950/90 px-6 py-4 text-sm font-semibold text-amber-300 shadow-2xl">
              Thả ảnh hoặc thư mục ảnh vào đây để thêm vào khay & Scene
            </div>
          </div>
        )}

        {/* Left: Photo Bin */}
        {!isFullscreenPreview && (
          <PhotoBin
            disabled={isExporting}
            width={binWidth}
            resizeHandle={
              <Splitter
                direction="col"
                title="Kéo để đổi độ rộng khay ảnh • Bấm đúp để về mặc định"
                onDragStart={() => (layoutDragBase.current = binWidth)}
                onDrag={(d) => setLayout('binWidth', layoutDragBase.current + d)}
                onDoubleClick={() => setLayout('binWidth', DEFAULT_LAYOUT.binWidth)}
              />
            }
          />
        )}

        {/* Center: Preview Canvas + Playback + Scene Track */}
        <main className="flex min-w-0 flex-1 flex-col justify-between overflow-hidden p-3">
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <div
              className={`relative max-h-full overflow-hidden rounded-lg border border-zinc-800 bg-black shadow-2xl ${
                renderParams.outputAspect === '9:16'
                  ? 'aspect-[9/16] h-full'
                  : renderParams.outputAspect === '1:1'
                    ? 'aspect-square h-full'
                    : isFullscreenPreview
                      ? 'aspect-video w-full max-w-6xl'
                      : 'aspect-video w-full max-w-4xl'
              }`}
            >
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className={`h-full w-full object-contain ${focalPickMode ? 'cursor-crosshair' : ''}`}
              />

              {/* Rich Empty State when no photos are loaded */}
              {slides.length === 0 && !loadingSlides && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950/90 p-6 text-center">
                  <div className="mb-2 text-lg font-semibold text-amber-400">
                    Bắt đầu dựng B-roll cùng FrameSlide
                  </div>
                  <p className="mb-5 max-w-md text-xs text-zinc-400">
                    Kéo thả ảnh hoặc cả thư mục ảnh vào đây, hoặc chọn nhanh bên dưới để dựng slideshow
                    2.5D/3D + Film Look chất lượng cao cho DaVinci Resolve / Premiere.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={handlePickImages}
                      disabled={!window.frameSlideAPI}
                      className="rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
                    >
                      + Chọn ảnh lẻ
                    </button>
                    <button
                      type="button"
                      onClick={handlePickFolder}
                      disabled={!window.frameSlideAPI}
                      className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
                    >
                      + Chọn cả thư mục
                    </button>
                    <button
                      type="button"
                      onClick={handleLoadSamples}
                      className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs text-zinc-300 hover:border-amber-400 hover:text-amber-300"
                    >
                      Mở ảnh mẫu thử ngay
                    </button>
                  </div>
                </div>
              )}

              {/* Photos are in the tray but nothing is on the timeline yet */}
              {slides.length > 0 && scenes.length === 0 && !loadingSlides && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950/85 p-6 text-center">
                  <div className="mb-2 text-base font-semibold text-amber-400">
                    Ảnh đã vào khay, timeline đang trống
                  </div>
                  <p className="max-w-md text-xs text-zinc-400">
                    Chọn ảnh ở khay bên trái (giữ Ctrl để chọn nhiều, Shift để chọn một dãy) rồi bấm
                    “Thêm ảnh đã chọn”, hoặc bấm “Thêm cả thư mục” để đưa tất cả ảnh chưa dùng lên timeline.
                  </p>
                </div>
              )}

              <div className="pointer-events-none absolute top-2.5 left-2.5 flex flex-wrap items-center gap-2">
                {compareMode === 'before' && (
                  <span className="rounded bg-amber-500/90 px-2 py-0.5 text-xs font-semibold text-zinc-950">
                    Đang xem: Ảnh gốc (Clean)
                  </span>
                )}
                {compareMode === 'split' && (
                  <span className="rounded bg-amber-500/90 px-2 py-0.5 text-xs font-semibold text-zinc-950">
                    Chia đôi: Trái Gốc | Phải Film Look
                  </span>
                )}
                {focalPickMode && (
                  <span className="rounded bg-amber-500/90 px-2 py-0.5 text-xs font-semibold text-zinc-950">
                    Click lên ảnh để đặt Focal Point
                  </span>
                )}
              </div>

              {transformEditMode && !isExporting && scenes.length > 0 && (
                <PhotoTransformOverlay
                  canvasRef={canvasRef}
                  onClose={() => setTransformEditMode(false)}
                />
              )}

              {!isFullscreenPreview && scenes.length > 0 && !transformEditMode && (
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => {
                    setIsPlaying(false);
                    setFocalPickMode(false);
                    setTransformEditMode(true);
                  }}
                  title="Kéo trực tiếp trên khung xem để di chuyển, phóng to, xoay ảnh đang chọn"
                  className="absolute top-2.5 right-2.5 z-20 rounded border border-zinc-700 bg-black/75 px-2 h-8 text-xs font-medium text-zinc-200 hover:border-amber-400 hover:text-amber-300 disabled:opacity-40"
                >
                  ✥ Chỉnh ảnh
                </button>
              )}

              {isFullscreenPreview && (
                <button
                  type="button"
                  onClick={() => setIsFullscreenPreview(false)}
                  className="absolute top-2.5 right-2.5 rounded bg-black/80 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-zinc-800"
                >
                  ✕ Thu nhỏ (Esc)
                </button>
              )}

              {focalPickMode && focalTargetPhoto && (
                <div
                  className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-400 bg-amber-400/20 shadow"
                  style={{
                    left: `${focalTargetPhoto.focalPoint.x * 100}%`,
                    top: `${focalTargetPhoto.focalPoint.y * 100}%`,
                  }}
                />
              )}

              {contextLost && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-sm text-amber-300">
                  Driver GPU vừa khởi động lại — đang tự phục hồi WebGL...
                </div>
              )}
            </div>
          </div>

          {!isFullscreenPreview && (
            <Splitter
              direction="row"
              title="Kéo để đổi chiều cao timeline • Bấm đúp để về mặc định"
              onDragStart={() => (layoutDragBase.current = effectiveTimelineHeight)}
              onDrag={(d) => setLayout('timelineHeight', layoutDragBase.current - d)}
              onDoubleClick={() => setLayout('timelineHeight', DEFAULT_LAYOUT.timelineHeight)}
            />
          )}

          {/* Bottom: Playback Bar + Scene Track (Dải Scene & Ô chứa hình) */}
          <div
            className={`flex shrink-0 flex-col rounded-lg border border-zinc-800 bg-[#16161b] px-3 py-2 ${
              isFullscreenPreview ? 'mt-2.5' : 'mt-1'
            }`}
            style={isFullscreenPreview ? undefined : { height: effectiveTimelineHeight }}
          >
            <PlaybackBar
              totalFrames={totalFrames}
              effectiveDurationSec={effectiveDurationSec}
              disabled={scenes.length === 0 || isExporting}
              onToggleFullscreen={() => setIsFullscreenPreview((v) => !v)}
            />
            {!isFullscreenPreview && <SceneTrack disabled={isExporting} />}
          </div>
        </main>

        {/* Right: Inspector (Templates, 12 Film Looks + LUT, Text, Export) */}
        {!isFullscreenPreview && (
          <Splitter
            direction="col"
            title="Kéo để đổi độ rộng bảng bên phải • Bấm đúp để về mặc định"
            onDragStart={() => (layoutDragBase.current = inspectorWidth)}
            onDrag={(d) => setLayout('inspectorWidth', layoutDragBase.current - d)}
            onDoubleClick={() => setLayout('inspectorWidth', DEFAULT_LAYOUT.inspectorWidth)}
          />
        )}
        {!isFullscreenPreview && (
          <aside
            className="flex shrink-0 flex-col border-zinc-800 bg-[#141419] text-xs"
            style={{ width: inspectorWidth }}
          >
          <div className="grid grid-cols-4 border-b border-zinc-800 bg-[#16161b] text-xs font-medium">
            {(
              [
                ['template', 'Template'],
                ['look', 'Look/LUT'],
                ['text', 'Chữ'],
                ['export', 'Xuất'],
              ] as [InspectorTab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`py-2 transition-colors ${
                  activeTab === id
                    ? 'border-b-2 border-amber-400 bg-zinc-900/60 text-amber-400'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-3.5">
            {/* TAB 1: 7 MOTION TEMPLATES (2D/2.5D/3D), MY PRESETS, TIMELINE & PER-PHOTO/SCENE CONTROLS */}
            {activeTab === 'template' && (
              <>
                <Group id="tpl-templates" title="7 Motion Templates (2D / 2.5D / 3D)" accent>
                  <div className="space-y-1.5">
                    {MOTION_TEMPLATE_PRESETS.map((tpl) => {
                      const active = renderParams.motionTemplate === tpl.id;
                      const is3d = tpl.id === 'gallery-3d' || tpl.id === 'wall-3d';
                      return (
                        <button
                          key={tpl.id}
                          disabled={isExporting}
                          onClick={() => {
                            applyMotionTemplate(tpl.id, true);
                            flashNotice(`Đã áp template: ${tpl.name}`);
                          }}
                          className={`w-full rounded border p-2 text-left transition ${
                            active
                              ? 'border-amber-400 bg-amber-500/10'
                              : 'border-zinc-800 bg-zinc-900/80 hover:border-zinc-600'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-medium text-zinc-100">{tpl.name}</span>
                            <div className="flex items-center gap-1">
                              {is3d && (
                                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-bold text-amber-300">
                                  3D
                                </span>
                              )}
                              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">
                                {tpl.heavyLevel === 'light' ? 'Nhẹ' : 'Vừa'}
                              </span>
                            </div>
                          </div>
                          <div className="mt-0.5 text-xs text-zinc-400">{tpl.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </Group>

                
                <Group id="tpl-motion" title="Chuyển động, Nền, Viền & Tỷ lệ">

                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="flex flex-col gap-1 text-xs text-zinc-400">
                      Tỷ lệ xuất
                      <select
                        value={renderParams.outputAspect}
                        disabled={isExporting}
                        onChange={(e) => setOutputAspect(e.target.value as OutputAspectId)}
                        className="rounded border border-zinc-700 bg-zinc-900 px-1.5 h-8 text-xs text-zinc-100"
                      >
                        <option value="16:9">16:9 FHD</option>
                        <option value="9:16">9:16 Reels</option>
                        <option value="1:1">1:1 Vuông</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-zinc-400">
                      Viền khung
                      <select
                        value={renderParams.frameBorderStyle}
                        disabled={isExporting}
                        onChange={(e) => setFrameBorderStyle(e.target.value as FrameBorderStyle)}
                        className="rounded border border-zinc-700 bg-zinc-900 px-1.5 h-8 text-xs text-zinc-100"
                      >
                        <option value="auto">Tự động</option>
                        <option value="none">Không viền</option>
                        <option value="thin">Viền mỏng</option>
                        <option value="polaroid">Polaroid</option>
                      </select>
                    </label>
                  </div>

                  <BackgroundPanel disabled={isExporting} />

                  <SliderRow
                    label="Biên độ chuyển động (Motion Intensity)"
                    value={renderParams.motionIntensity}
                    min={0}
                    max={1.5}
                    step={0.05}
                    disabled={isExporting}
                    onChange={setMotionIntensity}
                  />

                  <SliderRow
                    label="Thời lượng chuyển cảnh (giây)"
                    value={renderParams.transitionDurationSec}
                    min={0.2}
                    max={2.2}
                    step={0.05}
                    disabled={isExporting}
                    onChange={setTransitionDurationSec}
                  />

                  {activeScene && (
                    <label className="flex flex-col gap-1 text-xs text-zinc-400">
                      Hướng chuyển động riêng (Scene đang chọn)
                      <select
                        value={activeScene.motionDirection ?? 'auto'}
                        disabled={isExporting}
                        onChange={(e) =>
                          setSceneMotionDirection(activeScene.id, e.target.value as MotionDirection)
                        }
                        className="rounded border border-zinc-700 bg-zinc-900 px-2 h-8 text-zinc-100"
                      >
                        <option value="auto">Tự động (Auto)</option>
                        <option value="zoom-in">Zoom In (Tiến gần)</option>
                        <option value="zoom-out">Zoom Out (Lùi xa)</option>
                        <option value="pan-left">Lướt sang Trái</option>
                        <option value="pan-right">Lướt sang Phải</option>
                        <option value="tilt-3d">Nghiêng 3D (Perspective)</option>
                        <option value="static">Đứng yên (Tĩnh)</option>
                      </select>
                    </label>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-xs text-zinc-400">
                      Chế độ thời lượng
                      <select
                        value={renderParams.durationMode}
                        disabled={isExporting}
                        onChange={(e) => setDurationMode(e.target.value as DurationMode)}
                        className="rounded border border-zinc-700 bg-zinc-900 px-2 h-8 text-zinc-100"
                      >
                        <option value="per-slide">Theo từng Scene</option>
                        <option value="fixed-total">Cố định tổng</option>
                      </select>
                    </label>

                    {renderParams.durationMode === 'fixed-total' ? (
                      <label className="flex flex-col gap-1 text-xs text-zinc-400">
                        Tổng thời lượng
                        <select
                          value={renderParams.totalDurationSec}
                          disabled={isExporting}
                          onChange={(e) => setTotalDurationSec(Number(e.target.value))}
                          className="rounded border border-zinc-700 bg-zinc-900 px-2 h-8 text-zinc-100"
                        >
                          {DURATION_OPTIONS.map((d) => (
                            <option key={d} value={d}>
                              {d} giây
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label className="flex flex-col gap-1 text-xs text-zinc-400">
                        Mặc định/Scene (s)
                        <input
                          type="number"
                          min={1}
                          max={15}
                          step={0.5}
                          value={renderParams.defaultSlideDurationSec}
                          disabled={isExporting}
                          onChange={(e) => setDefaultSlideDurationSec(Number(e.target.value))}
                          className="rounded border border-zinc-700 bg-zinc-900 px-2 h-8 text-zinc-100"
                        />
                      </label>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-xs text-zinc-400">
                      Handles (đầu/cuối)
                      <select
                        value={renderParams.handlesSec}
                        disabled={isExporting}
                        onChange={(e) => setHandlesSec(Number(e.target.value))}
                        className="rounded border border-zinc-700 bg-zinc-900 px-2 h-8 text-zinc-100"
                      >
                        {HANDLES_OPTIONS.map((h) => (
                          <option key={h} value={h}>
                            {h === 0 ? 'Không (0s)' : `+${h}s mỗi đầu`}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1 text-xs text-zinc-400">
                      Ảnh dọc (1 ảnh)
                      <select
                        value={renderParams.portraitMode}
                        disabled={isExporting}
                        onChange={(e) => setPortraitMode(e.target.value as PortraitMode)}
                        className="rounded border border-zinc-700 bg-zinc-900 px-2 h-8 text-zinc-100"
                      >
                        <option value="smart-pairing">Smart Pairing</option>
                        <option value="matte-framed">Matte / Framed</option>
                        <option value="safe-top-third">Focal Point Crop</option>
                      </select>
                    </label>
                  </div>

                  <label className="flex flex-col gap-1 text-xs text-zinc-400">
                    Áp Transition cho tất cả Scene (20 kiểu)
                    <select
                      value={renderParams.transitionType}
                      disabled={isExporting}
                      onChange={(e) => setTransitionType(e.target.value as TransitionType)}
                      className="rounded border border-zinc-700 bg-zinc-900 px-2 h-8 text-zinc-100"
                    >
                      {TRANSITION_PRESETS.map((tr) => (
                        <option key={tr.id} value={tr.id}>
                          [{tr.group}] {tr.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </Group>

                {/* Per-Photo Quick Fix: Focal Point, Rotate 90, Exposure */}
                {focalTargetPhoto && (
                  <>
                                        <Group id="photo-rescue" title={<>Cứu ảnh nhanh: {focalTargetPhoto.name}</>} onReset={() => setPhotoExposure(focalTargetPhoto.id, 0)} resetTitle="Đặt độ sáng ảnh về 0">
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          disabled={isExporting}
                          onClick={() => rotatePhoto90(focalTargetPhoto.id)}
                          title="Xoay ảnh 90° theo chiều kim đồng hồ"
                          className="shrink-0 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200 hover:border-amber-400"
                        >
                          ↻ Xoay 90° ({focalTargetPhoto.rotationDeg ?? 0}°)
                        </button>
                      </div>

                      <SliderRow
                        label="Độ sáng ảnh (Exposure EV)"
                        value={focalTargetPhoto.exposure ?? 0}
                        min={-1.5}
                        max={1.5}
                        step={0.05}
                        disabled={isExporting}
                        onChange={(v) => setPhotoExposure(focalTargetPhoto.id, v)}
                      />

                      <button
                        type="button"
                        onClick={() => setFocalPickMode(!focalPickMode)}
                        className={`w-full rounded border px-2.5 py-1.5 text-xs font-medium ${
                          focalPickMode
                            ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                            : 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                        }`}
                      >
                        {focalPickMode
                          ? `Đang chọn tâm${!selectedPhotoId && activeScene && activeScene.slots.length > 1 ? ` (Ô ${activeSlotIndex + 1})` : ''}: Click preview...`
                          : `Focal Point${!selectedPhotoId && activeScene && activeScene.slots.length > 1 ? ` [Ô ${activeSlotIndex + 1}]` : ''} (${Math.round(focalTargetPhoto.focalPoint.x * 100)}%, ${Math.round(focalTargetPhoto.focalPoint.y * 100)}%)`}
                      </button>
                    </Group>
                  </>
                )}

                
                {/* User Presets (Save & Recall) */}
                <Group id="tpl-presets" title="Preset cá nhân (My Presets)">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={presetNameDraft}
                      disabled={isExporting}
                      onChange={(e) => setPresetNameDraft(e.target.value)}
                      placeholder="Tên preset (VD: Tiệc cưới ấm)"
                      className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 h-8 text-xs text-zinc-100"
                    />
                    <button
                      type="button"
                      disabled={isExporting || !presetNameDraft.trim()}
                      onClick={() => {
                        saveUserPreset(presetNameDraft);
                        flashNotice(`Đã lưu preset: ${presetNameDraft.trim()}`);
                        setPresetNameDraft('');
                      }}
                      className="rounded bg-amber-500 px-2.5 py-1 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
                    >
                      Lưu
                    </button>
                  </div>
                  {userPresets.length > 0 && (
                    <div className="space-y-1">
                      {userPresets.map((up) => (
                        <div
                          key={up.id}
                          className="flex items-center justify-between gap-1 rounded border border-zinc-800 bg-zinc-900/90 px-2 h-8 text-xs"
                        >
                          <button
                            type="button"
                            disabled={isExporting}
                            onClick={() => {
                              applyUserPreset(up.id);
                              flashNotice(`Đã áp preset: ${up.name}`);
                            }}
                            className="flex-1 truncate text-left text-zinc-200 hover:text-amber-300"
                          >
                            ★ {up.name}
                          </button>
                          <button
                            type="button"
                            disabled={isExporting}
                            onClick={() => deleteUserPreset(up.id)}
                            title="Xóa preset"
                            className="text-zinc-500 hover:text-red-400"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </Group>
              </>
            )}

            {/* TAB 2: 12 FILM LOOK PRESETS + CLEAN + .CUBE 3D LUT */}
            {activeTab === 'look' && (
              <>
                <Group id="look-presets" title="12 Film Look Presets + Clean" accent>
                  <div className="grid grid-cols-2 gap-1.5">
                    {FILM_LOOK_PRESETS.map((preset) => {
                      const active = look.presetId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          disabled={isExporting}
                          onClick={() => {
                            applyFilmLookPreset(preset.id);
                            flashNotice(`Film Look: ${preset.name}`);
                          }}
                          title={preset.desc}
                          className={`rounded border px-2 h-8 text-left transition ${
                            active
                              ? 'border-amber-400 bg-amber-500/15 text-amber-200'
                              : 'border-zinc-800 bg-zinc-900/90 text-zinc-300 hover:border-zinc-600'
                          }`}
                        >
                          <div className="truncate text-xs font-medium">{preset.name}</div>
                        </button>
                      );
                    })}
                  </div>
                </Group>

                
                <Group
                  id="look-tune"
                  title="Tinh chỉnh Film Look"
                  accent
                  enabled={look.enabled}
                  disabled={isExporting}
                  onToggle={(v) => updateSuper8({ enabled: v })}
                  onReset={() => applyFilmLookPreset(look.presetId)}
                  resetTitle="Đặt các thanh về đúng mẫu Film Look đang chọn"
                >
                  <Group id="look-color" title="Màu" disabled={!look.enabled || isExporting}>

                  <SliderRow label="Cường độ tổng" value={look.intensity} min={0} max={1} step={0.02} disabled={!look.enabled || isExporting} onChange={(v) => updateSuper8({ intensity: v })} />

                  <SliderRow label="Contrast (Tương phản)" value={look.contrast} min={0.75} max={1.45} step={0.02} disabled={!look.enabled || isExporting} onChange={(v) => updateSuper8({ contrast: v })} />

                  <SliderRow label="Saturation (Bão hòa)" value={look.saturation} min={0} max={1.4} step={0.02} disabled={!look.enabled || isExporting} onChange={(v) => updateSuper8({ saturation: v })} />

                  <SliderRow label="Fade (Bạc màu tối)" value={look.fade} min={0} max={0.25} step={0.01} disabled={!look.enabled || isExporting} onChange={(v) => updateSuper8({ fade: v })} />

                  </Group>
                  <Group id="look-light" title="Ánh sáng" disabled={!look.enabled || isExporting}>
                  <SliderRow label="Halation (Đỏ cam)" value={look.halation} min={0} max={1} step={0.02} disabled={!look.enabled || isExporting} onChange={(v) => updateSuper8({ halation: v })} />

                  <SliderRow label="Bloom (Tỏa sáng)" value={look.bloom} min={0} max={1} step={0.02} disabled={!look.enabled || isExporting} onChange={(v) => updateSuper8({ bloom: v })} />

                  <SliderRow label="Vignette (Viền tối)" value={look.vignette} min={0} max={1} step={0.02} disabled={!look.enabled || isExporting} onChange={(v) => updateSuper8({ vignette: v })} />

                  <SliderRow label="Lóe sáng nền (Ambient Leak)" value={look.ambientLeak ?? 0} min={0} max={1} step={0.02} disabled={!look.enabled || isExporting} onChange={(v) => updateSuper8({ ambientLeak: v })} />

                  </Group>
                  <Group id="look-grain" title="Hạt & Bụi" disabled={!look.enabled || isExporting}>
                  <SliderRow label="Film Grain (Hạt)" value={look.grain} min={0} max={1} step={0.02} disabled={!look.enabled || isExporting} onChange={(v) => updateSuper8({ grain: v })} />

                  <SliderRow label="Bokeh / Bụi sáng bay" value={look.bokeh ?? 0} min={0} max={1} step={0.02} disabled={!look.enabled || isExporting} onChange={(v) => updateSuper8({ bokeh: v })} />

                  <SliderRow label="Bụi & Xước phim nhựa" value={look.dustScratches ?? 0} min={0} max={1} step={0.02} disabled={!look.enabled || isExporting} onChange={(v) => updateSuper8({ dustScratches: v })} />

                  </Group>
                  <Group id="look-weave" title="Rung & Nháy" disabled={!look.enabled || isExporting}>
                  <SliderRow label="Gate Weave (Rung)" value={look.gateWeave} min={0} max={1} step={0.02} disabled={!look.enabled || isExporting} onChange={(v) => updateSuper8({ gateWeave: v })} />

                  <SliderRow label="Flicker (Nhấp nháy)" value={look.flicker} min={0} max={1} step={0.02} disabled={!look.enabled || isExporting} onChange={(v) => updateSuper8({ flicker: v })} />

                    <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                      <input
                        type="checkbox"
                        checked={look.simulate18fps}
                        disabled={!look.enabled || isExporting}
                        onChange={(e) => updateSuper8({ simulate18fps: e.target.checked })}
                        className="accent-amber-400"
                      />
                      Giả lập nhịp 18fps Super 8
                    </label>
                  </Group>
                  <Group id="look-frame" title="Khung phim" disabled={!look.enabled || isExporting}>

                  <label className="flex flex-col gap-1 text-xs text-zinc-400">
                    Khung điện ảnh (Letterbox)
                    <select
                      value={look.aspectMask ?? 'none'}
                      disabled={isExporting}
                      onChange={(e) => updateSuper8({ aspectMask: e.target.value as AspectMaskId })}
                      className="rounded border border-zinc-700 bg-zinc-900 px-2 h-8 text-zinc-100"
                    >
                      <option value="none">Không (Đầy khung)</option>
                      <option value="2.39">2.39:1 Cinemascope</option>
                      <option value="2.00">2.00:1 Univisium</option>
                      <option value="4:3">4:3 Cổ điển</option>
                    </select>
                  </label>
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                      <input
                        type="checkbox"
                        checked={look.sprockets}
                        disabled={!look.enabled || isExporting}
                        onChange={(e) => updateSuper8({ sprockets: e.target.checked })}
                        className="accent-amber-400"
                      />
                      Viền lỗ răng cưa (Sprocket)
                    </label>
                  </Group>
                </Group>

                
                <Group id="look-lut" title="3D LUT (.cube từ DaVinci Resolve)">
                  <div className="flex gap-2">
                    <button
                      onClick={handlePickCubeLut}
                      disabled={!window.frameSlideAPI || isExporting}
                      className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
                    >
                      Nạp file .cube
                    </button>
                    {customLut && (
                      <button
                        onClick={handleClearLut}
                        disabled={isExporting}
                        className="rounded border border-zinc-700 px-2.5 py-1.5 text-xs text-red-400 hover:bg-zinc-800"
                      >
                        Gỡ
                      </button>
                    )}
                  </div>
                  {customLut && (
                    <div className="rounded border border-zinc-800 bg-zinc-900 p-2 text-xs text-emerald-300">
                      {customLut.name} ({customLut.size}³)
                    </div>
                  )}
                  <SliderRow
                    label="Độ mạnh LUT"
                    value={renderParams.lutIntensity}
                    min={0}
                    max={1}
                    step={0.02}
                    disabled={!customLut || isExporting}
                    onChange={setLutIntensity}
                  />
                </Group>
              </>
            )}

            {/* TAB 3: VIETNAMESE TEXT & DATE STAMP */}
            {activeTab === 'text' && (
              <Group id="text-main" title="Chữ & Date Stamp (Tiếng Việt)" accent>
                <label className="flex flex-col gap-1 text-xs text-zinc-400">
                  Kiểu hiển thị
                  <select
                    value={textOverlay.style}
                    disabled={isExporting}
                    onChange={(e) => updateTextOverlay({ style: e.target.value as TextStyleId })}
                    className="rounded border border-zinc-700 bg-zinc-900 px-2 h-8 text-zinc-100"
                  >
                    <option value="none">Tắt chữ</option>
                    <option value="date-stamp-90s">Date Stamp 90s (Cam điện tử)</option>
                    <option value="minimal-fade">Minimal Title (Hiện đại)</option>
                    <option value="editorial-serif">Editorial Serif (Phim cưới)</option>
                    <option value="filmstrip-label">Filmstrip Label (Viền phim)</option>
                    <option value="lower-third">Lower Third (Góc trái dưới)</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-xs text-zinc-400">
                  Thời điểm hiện chữ (có Fade mượt)
                  <select
                    value={textOverlay.timing ?? 'always'}
                    disabled={textOverlay.style === 'none' || isExporting}
                    onChange={(e) => updateTextOverlay({ timing: e.target.value as TextTimingMode })}
                    className="rounded border border-zinc-700 bg-zinc-900 px-2 h-8 text-zinc-100 disabled:opacity-40"
                  >
                    <option value="always">Suốt clip (Hợp Date Stamp)</option>
                    <option value="intro">Chỉ Scene đầu (Intro + Fade)</option>
                    <option value="outro">Chỉ Scene cuối (Outro + Fade)</option>
                    <option value="per-scene">Chú thích riêng từng Scene</option>
                  </select>
                </label>

                {textOverlay.timing === 'per-scene' && activeScene ? (
                  <label className="flex flex-col gap-1 text-xs text-amber-300">
                    Chú thích riêng cho Scene đang chọn
                    <input
                      type="text"
                      value={activeScene.caption ?? ''}
                      disabled={textOverlay.style === 'none' || isExporting}
                      onChange={(e) => setSceneCaption(activeScene.id, e.target.value)}
                      placeholder="Nhập chữ riêng cho Scene này..."
                      className="rounded border border-amber-500/50 bg-zinc-900 px-2 h-8 text-zinc-100 disabled:opacity-40"
                    />
                  </label>
                ) : (
                  <label className="flex flex-col gap-1 text-xs text-zinc-400">
                    Tiêu đề chính
                    <input
                      type="text"
                      value={textOverlay.title}
                      disabled={textOverlay.style === 'none' || isExporting}
                      onChange={(e) => updateTextOverlay({ title: e.target.value })}
                      className="rounded border border-zinc-700 bg-zinc-900 px-2 h-8 text-zinc-100 disabled:opacity-40"
                    />
                  </label>
                )}

                <label className="flex flex-col gap-1 text-xs text-zinc-400">
                  Phụ đề / Địa điểm
                  <input
                    type="text"
                    value={textOverlay.subtitle}
                    disabled={textOverlay.style === 'none' || isExporting}
                    onChange={(e) => updateTextOverlay({ subtitle: e.target.value })}
                    className="rounded border border-zinc-700 bg-zinc-900 px-2 h-8 text-zinc-100 disabled:opacity-40"
                  />
                </label>

                <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={Boolean(textOverlay.autoExifDate)}
                    disabled={textOverlay.style === 'none' || isExporting}
                    onChange={(e) => updateTextOverlay({ autoExifDate: e.target.checked })}
                    className="accent-amber-400"
                  />
                  Tự lấy ngày chụp EXIF theo từng Scene
                </label>

                <label className="flex flex-col gap-1 text-xs text-zinc-400">
                  Ngày tháng thủ công (Date Stamp)
                  <input
                    type="text"
                    value={textOverlay.dateText}
                    disabled={textOverlay.style === 'none' || Boolean(textOverlay.autoExifDate) || isExporting}
                    onChange={(e) => updateTextOverlay({ dateText: e.target.value })}
                    className="rounded border border-zinc-700 bg-zinc-900 px-2 h-8 font-mono text-zinc-100 disabled:opacity-40"
                  />
                </label>

                <SliderRow
                  label="Độ rõ chữ (Opacity)"
                  value={textOverlay.opacity}
                  min={0.1}
                  max={1}
                  step={0.05}
                  disabled={textOverlay.style === 'none' || isExporting}
                  onChange={(v) => updateTextOverlay({ opacity: v })}
                />
              </Group>
            )}

            {/* TAB 4: SINGLE & BATCH EXPORT */}
            {activeTab === 'export' && (
              <>
                <Group id="export-single" title={<>Xuất 1 clip ({exportRes.width}×{exportRes.height} • {scenes.length} Scene • {effectiveDurationSec.toFixed(1)}s)</>}>
                  <div className="grid grid-cols-2 gap-2">
                    <SliderRow
                      label="Fade In đầu (s)"
                      value={renderParams.videoFadeInSec}
                      min={0}
                      max={1.5}
                      step={0.1}
                      disabled={isExporting}
                      onChange={setVideoFadeInSec}
                    />
                    <SliderRow
                      label="Fade Out cuối (s)"
                      value={renderParams.videoFadeOutSec}
                      min={0}
                      max={1.5}
                      step={0.1}
                      disabled={isExporting}
                      onChange={setVideoFadeOutSec}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleExportMp4}
                      disabled={scenes.length === 0 || isExporting}
                      className="w-full rounded bg-emerald-500 px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-40"
                    >
                      Xuất MP4 H.264 (WebCodecs)
                    </button>
                    <button
                      onClick={() => handleExportFfmpegCodec('dnxhr_hq')}
                      disabled={!window.frameSlideAPI || !appInfo?.ffmpegAvailable || scenes.length === 0 || isExporting}
                      className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
                    >
                      Xuất DNxHR HQ (.mov • bt709)
                    </button>
                    <button
                      onClick={() => handleExportFfmpegCodec('prores422')}
                      disabled={!window.frameSlideAPI || !appInfo?.ffmpegAvailable || scenes.length === 0 || isExporting}
                      className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
                    >
                      Xuất ProRes 422 (.mov • bt709)
                    </button>
                  </div>
                </Group>

                
                <Group id="export-batch" title="Batch Export (Chia nhiều clip B-roll)" accent>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-xs text-zinc-400">
                      Số ảnh / clip
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={batchSlidesPerClip}
                        disabled={isExporting}
                        onChange={(e) => setBatchSlidesPerClip(Math.max(1, Number(e.target.value)))}
                        className="rounded border border-zinc-700 bg-zinc-900 px-2 h-8 text-zinc-100"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-zinc-400">
                      Định dạng
                      <select
                        value={batchCodec}
                        disabled={isExporting}
                        onChange={(e) => setBatchCodec(e.target.value as ExportCodec)}
                        className="rounded border border-zinc-700 bg-zinc-900 px-2 h-8 text-zinc-100"
                      >
                        <option value="h264">MP4 H.264</option>
                        <option value="dnxhr_hq">DNxHR HQ (.mov)</option>
                        <option value="prores422">ProRes 422 (.mov)</option>
                      </select>
                    </label>
                  </div>
                  <div className="text-xs text-zinc-500">
                    Dự kiến xuất:{' '}
                    <strong className="text-zinc-300">
                      {Math.ceil(slides.length / Math.max(1, batchSlidesPerClip))}
                    </strong>{' '}
                    clip B-roll từ {slides.length} ảnh.
                  </div>
                  <button
                    onClick={handleBatchExport}
                    disabled={!window.frameSlideAPI || slides.length === 0 || isExporting}
                    className="w-full rounded bg-amber-500 px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
                  >
                    Chọn thư mục & Xuất hàng loạt
                  </button>
                </Group>

                {exportProgress && (
                  <div className="space-y-1.5 rounded border border-zinc-700 bg-zinc-900 p-2.5">
                    <div className="flex justify-between text-xs">
                      <span>
                        {exportProgress.clipCount
                          ? `Clip ${exportProgress.clipIndex}/${exportProgress.clipCount}`
                          : 'Đang render 1080p...'}
                      </span>
                      <span className="font-mono">{exportProgress.percent}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded bg-zinc-800">
                      <div
                        className="h-full bg-amber-400 transition-all"
                        style={{ width: `${exportProgress.percent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>
                        Frame {exportProgress.currentFrame}/{exportProgress.totalFrames}
                      </span>
                      <button
                        onClick={() => exportAbortRef.current?.abort()}
                        className="text-red-400 hover:text-red-300"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}

                {exportSummary && (
                  <div className="rounded border border-emerald-500/40 bg-emerald-950/30 p-2.5 text-xs text-emerald-200">
                    <div className="font-semibold">
                      Xuất xong {exportSummary.clipCount ? `${exportSummary.clipCount} clip ` : ''}
                      ({exportSummary.codec.toUpperCase()})
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-emerald-300">
                      {exportSummary.totalFrames} frames trong {(exportSummary.durationMs / 1000).toFixed(2)}s •{' '}
                      {exportSummary.speedFactor.toFixed(2)}x realtime
                    </div>
                    {exportSummary.filePath && (
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <div className="truncate text-xs text-zinc-400" title={exportSummary.filePath}>
                          {exportSummary.filePath}
                        </div>
                        {window.frameSlideAPI && (
                          <button
                            type="button"
                            onClick={() => void window.frameSlideAPI?.revealInFolder(exportSummary.filePath!)}
                            className="shrink-0 rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30"
                          >
                            Mở thư mục
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {exportStatusMsg && (
                  <div className="rounded border border-zinc-700 bg-zinc-900 p-2 text-xs text-zinc-300">
                    {exportStatusMsg}
                  </div>
                )}

                {exportError && (
                  <div className="rounded border border-red-500/40 bg-red-950/40 p-2 text-xs text-red-300">
                    {exportError}
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
        )}
      </div>

      {/* Shortcuts Help Modal */}
      {showShortcutsModal && (
        <div
          onClick={() => setShowShortcutsModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-lg border border-zinc-700 bg-[#18181f] p-4 text-xs shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-sm font-semibold text-amber-400">Phím tắt dựng phim</span>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1.5 text-zinc-300">
              {[
                ['Space', 'Phát / Tạm dừng'],
                ['← / →', 'Lùi / Tiến từng 1 frame'],
                ['Shift + ← / →', 'Nhảy sang Scene trước / Scene kế tiếp'],
                ['Giữ phím \\', 'Xem nhanh ảnh gốc (Before / After)'],
                ['F / Esc', 'Phóng to / Thu nhỏ màn hình Preview'],
                ['Delete', 'Xóa Scene đang chọn'],
                ['Ctrl + Z / Ctrl + Y', 'Hoàn tác / Làm lại'],
                ['Ctrl + S', 'Lưu dự án (.frameslide)'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between py-0.5">
                  <kbd className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-xs text-amber-300">
                    {key}
                  </kbd>
                  <span className="text-zinc-400">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Status Footer */}
      <footer className="flex items-center justify-between border-t border-zinc-800 bg-[#16161b] px-4 py-1.5 text-xs text-zinc-400">
        <div className="flex items-center gap-3 overflow-hidden">
          <span>
            WebGL2:{' '}
            <strong className={engineCapabilities?.webgl2 ? 'text-emerald-400' : 'text-red-400'}>
              {engineCapabilities?.webgl2 ? 'OK' : 'Không hỗ trợ'}
            </strong>
          </span>
          <span>
            RGBA16F:{' '}
            <strong
              className={
                engineCapabilities?.halfFloatRenderTarget ? 'text-emerald-400' : 'text-amber-400'
              }
            >
              {engineCapabilities?.halfFloatRenderTarget ? 'OK' : 'Fallback 8-bit'}
            </strong>
          </span>
          <span>
            FFmpeg:{' '}
            <strong className={appInfo?.ffmpegAvailable ? 'text-emerald-400' : 'text-zinc-500'}>
              {appInfo ? (appInfo.ffmpegAvailable ? 'OK' : 'Không tìm thấy') : 'Web'}
            </strong>
          </span>
          {showIntegratedWarning && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">
              {engineCapabilities?.gpuTier === 'software' ? 'CPU Render' : 'Card tích hợp'}
            </span>
          )}
          <span>
            Xem trước:{' '}
            <strong className="text-zinc-200">
              {resolvedSize.width}×{resolvedSize.height} ({renderParams.outputAspect}) • {fps} fps
            </strong>
          </span>
          {liveFps !== null && (
            <span>
              Live:{' '}
              <strong className={liveFps >= 28 ? 'text-emerald-400' : 'text-amber-400'}>
                {liveFps} FPS
              </strong>
            </span>
          )}
          {statusNotice && <span className="text-amber-300">• {statusNotice}</span>}
        </div>

        <div className="shrink-0">
          {appInfo ? `v${appInfo.version} • Electron ${appInfo.electron}` : 'Browser Preview Mode'}
        </div>
      </footer>
    </div>
  );
}
