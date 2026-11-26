import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FrameSlideEngine } from '@engine/FrameSlideEngine';
import { getExportResolution, resolvePreviewResolution } from '@engine/capabilities';
import { computeProjectDurationSec, getTotalFrames } from '@engine/timeline';
import { PhotoBin } from './components/PhotoBin';
import { PhotoTransformOverlay } from './components/PhotoTransformOverlay';
import { PhotoCropOverlay } from './components/PhotoCropOverlay';
import { Splitter } from './components/Splitter';
import { ScenePanel } from './components/ScenePanel';
import { PhotoPanel } from './components/PhotoPanel';
import { PhotoQuickBar } from './components/PhotoQuickBar';
import { PreviewEmptyState } from './components/PreviewEmptyState';
import { PlaybackBar } from './components/PlaybackBar';
import { SceneTrack } from './components/SceneTrack';
import { ExportDialog } from './components/ExportDialog';
import { GpuNotice } from './components/GpuNotice';
import { ShortcutsModal } from './components/ShortcutsModal';
import { SettingsDialog } from './components/SettingsDialog';
import { usePrefsStore } from './store/usePrefsStore';
import { StatusFooter } from './components/StatusFooter';
import { TopToolbar } from './components/TopToolbar';
import { WorkspaceTabs } from './components/WorkspaceTabs';
import { MultiFolderImportModal } from './components/MultiFolderImportModal';
import { TextDragOverlay } from './components/TextDragOverlay';
import { InspectorNav, type InspectorTab } from './components/inspector/InspectorNav';
import { LookTab } from './components/inspector/LookTab';
import { TemplateTab } from './components/inspector/TemplateTab';
import { TextTab } from './components/inspector/TextTab';
import { useExportJobs } from './hooks/useExportJobs';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePreviewEngine } from './hooks/usePreviewEngine';
import { useProjectFiles } from './hooks/useProjectFiles';
import { DEFAULT_LAYOUT, useLayoutStore } from './store/useLayoutStore';
import { useAppStore } from './store/useAppStore';
import type { AppInfo, FolderScanEntry, FrameSlideAPI } from '@shared/types';

declare global {
  interface Window {
    frameSlideAPI?: FrameSlideAPI;
    frameSlideGetFilePath?: (file: File) => string;
  }
}



export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<FrameSlideEngine | null>(null);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);

  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [activeTab, setActiveTab] = useState<InspectorTab>('template');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [focalPickMode, setFocalPickMode] = useState(false);
  const [transformEditMode, setTransformEditMode] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  const [textDragMode, setTextDragMode] = useState(false);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewViewportSize, setPreviewViewportSize] = useState({ width: 0, height: 0 });
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [multiFolderQueue, setMultiFolderQueue] = useState<FolderScanEntry[] | null>(null);
  const [photoToolSlot, setPhotoToolSlot] = useState<HTMLDivElement | null>(null);

  // ⚙ Cài đặt: defaults for a new project, applied once when the app opens (empty project only).
  useEffect(() => {
    const p = usePrefsStore.getState();
    useAppStore.getState().applyStartDefaults({
      fps: p.defaultFps,
      aspect: p.defaultAspect,
      sceneSec: p.defaultSceneSec,
      filmLookOn: p.filmLookOnStart,
    });
  }, []);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const exportJobs = useExportJobs(engineRef);
  const { isExporting, setError: setExportError } = exportJobs;

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
  const layoutDragBase = useRef(0);
  // Never let the timeline squeeze the preview below ~220px on small windows.
  const effectiveTimelineHeight = Math.max(
    170,
    Math.min(timelineHeight, typeof window !== 'undefined' ? window.innerHeight - 330 : timelineHeight)
  );
  const activeSceneId = useAppStore((s) => s.activeSceneId);
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId);
  const inspectorScope = useAppStore((s) => s.inspectorScope);
  const activeSlotIndex = useAppStore((s) => s.activeSlotIndex);
  const selectedPhotoId = useAppStore((s) => s.selectedPhotoId);
  const renderParams = useAppStore((s) => s.renderParams);
  const engineCapabilities = useAppStore((s) => s.engineCapabilities);

  const setIsPlaying = useAppStore((s) => s.setIsPlaying);
  const updatePhotoFocalPoint = useAppStore((s) => s.updatePhotoFocalPoint);


  const startTransformEdit = () => {
    setIsPlaying(false);
    setFocalPickMode(false);
    setTextDragMode(false);
    setCropMode(false);
    setTransformEditMode(true);
  };

  const startCrop = () => {
    setIsPlaying(false);
    setFocalPickMode(false);
    setTextDragMode(false);
    setTransformEditMode(false);
    setCropMode(true);
  };

  const flashNotice = useCallback((msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice((curr) => (curr === msg ? null : curr)), 3500);
  }, []);

  // Right-click menu on a photo slot ("Đặt tâm điểm") asks the preview to enter focal-point mode.
  useEffect(() => {
    const onFocalPick = () => {
      setTransformEditMode(false);
      setCropMode(false);
      setFocalPickMode(true);
    };
    window.addEventListener('frameslide:focal-pick', onFocalPick);
    return () => window.removeEventListener('frameslide:focal-pick', onFocalPick);
  }, []);

  // The export progress lives in the export dialog: bring it into view when a render starts.
  useEffect(() => {
    if (isExporting) setShowExportDialog(true);
  }, [isExporting]);

  // Starting playback leaves the photo editor (handles would not follow the motion).
  useEffect(() => {
    if (isPlaying) {
      setTransformEditMode(false);
      setCropMode(false);
    }
  }, [isPlaying]);

  // Switching workspace tabs clears active preview overlay modes so edits never leak across tabs.
  useEffect(() => {
    setFocalPickMode(false);
    setTransformEditMode(false);
    setCropMode(false);
    setTextDragMode(false);
  }, [activeWorkspaceId]);

  // Measure the available preview area so the main viewer fills nearly the entire panel by default.
  useEffect(() => {
    const el = previewViewportRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      setPreviewViewportSize({ width: el.clientWidth, height: el.clientHeight });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ctrl + mouse wheel over the preview area zooms the viewer smoothly (25% – 300%).
  useEffect(() => {
    const el = previewViewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setPreviewZoom((z) => Math.round(Math.min(3, Math.max(0.25, z * factor)) * 100) / 100);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const stepPreviewZoom = (delta: number) =>
    setPreviewZoom((z) => Math.round(Math.min(3, Math.max(0.25, z + delta)) * 100) / 100);

  const previewBoxStyle = useMemo(() => {
    if (previewViewportSize.width <= 0 || previewViewportSize.height <= 0) return undefined;
    const aspect =
      renderParams.outputAspect === '9:16'
        ? 9 / 16
        : renderParams.outputAspect === '1:1'
          ? 1
          : 16 / 9;
    const availW = Math.max(200, previewViewportSize.width - 12);
    const availH = Math.max(120, previewViewportSize.height - 12);
    const fitW = Math.min(availW, availH * aspect);
    const fitH = fitW / aspect;
    return {
      width: Math.max(120, Math.round(fitW * previewZoom)),
      height: Math.max(80, Math.round(fitH * previewZoom)),
    };
  }, [previewViewportSize.width, previewViewportSize.height, renderParams.outputAspect, previewZoom]);

  const activeSceneIndex = useMemo(
    () => scenes.findIndex((sc) => sc.id === activeSceneId),
    [scenes, activeSceneId]
  );

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

  // While editing a photo that has Start/End keyframes, the preview shows exactly the pose being edited.
  const keyframeEditPhase = useAppStore((s) => s.keyframeEditPhase);
  const focalHasKeyframes = Boolean(focalTargetPhoto?.transformEnd);
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setKeyframePreview(transformEditMode && focalHasKeyframes ? keyframeEditPhase : null);
    const s = useAppStore.getState();
    engine.renderFrame(s.frameIndex, s.fps, s.renderParams, s.compareMode);
  }, [transformEditMode, focalHasKeyframes, keyframeEditPhase, slides]);

  const effectiveDurationSec = useMemo(
    () =>
      computeProjectDurationSec(scenes, renderParams),
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
  }, []);

  useKeyboardShortcuts({
    isExporting,
    totalFrames,
    onEscape: (inInput) => {
      setIsFullscreenPreview(false);
      setShowShortcutsModal(false);
      setShowSettings(false);
      setShowExportDialog(false);
      setFocalPickMode(false);
      setTextDragMode(false);
      if (!inInput) {
        setTransformEditMode(false);
        setCropMode(false);
      }
    },
    onSave: () => void handleSaveProject(),
    onToggleFullscreen: () => setIsFullscreenPreview((v) => !v),
    onOpenExport: () => setShowExportDialog(true),
    onNotice: flashNotice,
  });

  const { contextLost, liveFps } = usePreviewEngine({
    canvasRef,
    engineRef,
    isExporting,
    previewSize: resolvedSize,
    effectiveDurationSec,
  });

  const files = useProjectFiles({ engineRef, isExporting, onNotice: flashNotice, onError: setExportError });
  const {
    loadingSlides,
    autosaveBanner,
    dismissAutosave,
    restoreAutosave,
    isDraggingFiles,
    setIsDraggingFiles,
    handleLoadSamples,
    handlePickImages,
    handlePickFolder,
    handleWindowDrop,
    handlePickCubeLut,
    handleClearLut,
    handleSaveProject,
    handleOpenProject,
  } = files;

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!focalPickMode || !focalTargetPhoto) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0.15, Math.min(0.85, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0.15, Math.min(0.85, (e.clientY - rect.top) / rect.height));
    updatePhotoFocalPoint(focalTargetPhoto.id, { x, y });
    flashNotice(`Đã đặt tâm ảnh ${focalTargetPhoto.name} (${Math.round(x * 100)}%, ${Math.round(y * 100)}%)`);
  };

  const handlePickMultiFolders = async () => {
    const api = window.frameSlideAPI;
    if (!api) return;
    const res = await api.pickMultiFolders();
    if (res.canceled) return;
    if (res.folders.length === 0) {
      flashNotice('Không tìm thấy ảnh hợp lệ trong thư mục vừa chọn.');
      return;
    }
    setMultiFolderQueue(res.folders);
  };


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
      <TopToolbar
        busy={loadingSlides}
        isExporting={isExporting}
        onOpenProject={handleOpenProject}
        onSaveProject={handleSaveProject}
        onPickImages={handlePickImages}
        onPickFolder={handlePickFolder}
        onPickMultiFolders={() => void handlePickMultiFolders()}
        onLoadSamples={handleLoadSamples}
        onShowShortcuts={() => setShowShortcutsModal(true)}
        onShowSettings={() => setShowSettings(true)}
        onShowExport={() => setShowExportDialog(true)}
      />

      {!isFullscreenPreview && (
        <WorkspaceTabs disabled={isExporting || loadingSlides} onNotice={flashNotice} />
      )}

      {/* Autosave Restore Banner */}
      {autosaveBanner && (
        <div className="flex items-center justify-between border-b border-amber-500/30 bg-amber-950/30 px-4 py-1.5 text-xs text-amber-200">
          <span>
            Phát hiện bản tự động lưu (
            {autosaveBanner.workspaces && autosaveBanner.workspaces.length > 1
              ? `${autosaveBanner.workspaces.length} dự án`
              : `${autosaveBanner.slides.length} ảnh`}{' '}
            lúc {new Date(autosaveBanner.savedAt).toLocaleTimeString()}). Khôi phục?
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={restoreAutosave}
              className="rounded bg-amber-500 px-2.5 py-0.5 font-medium text-zinc-950"
            >
              Khôi phục
            </button>
            <button
              onClick={dismissAutosave}
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
        <main className="flex min-w-0 flex-1 flex-col justify-between overflow-hidden p-2">
          {!isFullscreenPreview && (
            <div className="flex w-full shrink-0 items-center gap-2 pb-1">
              <div className="min-w-0 flex-1">
                {scenes.length > 0 && (
                  <PhotoQuickBar
                    photo={focalTargetPhoto}
                    photoNumber={focalTargetPhoto ? slides.indexOf(focalTargetPhoto) + 1 : null}
                    disabled={isExporting || textDragMode}
                    focalPickMode={focalPickMode}
                    editMode={transformEditMode}
                    cropMode={cropMode}
                    onEdit={() => (transformEditMode ? setTransformEditMode(false) : startTransformEdit())}
                    onCrop={() => (cropMode ? setCropMode(false) : startCrop())}
                    onToggleFocalPick={() => {
                      setTransformEditMode(false);
                      setCropMode(false);
                      setFocalPickMode(!focalPickMode);
                    }}
                    onToolSlot={setPhotoToolSlot}
                  />
                )}
              </div>
              <div
                className="flex shrink-0 items-center gap-1 rounded border border-zinc-800 bg-zinc-900/90 px-1.5 py-1 text-xs"
                title="Phóng to / thu nhỏ khung xem (Ctrl + cuộn chuột)"
              >
                <button
                  type="button"
                  onClick={() => stepPreviewZoom(-0.15)}
                  disabled={previewZoom <= 0.25}
                  title="Thu nhỏ khung xem"
                  aria-label="Thu nhỏ khung xem"
                  className="flex h-7 w-7 items-center justify-center rounded border border-zinc-700 bg-zinc-800 text-sm font-semibold text-zinc-200 hover:border-amber-400 hover:text-amber-300 disabled:opacity-35"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewZoom(1)}
                  title="Đặt lại vừa khít khung xem (100%)"
                  className={`h-7 min-w-[54px] rounded px-2 font-mono text-xs font-medium transition ${
                    previewZoom === 1
                      ? 'text-zinc-300 hover:bg-zinc-800'
                      : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                  }`}
                >
                  {previewZoom === 1 ? 'Vừa' : `${Math.round(previewZoom * 100)}%`}
                </button>
                <button
                  type="button"
                  onClick={() => stepPreviewZoom(0.15)}
                  disabled={previewZoom >= 3}
                  title="Phóng to khung xem"
                  aria-label="Phóng to khung xem"
                  className="flex h-7 w-7 items-center justify-center rounded border border-zinc-700 bg-zinc-800 text-sm font-semibold text-zinc-200 hover:border-amber-400 hover:text-amber-300 disabled:opacity-35"
                >
                  +
                </button>
              </div>
            </div>
          )}
          <div
            ref={previewViewportRef}
            className="flex min-h-0 flex-1 overflow-auto"
          >
            <div
              style={previewBoxStyle}
              className={`relative m-auto shrink-0 overflow-hidden rounded-lg border border-zinc-800 bg-black shadow-2xl ${
                previewBoxStyle
                  ? ''
                  : renderParams.outputAspect === '9:16'
                    ? 'aspect-[9/16] h-full'
                    : renderParams.outputAspect === '1:1'
                      ? 'aspect-square h-full'
                      : 'aspect-video h-full max-w-full'
              }`}
            >
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className={`h-full w-full object-contain ${focalPickMode ? 'cursor-crosshair' : ''}`}
              />

              {!loadingSlides && (
                <PreviewEmptyState
                  hasPhotos={slides.length > 0}
                  hasScenes={scenes.length > 0}
                  onPickImages={handlePickImages}
                  onPickFolder={handlePickFolder}
                  onLoadSamples={handleLoadSamples}
                />
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

              {textDragMode && !isExporting && scenes.length > 0 && (
                <TextDragOverlay onClose={() => setTextDragMode(false)} />
              )}

              {cropMode && !isExporting && scenes.length > 0 && (
                <PhotoCropOverlay canvasRef={canvasRef} toolSlot={photoToolSlot} onClose={() => setCropMode(false)} />
              )}

              {transformEditMode && !isExporting && scenes.length > 0 && (
                <PhotoTransformOverlay
                  canvasRef={canvasRef}
                  toolSlot={photoToolSlot}
                  onClose={() => setTransformEditMode(false)}
                />
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
          <InspectorNav
            activeSceneIndex={activeSceneIndex}
            photo={focalTargetPhoto}
            photoLabel={
              focalTargetPhoto && !selectedPhotoId && (activeScene?.slots.length ?? 0) > 1
                ? `Ảnh ${activeSlotIndex + 1}`
                : focalTargetPhoto?.name ?? ''
            }
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          <div className="flex-1 space-y-4 overflow-y-auto p-3.5">
            {inspectorScope === 'scene' && <ScenePanel disabled={isExporting} onNotice={flashNotice} />}
            {inspectorScope === 'photo' && (
              <PhotoPanel
                photo={focalTargetPhoto}
                disabled={isExporting}
                focalPickMode={focalPickMode}
                onToggleFocalPick={() => setFocalPickMode(!focalPickMode)}
                onStartTransformEdit={startTransformEdit}
                focalSuffix={
                  !selectedPhotoId && activeScene && activeScene.slots.length > 1
                    ? ` [Ô ${activeSlotIndex + 1}]`
                    : ''
                }
              />
            )}
            {inspectorScope === 'project' && activeTab === 'template' && (
              <TemplateTab disabled={isExporting} onNotice={flashNotice} />
            )}
            {inspectorScope === 'project' && activeTab === 'look' && (
              <LookTab
                disabled={isExporting}
                onNotice={flashNotice}
                onPickLut={handlePickCubeLut}
                onClearLut={handleClearLut}
              />
            )}
            {inspectorScope === 'project' && activeTab === 'text' && (
              <TextTab
                disabled={isExporting}
                textDragMode={textDragMode}
                onToggleTextDrag={() => {
                  setTransformEditMode(false);
                  setFocalPickMode(false);
                  setTextDragMode((v) => !v);
                }}
              />
            )}

          </div>
        </aside>
        )}
      </div>


      {showExportDialog && (
        <ExportDialog
          jobs={exportJobs}
          appInfo={appInfo}
          exportSize={exportRes}
          effectiveDurationSec={effectiveDurationSec}
          onClose={() => setShowExportDialog(false)}
        />
      )}

      {showShortcutsModal && <ShortcutsModal onClose={() => setShowShortcutsModal(false)} />}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {multiFolderQueue && (
        <MultiFolderImportModal
          folders={multiFolderQueue}
          onClose={() => setMultiFolderQueue(null)}
          onImported={(count, autoBuilt) =>
            flashNotice(
              autoBuilt
                ? `Đã tạo ${count} tab dự án riêng và tự xếp ảnh lên Timeline.`
                : `Đã tạo ${count} tab dự án riêng và nạp ảnh vào khay.`
            )
          }
        />
      )}

      <GpuNotice />
      <StatusFooter appInfo={appInfo} previewSize={resolvedSize} liveFps={liveFps} notice={statusNotice} />
    </div>
  );
}
