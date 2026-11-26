import { useEffect, useState, type DragEvent } from 'react';
import type { FrameSlideEngine } from '@engine/FrameSlideEngine';
import type { ProjectFileData, SlideAsset } from '@shared/types';
import { createBrowserFallbackSamples } from '../sampleImages';
import { useAppStore } from '../store/useAppStore';
import { usePrefsStore } from '../store/usePrefsStore';

interface Options {
  engineRef: { current: FrameSlideEngine | null };
  isExporting: boolean;
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
}

/**
 * Everything that reads or writes files: photo import (pick / folder / drop / samples),
 * .cube LUT, project open / save, autosave and its restore banner.
 */
export function useProjectFiles({ engineRef, isExporting, onNotice, onError }: Options) {
  const [loadingSlides, setLoadingSlides] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [autosaveBanner, setAutosaveBanner] = useState<ProjectFileData | null>(null);
  const setIsPlaying = useAppStore((s) => s.setIsPlaying);
  const setSlides = useAppStore((s) => s.setSlides);
  const addPhotosToBin = useAppStore((s) => s.addPhotosToBin);
  const setCustomLut = useAppStore((s) => s.setCustomLut);
  const setProjectFilePath = useAppStore((s) => s.setProjectFilePath);
  const loadProjectData = useAppStore((s) => s.loadProjectData);

  useEffect(() => {
    window.frameSlideAPI
      ?.loadAutosave()
      .then((saved) => {
        if (
          saved &&
          (saved.slides.length > 0 || saved.workspaces?.some((w) => w.slides.length > 0))
        ) {
          setAutosaveBanner(saved);
        }
      })
      .catch(() => {});
  }, []);

  const autosaveSec = usePrefsStore((s) => s.autosaveSec);

  useEffect(() => {
    if (!window.frameSlideAPI || autosaveSec <= 0) return;
    const timer = setInterval(() => {
      const state = useAppStore.getState();
      const allWs = state.getAllWorkspacesSnapshot();
      const hasRealWork = allWs.some(
        (w) => (w.slides.length > 0 && !w.isSampleOnly) || w.past.length > 0
      );
      if (hasRealWork) {
        void window.frameSlideAPI?.writeAutosave(state.toProjectFileData());
      }
    }, autosaveSec * 1000);
    return () => clearInterval(timer);
  }, [autosaveSec]);

  useEffect(() => {
    let active = true;
    const initSamples = async () => {
      setLoadingSlides(true);
      try {
        const loaded = window.frameSlideAPI
          ? await window.frameSlideAPI.loadSampleImages()
          : createBrowserFallbackSamples();
        const st = useAppStore.getState();
        const untouchedSample =
          st.workspaces.length === 1 &&
          st.workspaces[0]?.isSampleOnly &&
          st.slides.length === 0 &&
          !st.projectFilePath;
        if (active && untouchedSample) setSlides(loaded, false, true);
      } catch {
        const st = useAppStore.getState();
        const untouchedSample =
          st.workspaces.length === 1 &&
          st.workspaces[0]?.isSampleOnly &&
          st.slides.length === 0 &&
          !st.projectFilePath;
        if (active && untouchedSample) setSlides(createBrowserFallbackSamples(), false, true);
      } finally {
        if (active) setLoadingSlides(false);
      }
    };
    void initSamples();
    return () => {
      active = false;
    };
  }, [setSlides]);

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
      setSlides(loaded, true, true);
    } finally {
      setLoadingSlides(false);
    }
  };

  /** Stop playback, show the loading state, add whatever `load` returns to the photo tray. */
  const importIntoBin = async (load: () => Promise<SlideAsset[]>) => {
    setIsPlaying(false);
    setLoadingSlides(true);
    try {
      const picked = await load();
      if (picked.length > 0) {
        const added = addPhotosToBin(picked);
        onNotice(binImportNotice(picked.length, added));
      }
    } finally {
      setLoadingSlides(false);
    }
  };

  const handlePickImages = async () => {
    const api = window.frameSlideAPI;
    if (api) await importIntoBin(() => api.pickImages());
  };

  const handlePickFolder = async () => {
    const api = window.frameSlideAPI;
    if (api) await importIntoBin(() => api.pickFolderImages());
  };

  const handleWindowDrop = async (e: DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-frameslide')) return;
    e.preventDefault();
    setIsDraggingFiles(false);
    if (!window.frameSlideAPI || !window.frameSlideGetFilePath || isExporting) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const paths = files.map((f) => window.frameSlideGetFilePath!(f)).filter(Boolean);
    if (paths.length === 0) return;

    const api = window.frameSlideAPI;
    await importIntoBin(() => api.importPaths(paths));
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
        onNotice(`Đã nạp 3D LUT ${res.name} (${parsed.size}³).`);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
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
      onNotice('Đã lưu dự án (.frameslide).');
    }
  };

  const restoreProjectState = async (data: ProjectFileData, filePath: string | null) => {
    setIsPlaying(false);
    setLoadingSlides(true);
    try {
      let nextData = data;
      if (window.frameSlideAPI && data.version === 3 && Array.isArray(data.workspaces)) {
        const rehydratedWorkspaces = [];
        for (const ws of data.workspaces) {
          rehydratedWorkspaces.push({
            ...ws,
            slides: await window.frameSlideAPI.rehydrateSlides(ws.slides),
          });
        }
        const activeWs =
          rehydratedWorkspaces.find((w) => w.id === data.activeWorkspaceId) ??
          rehydratedWorkspaces[0];
        nextData = {
          ...data,
          slides: activeWs?.slides ?? data.slides,
          workspaces: rehydratedWorkspaces,
        };
      } else if (window.frameSlideAPI) {
        const rehydratedSlides = await window.frameSlideAPI.rehydrateSlides(data.slides);
        nextData = { ...data, slides: rehydratedSlides };
      }

      loadProjectData(nextData, filePath);

      const activeLutPath = useAppStore.getState().customLut?.filePath ?? null;
      let lutRestored = false;
      if (activeLutPath && window.frameSlideAPI) {
        const content = await window.frameSlideAPI.readTextFile(activeLutPath);
        if (content && engineRef.current) {
          try {
            const parsed = engineRef.current.setCustomCubeLut(content);
            if (parsed) {
              setCustomLut({
                name: parsed.title,
                filePath: activeLutPath,
                size: parsed.size,
              });
              lutRestored = true;
            }
          } catch {
            // Broken / moved .cube file: fall through and clear the LUT below
          }
        }
        if (!lutRestored) {
          onNotice('Không tìm thấy file LUT của dự án, đã tắt LUT.');
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
      onNotice('Đã mở dự án thành công.');
    } catch (err) {
      onError(
        `Không mở được dự án (file .frameslide bị hỏng hoặc sai định dạng): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  };

  return {
    loadingSlides,
    autosaveBanner,
    dismissAutosave: () => setAutosaveBanner(null),
    restoreAutosave: () => {
      const banner = autosaveBanner;
      setAutosaveBanner(null);
      if (banner) void restoreProjectState(banner, null);
    },
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
  };
}
