import { create } from 'zustand';
import { getFilmLookPreset } from '@engine/presets/filmLookPresets';
import { getMotionTemplate } from '@engine/presets/motionTemplates';
import { CINEMATIC_RANDOM_TRANSITIONS } from '@engine/presets/transitions';
import {
  autoFillScenesWithPhotos,
  buildScenesFromPhotos,
  createEmptyScene,
  resizeSceneSlots,
} from '@engine/sceneBuilder';
import { DEFAULT_BACKGROUND_OPTIONS } from '@engine/background';
import { isIdentityTransform, normalizePhotoTransform } from '@engine/photoTransform';
import { resolveSlideDurations } from '@engine/timeline';
import {
  DEFAULT_SUPER8_PARAMS,
  DEFAULT_TEXT_OVERLAY,
  type BackgroundOptions,
  type BackgroundStyle,
  type PhotoTransform,
  type SceneBackground,
  type CompareMode,
  type CustomLutInfo,
  type DurationMode,
  type EngineCapabilities,
  type FilmLookId,
  type FilmLookParams,
  type FocalPoint,
  type FrameBorderStyle,
  type MotionDirection,
  type MotionTemplateId,
  type OutputAspectId,
  type PortraitMode,
  type PreviewQuality,
  type ProjectFileData,
  type RenderParams,
  type SceneItem,
  type SceneLayoutId,
  type SlideAsset,
  type SortOrder,
  type SupportedFps,
  type TextOverlayConfig,
  type TransitionType,
  type UserPreset,
} from '@shared/types';

interface HistorySnapshot {
  fps: SupportedFps;
  slides: SlideAsset[];
  scenes: SceneItem[];
  renderParams: RenderParams;
}

const MAX_HISTORY = 40;
const USER_PRESETS_KEY = 'frameslide_user_presets_v1';

function loadUserPresets(): UserPreset[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(USER_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UserPreset[]) : [];
  } catch {
    return [];
  }
}

function persistUserPresets(presets: UserPreset[]): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(presets));
    }
  } catch {
    // ignore storage quota errors
  }
}

interface AppState {
  fps: SupportedFps;
  previewQuality: PreviewQuality;
  compareMode: CompareMode;
  frameIndex: number;
  isPlaying: boolean;
  slides: SlideAsset[];
  scenes: SceneItem[];
  activeSceneId: string | null;
  activeSlotIndex: number;
  selectedPhotoId: string | null;
  /** Multi-selection in the photo tray (Ctrl/Shift click). Used by "Thêm ảnh đã chọn". */
  selectedPhotoIds: string[];
  renderParams: RenderParams;
  engineCapabilities: EngineCapabilities | null;
  customLut: CustomLutInfo | null;
  userPresets: UserPreset[];
  projectFilePath: string | null;
  past: HistorySnapshot[];
  future: HistorySnapshot[];

  setFps: (fps: SupportedFps) => void;
  setPreviewQuality: (quality: PreviewQuality) => void;
  setCompareMode: (mode: CompareMode) => void;
  setFrameIndex: (frame: number) => void;
  setIsPlaying: (playing: boolean) => void;

  // Photo Bin actions
  setSlides: (slides: SlideAsset[], pushHistory?: boolean) => void;
  /** Add photos to the tray only (no scenes are created). Returns how many were new. */
  addPhotosToBin: (incoming: SlideAsset[]) => number;
  /** Build scenes from the given tray photos (in tray order) and append them to the timeline. Returns scenes added. */
  appendScenesForPhotos: (photoIds: string[]) => number;
  setPhotoSelection: (photoIds: string[], primaryId?: string | null) => void;
  removePhoto: (photoId: string) => void;
  sortSlides: (order: SortOrder) => void;
  selectPhoto: (photoId: string | null) => void;
  updatePhotoFocalPoint: (photoId: string, focalPoint: FocalPoint) => void;
  rotatePhoto90: (photoId: string) => void;
  setPhotoExposure: (photoId: string, exposure: number) => void;
  /**
   * Move / scale / rotate a photo inside its frame. `null` resets it.
   * Pass recordHistory=false while dragging (call pushUndoPoint once at drag start).
   */
  setPhotoTransform: (
    photoId: string,
    transform: Partial<PhotoTransform> | null,
    recordHistory?: boolean
  ) => void;
  pushUndoPoint: () => void;

  // Scene Track & Photo Slots actions
  setActiveSceneSilent: (sceneId: string) => void;
  selectSceneAndSeek: (sceneId: string, slotIndex?: number) => void;
  /** Jump the playhead to a position inside a scene (0 = start, 1 = end) and show that scene. */
  seekToSceneFraction: (sceneId: string, fraction: number) => void;
  addScene: (layout: SceneLayoutId) => void;
  duplicateScene: (sceneId: string) => void;
  removeScene: (sceneId: string) => void;
  moveScene: (sceneId: string, dir: -1 | 1) => void;
  reorderScene: (fromSceneId: string, toSceneId: string) => void;
  randomizeSceneTransitions: (seed?: number) => void;
  setSceneLayout: (sceneId: string, layout: SceneLayoutId) => void;
  setSceneDuration: (sceneId: string, durationSec: number) => void;
  setSceneTransition: (sceneId: string, transitionType: TransitionType) => void;
  setSceneMotionDirection: (sceneId: string, motionDirection: MotionDirection) => void;
  setSceneCaption: (sceneId: string, caption: string) => void;
  assignPhotoToSlot: (sceneId: string, slotIndex: number, photoId: string | null) => void;
  swapSceneSlots: (srcSceneId: string, srcIdx: number, dstSceneId: string, dstIdx: number) => void;
  autoFillScenes: () => void;
  clearAllSceneSlots: () => void;
  rebuildScenesFromPhotos: () => void;

  // Templates, Film Looks, Timeline, Motion & Text
  applyMotionTemplate: (templateId: MotionTemplateId, rebuildLayout?: boolean) => void;
  applyFilmLookPreset: (lookId: FilmLookId) => void;
  setMotionIntensity: (v: number) => void;
  setBackgroundStyle: (style: BackgroundStyle) => void;
  setBackgroundOptions: (patch: Partial<BackgroundOptions>) => void;
  /** Give one scene its own background (null = use the project background again). */
  setSceneBackground: (sceneId: string, background: SceneBackground | null) => void;
  clearAllSceneBackgrounds: () => void;
  setFrameBorderStyle: (style: FrameBorderStyle) => void;
  setOutputAspect: (aspect: OutputAspectId) => void;
  setDurationMode: (mode: DurationMode) => void;
  setTotalDurationSec: (sec: number) => void;
  setDefaultSlideDurationSec: (sec: number) => void;
  setHandlesSec: (sec: number) => void;
  setVideoFadeInSec: (sec: number) => void;
  setVideoFadeOutSec: (sec: number) => void;
  setTransitionType: (type: TransitionType) => void;
  setTransitionDurationSec: (sec: number) => void;
  setPortraitMode: (mode: PortraitMode) => void;
  updateSuper8: (patch: Partial<FilmLookParams>) => void;
  setLutIntensity: (v: number) => void;
  setCustomLut: (lut: CustomLutInfo | null) => void;
  updateTextOverlay: (patch: Partial<TextOverlayConfig>) => void;

  // User Presets
  saveUserPreset: (name: string) => void;
  deleteUserPreset: (id: string) => void;
  applyUserPreset: (id: string) => void;

  // Project & History
  setProjectFilePath: (path: string | null) => void;
  loadProjectData: (data: ProjectFileData, filePath: string | null) => void;
  toProjectFileData: () => ProjectFileData;
  undo: () => void;
  redo: () => void;
  setEngineCapabilities: (caps: EngineCapabilities) => void;
}

function takeSnapshot(state: AppState): HistorySnapshot {
  return {
    fps: state.fps,
    slides: state.slides.map((s) => ({ ...s, focalPoint: { ...s.focalPoint } })),
    scenes: state.scenes.map((sc) => ({ ...sc, slots: [...sc.slots] })),
    renderParams: {
      ...state.renderParams,
      super8: { ...state.renderParams.super8 },
      textOverlay: { ...state.renderParams.textOverlay },
    },
  };
}

/** Start time and length (seconds) of scene `idx`, using the same rules as the render timeline. */
export function getSceneTimeRange(
  s: Pick<AppState, 'scenes' | 'renderParams'>,
  idx: number
): { startSec: number; durationSec: number } {
  const durations = resolveSlideDurations(s.scenes.length, {
    durationMode: s.renderParams.durationMode,
    totalDurationSec: s.renderParams.totalDurationSec,
    defaultSlideDurationSec: s.renderParams.defaultSlideDurationSec,
    slideDurations: s.scenes.map((item) => item.durationSec),
    handlesSec: s.renderParams.handlesSec,
  });
  let startSec = 0;
  for (let i = 0; i < idx; i++) startSec += durations[i];
  return { startSec, durationSec: durations[idx] ?? 0 };
}

function pushPast(state: AppState): { past: HistorySnapshot[]; future: HistorySnapshot[] } {
  const nextPast = [...state.past, takeSnapshot(state)];
  if (nextPast.length > MAX_HISTORY) nextPast.shift();
  return { past: nextPast, future: [] };
}

export const INITIAL_RENDER_PARAMS: RenderParams = {
  motionTemplate: 'ken-burns-classic',
  motionIntensity: 1.0,
  backgroundStyle: 'blur',
  backgroundOptions: { ...DEFAULT_BACKGROUND_OPTIONS },
  frameBorderStyle: 'auto',
  outputAspect: '16:9',
  durationMode: 'per-slide',
  totalDurationSec: 15,
  defaultSlideDurationSec: 3.5,
  handlesSec: 0,
  videoFadeInSec: 0,
  videoFadeOutSec: 0,
  transitionType: 'light-leak',
  transitionDurationSec: 0.9,
  portraitMode: 'smart-pairing',
  super8: { ...DEFAULT_SUPER8_PARAMS },
  lutIntensity: 0.85,
  textOverlay: { ...DEFAULT_TEXT_OVERLAY },
};

export const useAppStore = create<AppState>((set, get) => ({
  fps: 30,
  previewQuality: 'auto',
  compareMode: 'normal',
  frameIndex: 0,
  isPlaying: false,
  slides: [],
  scenes: [],
  activeSceneId: null,
  activeSlotIndex: 0,
  selectedPhotoId: null,
  selectedPhotoIds: [],
  renderParams: INITIAL_RENDER_PARAMS,
  engineCapabilities: null,
  customLut: null,
  userPresets: loadUserPresets(),
  projectFilePath: null,
  past: [],
  future: [],

  setFps: (fps) => set((s) => ({ ...pushPast(s), fps })),
  setPreviewQuality: (previewQuality) => set({ previewQuality }),
  setCompareMode: (compareMode) => set({ compareMode }),
  setFrameIndex: (frameIndex) => set({ frameIndex }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),

  setSlides: (slides, recordHistory = false) =>
    set((s) => {
      const builtScenes = buildScenesFromPhotos({
        photos: slides,
        portraitMode: s.renderParams.portraitMode,
        motionTemplate: s.renderParams.motionTemplate,
        defaultDurationSec: s.renderParams.defaultSlideDurationSec,
        defaultTransition: s.renderParams.transitionType,
      });
      return {
        ...(recordHistory ? pushPast(s) : {}),
        slides,
        scenes: builtScenes,
        activeSceneId: builtScenes[0]?.id ?? null,
        selectedPhotoId: null,
        selectedPhotoIds: [],
        frameIndex: 0,
      };
    }),

  addPhotosToBin: (incoming) => {
    const s = get();
    const existingIds = new Set(s.slides.map((x) => x.id));
    const seen = new Set<string>();
    const unique = incoming.filter((x) => {
      if (existingIds.has(x.id) || seen.has(x.id)) return false;
      seen.add(x.id);
      return true;
    });
    if (unique.length === 0) return 0;
    set({ ...pushPast(s), slides: [...s.slides, ...unique] });
    return unique.length;
  },

  appendScenesForPhotos: (photoIds) => {
    const s = get();
    const wanted = new Set(photoIds);
    const photos = s.slides.filter((p) => wanted.has(p.id));
    if (photos.length === 0) return 0;
    const extraScenes = buildScenesFromPhotos({
      photos,
      portraitMode: s.renderParams.portraitMode,
      motionTemplate: s.renderParams.motionTemplate,
      defaultDurationSec: s.renderParams.defaultSlideDurationSec,
      defaultTransition: s.renderParams.transitionType,
    });
    if (extraScenes.length === 0) return 0;
    set({
      ...pushPast(s),
      scenes: [...s.scenes, ...extraScenes],
      activeSceneId: s.activeSceneId ?? extraScenes[0].id,
    });
    return extraScenes.length;
  },

  setPhotoSelection: (photoIds, primaryId) =>
    set({
      selectedPhotoIds: photoIds,
      selectedPhotoId:
        primaryId !== undefined ? primaryId : photoIds.length === 1 ? photoIds[0] : null,
    }),

  removePhoto: (photoId) =>
    set((s) => {
      const nextSlides = s.slides.filter((item) => item.id !== photoId);
      const nextScenes = s.scenes.map((sc) => ({
        ...sc,
        slots: sc.slots.map((pid) => (pid === photoId ? null : pid)),
      }));
      return {
        ...pushPast(s),
        slides: nextSlides,
        scenes: nextScenes,
        selectedPhotoId: s.selectedPhotoId === photoId ? null : s.selectedPhotoId,
        selectedPhotoIds: s.selectedPhotoIds.filter((id) => id !== photoId),
      };
    }),

  sortSlides: (order) =>
    set((s) => {
      if (order === 'manual') return s;
      const next = [...s.slides];
      next.sort((a, b) => {
        switch (order) {
          case 'date-asc':
            return a.takenAtMs - b.takenAtMs || a.name.localeCompare(b.name);
          case 'date-desc':
            return b.takenAtMs - a.takenAtMs || b.name.localeCompare(a.name);
          case 'name-asc':
            return a.name.localeCompare(b.name, undefined, { numeric: true });
          case 'name-desc':
            return b.name.localeCompare(a.name, undefined, { numeric: true });
          default:
            return 0;
        }
      });
      return { ...pushPast(s), slides: next };
    }),

  selectPhoto: (selectedPhotoId) =>
    set({ selectedPhotoId, selectedPhotoIds: selectedPhotoId ? [selectedPhotoId] : [] }),

  updatePhotoFocalPoint: (photoId, focalPoint) =>
    set((s) => ({
      ...pushPast(s),
      slides: s.slides.map((item) => (item.id === photoId ? { ...item, focalPoint } : item)),
    })),

  rotatePhoto90: (photoId) =>
    set((s) => ({
      ...pushPast(s),
      slides: s.slides.map((item) => {
        if (item.id !== photoId) return item;
        const nextRot = (((item.rotationDeg ?? 0) + 90) % 360) as 0 | 90 | 180 | 270;
        return { ...item, rotationDeg: nextRot };
      }),
    })),

  setPhotoExposure: (photoId, exposure) =>
    set((s) => ({
      slides: s.slides.map((item) =>
        item.id === photoId
          ? { ...item, exposure: Math.max(-1.5, Math.min(1.5, exposure)) }
          : item
      ),
    })),

  setPhotoTransform: (photoId, transform, recordHistory = true) =>
    set((s) => ({
      ...(recordHistory ? pushPast(s) : {}),
      slides: s.slides.map((item) => {
        if (item.id !== photoId) return item;
        if (!transform) {
          const { transform: _drop, ...rest } = item;
          void _drop;
          return rest;
        }
        const next = normalizePhotoTransform({ ...item.transform, ...transform });
        if (isIdentityTransform(next)) {
          const { transform: _drop, ...rest } = item;
          void _drop;
          return rest;
        }
        return { ...item, transform: next };
      }),
    })),

  pushUndoPoint: () => set((s) => pushPast(s)),

  setActiveSceneSilent: (sceneId) =>
    set((s) =>
      s.activeSceneId === sceneId ? s : { activeSceneId: sceneId, activeSlotIndex: 0 }
    ),

  selectSceneAndSeek: (sceneId, slotIndex = 0) =>
    set((s) => {
      const idx = s.scenes.findIndex((sc) => sc.id === sceneId);
      if (idx < 0) return { activeSceneId: sceneId, activeSlotIndex: 0 };
      const sc = s.scenes[idx];
      const clampedSlot = Math.max(0, Math.min(sc.slots.length - 1, slotIndex));
      const { startSec } = getSceneTimeRange(s, idx);
      // Land slightly inside the scene (past any incoming transition) for clean preview
      const targetFrame = Math.round((startSec + 0.05) * s.fps);
      return {
        activeSceneId: sceneId,
        activeSlotIndex: clampedSlot,
        frameIndex: targetFrame,
        isPlaying: false,
      };
    }),

  seekToSceneFraction: (sceneId, fraction) =>
    set((s) => {
      const idx = s.scenes.findIndex((sc) => sc.id === sceneId);
      if (idx < 0) return s;
      const { startSec, durationSec } = getSceneTimeRange(s, idx);
      const startFrame = Math.round(startSec * s.fps);
      const lastFrame = Math.max(startFrame, Math.round((startSec + durationSec) * s.fps) - 1);
      const f = Math.max(0, Math.min(1, fraction));
      const targetFrame = Math.max(
        startFrame,
        Math.min(lastFrame, Math.round((startSec + f * durationSec) * s.fps))
      );
      return {
        activeSceneId: sceneId,
        activeSlotIndex: s.activeSceneId === sceneId ? s.activeSlotIndex : 0,
        frameIndex: targetFrame,
        isPlaying: false,
      };
    }),

  addScene: (layout) =>
    set((s) => {
      const created = createEmptyScene(
        layout,
        s.renderParams.defaultSlideDurationSec,
        s.renderParams.transitionType
      );
      const nextScenes = [...s.scenes, created];
      return {
        ...pushPast(s),
        scenes: nextScenes,
        activeSceneId: created.id,
      };
    }),

  duplicateScene: (sceneId) =>
    set((s) => {
      const idx = s.scenes.findIndex((sc) => sc.id === sceneId);
      if (idx < 0) return s;
      const src = s.scenes[idx];
      const cloned: SceneItem = {
        ...createEmptyScene(src.layout, src.durationSec, src.transitionType),
        slots: [...src.slots],
        motionDirection: src.motionDirection,
        caption: src.caption,
      };
      const nextScenes = [...s.scenes];
      nextScenes.splice(idx + 1, 0, cloned);
      return {
        ...pushPast(s),
        scenes: nextScenes,
        activeSceneId: cloned.id,
        activeSlotIndex: 0,
      };
    }),

  removeScene: (sceneId) =>
    set((s) => {
      if (s.scenes.length <= 1) return s;
      const nextScenes = s.scenes.filter((sc) => sc.id !== sceneId);
      return {
        ...pushPast(s),
        scenes: nextScenes,
        activeSceneId: s.activeSceneId === sceneId ? (nextScenes[0]?.id ?? null) : s.activeSceneId,
        frameIndex: 0,
      };
    }),

  moveScene: (sceneId, dir) =>
    set((s) => {
      const idx = s.scenes.findIndex((sc) => sc.id === sceneId);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= s.scenes.length) return s;
      const next = [...s.scenes];
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return { ...pushPast(s), scenes: next };
    }),

  reorderScene: (fromSceneId, toSceneId) =>
    set((s) => {
      if (fromSceneId === toSceneId) return s;
      const fromIdx = s.scenes.findIndex((sc) => sc.id === fromSceneId);
      const toIdx = s.scenes.findIndex((sc) => sc.id === toSceneId);
      if (fromIdx < 0 || toIdx < 0) return s;
      const next = [...s.scenes];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return { ...pushPast(s), scenes: next, activeSceneId: fromSceneId };
    }),

  randomizeSceneTransitions: (seed) =>
    set((s) => {
      if (s.scenes.length < 2) return s;
      const pool = CINEMATIC_RANDOM_TRANSITIONS;
      let rng = ((seed ?? Date.now()) >>> 0) || 1;
      const nextRand = () => {
        rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
        return rng / 4294967296;
      };

      let prev: TransitionType | null = null;
      const nextScenes = s.scenes.map((sc) => {
        let pick = pool[Math.floor(nextRand() * pool.length)];
        if (pick === prev && pool.length > 1) {
          const offset = 1 + Math.floor(nextRand() * (pool.length - 1));
          pick = pool[(pool.indexOf(pick) + offset) % pool.length];
        }
        prev = pick;
        return { ...sc, transitionType: pick };
      });
      return { ...pushPast(s), scenes: nextScenes };
    }),

  setSceneLayout: (sceneId, layout) =>
    set((s) => ({
      ...pushPast(s),
      scenes: s.scenes.map((sc) => (sc.id === sceneId ? resizeSceneSlots(sc, layout) : sc)),
      activeSceneId: sceneId,
    })),

  setSceneDuration: (sceneId, durationSec) =>
    set((s) => ({
      ...pushPast(s),
      scenes: s.scenes.map((sc) =>
        sc.id === sceneId ? { ...sc, durationSec: Math.max(0.5, Math.min(20, durationSec)) } : sc
      ),
    })),

  setSceneTransition: (sceneId, transitionType) =>
    set((s) => ({
      ...pushPast(s),
      scenes: s.scenes.map((sc) => (sc.id === sceneId ? { ...sc, transitionType } : sc)),
    })),

  setSceneMotionDirection: (sceneId, motionDirection) =>
    set((s) => ({
      ...pushPast(s),
      scenes: s.scenes.map((sc) => (sc.id === sceneId ? { ...sc, motionDirection } : sc)),
    })),

  setSceneCaption: (sceneId, caption) =>
    set((s) => ({
      scenes: s.scenes.map((sc) => (sc.id === sceneId ? { ...sc, caption } : sc)),
    })),

  assignPhotoToSlot: (sceneId, slotIndex, photoId) =>
    set((s) => ({
      ...pushPast(s),
      scenes: s.scenes.map((sc) => {
        if (sc.id !== sceneId) return sc;
        const nextSlots = [...sc.slots];
        if (slotIndex >= 0 && slotIndex < nextSlots.length) {
          nextSlots[slotIndex] = photoId;
        }
        return { ...sc, slots: nextSlots };
      }),
      activeSceneId: sceneId,
      activeSlotIndex: slotIndex,
      selectedPhotoId: null,
      selectedPhotoIds: [],
    })),

  swapSceneSlots: (srcSceneId, srcIdx, dstSceneId, dstIdx) =>
    set((s) => {
      if (srcSceneId === dstSceneId && srcIdx === dstIdx) return s;
      const srcScene = s.scenes.find((sc) => sc.id === srcSceneId);
      const dstScene = s.scenes.find((sc) => sc.id === dstSceneId);
      if (!srcScene || !dstScene) return s;
      const srcVal = srcScene.slots[srcIdx] ?? null;
      const dstVal = dstScene.slots[dstIdx] ?? null;

      const nextScenes = s.scenes.map((sc) => {
        if (sc.id !== srcSceneId && sc.id !== dstSceneId) return sc;
        const slots = [...sc.slots];
        if (sc.id === srcSceneId) slots[srcIdx] = dstVal;
        if (sc.id === dstSceneId) slots[dstIdx] = srcVal;
        return { ...sc, slots };
      });
      return { ...pushPast(s), scenes: nextScenes, activeSceneId: dstSceneId };
    }),

  autoFillScenes: () =>
    set((s) => ({
      ...pushPast(s),
      scenes: autoFillScenesWithPhotos(s.scenes, s.slides),
    })),

  clearAllSceneSlots: () =>
    set((s) => ({
      ...pushPast(s),
      scenes: s.scenes.map((sc) => ({ ...sc, slots: sc.slots.map(() => null) })),
    })),

  rebuildScenesFromPhotos: () =>
    set((s) => {
      const rebuilt = buildScenesFromPhotos({
        photos: s.slides,
        portraitMode: s.renderParams.portraitMode,
        motionTemplate: s.renderParams.motionTemplate,
        defaultDurationSec: s.renderParams.defaultSlideDurationSec,
        defaultTransition: s.renderParams.transitionType,
      });
      return {
        ...pushPast(s),
        scenes: rebuilt,
        activeSceneId: rebuilt[0]?.id ?? null,
        frameIndex: 0,
      };
    }),

  applyMotionTemplate: (templateId, rebuildLayout = true) =>
    set((s) => {
      const tpl = getMotionTemplate(templateId);
      const nextParams: RenderParams = {
        ...s.renderParams,
        motionTemplate: templateId,
        transitionType: tpl.recommendedTransition,
        portraitMode: tpl.recommendedPortraitMode,
        super8: getFilmLookPreset(tpl.recommendedLook),
        textOverlay: { ...s.renderParams.textOverlay, style: tpl.recommendedTextStyle },
      };

      const nextScenes = rebuildLayout
        ? buildScenesFromPhotos({
            photos: s.slides,
            portraitMode: nextParams.portraitMode,
            motionTemplate: templateId,
            defaultDurationSec: nextParams.defaultSlideDurationSec,
            defaultTransition: tpl.recommendedTransition,
          })
        : s.scenes.map((sc) => ({ ...sc, transitionType: tpl.recommendedTransition }));

      return {
        ...pushPast(s),
        renderParams: nextParams,
        scenes: nextScenes,
        activeSceneId: nextScenes[0]?.id ?? null,
        frameIndex: 0,
      };
    }),

  applyFilmLookPreset: (lookId) =>
    set((s) => ({
      ...pushPast(s),
      renderParams: {
        ...s.renderParams,
        super8: getFilmLookPreset(lookId),
      },
    })),

  setMotionIntensity: (motionIntensity) =>
    set((s) => ({
      renderParams: {
        ...s.renderParams,
        motionIntensity: Math.max(0, Math.min(1.5, motionIntensity)),
      },
    })),

  setBackgroundStyle: (backgroundStyle) =>
    set((s) => ({ ...pushPast(s), renderParams: { ...s.renderParams, backgroundStyle } })),

  setBackgroundOptions: (patch) =>
    set((s) => ({
      ...pushPast(s),
      renderParams: {
        ...s.renderParams,
        backgroundOptions: {
          ...DEFAULT_BACKGROUND_OPTIONS,
          ...(s.renderParams.backgroundOptions ?? {}),
          ...patch,
        },
      },
    })),

  setSceneBackground: (sceneId, background) =>
    set((s) => ({
      ...pushPast(s),
      scenes: s.scenes.map((sc) => {
        if (sc.id !== sceneId) return sc;
        if (!background) {
          const { background: _drop, ...rest } = sc;
          void _drop;
          return rest;
        }
        return { ...sc, background: { ...background } };
      }),
    })),

  clearAllSceneBackgrounds: () =>
    set((s) => {
      if (!s.scenes.some((sc) => sc.background)) return s;
      return {
        ...pushPast(s),
        scenes: s.scenes.map((sc) => {
          if (!sc.background) return sc;
          const { background: _drop, ...rest } = sc;
          void _drop;
          return rest;
        }),
      };
    }),

  setFrameBorderStyle: (frameBorderStyle) =>
    set((s) => ({ ...pushPast(s), renderParams: { ...s.renderParams, frameBorderStyle } })),

  setOutputAspect: (outputAspect) =>
    set((s) => ({ ...pushPast(s), renderParams: { ...s.renderParams, outputAspect } })),

  setDurationMode: (durationMode) =>
    set((s) => ({
      ...pushPast(s),
      renderParams: { ...s.renderParams, durationMode },
      frameIndex: 0,
    })),

  setTotalDurationSec: (totalDurationSec) =>
    set((s) => ({
      ...pushPast(s),
      renderParams: { ...s.renderParams, totalDurationSec },
      frameIndex: 0,
    })),

  setDefaultSlideDurationSec: (defaultSlideDurationSec) =>
    set((s) => ({
      ...pushPast(s),
      renderParams: { ...s.renderParams, defaultSlideDurationSec },
      frameIndex: 0,
    })),

  setHandlesSec: (handlesSec) =>
    set((s) => ({
      ...pushPast(s),
      renderParams: { ...s.renderParams, handlesSec },
      frameIndex: 0,
    })),

  setVideoFadeInSec: (videoFadeInSec) =>
    set((s) => ({
      renderParams: {
        ...s.renderParams,
        videoFadeInSec: Math.max(0, Math.min(2, videoFadeInSec)),
      },
    })),

  setVideoFadeOutSec: (videoFadeOutSec) =>
    set((s) => ({
      renderParams: {
        ...s.renderParams,
        videoFadeOutSec: Math.max(0, Math.min(2, videoFadeOutSec)),
      },
    })),

  setTransitionType: (transitionType) =>
    set((s) => ({
      ...pushPast(s),
      renderParams: { ...s.renderParams, transitionType },
      scenes: s.scenes.map((sc) => ({ ...sc, transitionType })),
    })),

  setTransitionDurationSec: (transitionDurationSec) =>
    set((s) => ({
      renderParams: {
        ...s.renderParams,
        transitionDurationSec: Math.max(0.2, Math.min(2.5, transitionDurationSec)),
      },
    })),

  setPortraitMode: (portraitMode) =>
    set((s) => ({
      ...pushPast(s),
      renderParams: { ...s.renderParams, portraitMode },
      frameIndex: 0,
    })),

  updateSuper8: (patch) =>
    set((s) => ({
      renderParams: {
        ...s.renderParams,
        super8: { ...s.renderParams.super8, ...patch },
      },
    })),

  setLutIntensity: (lutIntensity) =>
    set((s) => ({ renderParams: { ...s.renderParams, lutIntensity } })),

  setCustomLut: (customLut) => set({ customLut }),

  updateTextOverlay: (patch) =>
    set((s) => ({
      renderParams: {
        ...s.renderParams,
        textOverlay: { ...s.renderParams.textOverlay, ...patch },
      },
    })),

  saveUserPreset: (name) =>
    set((s) => {
      const cleanName = name.trim();
      if (!cleanName) return s;
      const preset: UserPreset = {
        id: `up_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: cleanName,
        createdAt: new Date().toISOString(),
        renderParams: {
          ...s.renderParams,
          super8: { ...s.renderParams.super8 },
          textOverlay: { ...s.renderParams.textOverlay },
        },
      };
      const next = [preset, ...s.userPresets].slice(0, 20);
      persistUserPresets(next);
      return { userPresets: next };
    }),

  deleteUserPreset: (id) =>
    set((s) => {
      const next = s.userPresets.filter((p) => p.id !== id);
      persistUserPresets(next);
      return { userPresets: next };
    }),

  applyUserPreset: (id) =>
    set((s) => {
      const found = s.userPresets.find((p) => p.id === id);
      if (!found) return s;
      const merged: RenderParams = {
        ...INITIAL_RENDER_PARAMS,
        ...found.renderParams,
        super8: { ...DEFAULT_SUPER8_PARAMS, ...found.renderParams.super8 },
        textOverlay: { ...DEFAULT_TEXT_OVERLAY, ...found.renderParams.textOverlay },
      };
      return {
        ...pushPast(s),
        renderParams: merged,
        scenes: s.scenes.map((sc) => ({ ...sc, transitionType: merged.transitionType })),
      };
    }),

  setProjectFilePath: (projectFilePath) => set({ projectFilePath }),

  loadProjectData: (data, filePath) =>
    set(() => {
      const mergedParams: RenderParams = {
        ...INITIAL_RENDER_PARAMS,
        ...data.renderParams,
        super8: { ...DEFAULT_SUPER8_PARAMS, ...data.renderParams.super8 },
        textOverlay: { ...DEFAULT_TEXT_OVERLAY, ...data.renderParams.textOverlay },
      };
      const loadedScenes =
        data.scenes && data.scenes.length > 0
          ? data.scenes
          : buildScenesFromPhotos({
              photos: data.slides,
              portraitMode: mergedParams.portraitMode,
              motionTemplate: mergedParams.motionTemplate,
              defaultDurationSec: mergedParams.defaultSlideDurationSec,
              defaultTransition: mergedParams.transitionType,
            });
      return {
        fps: data.fps,
        slides: data.slides,
        scenes: loadedScenes,
        activeSceneId: loadedScenes[0]?.id ?? null,
        selectedPhotoId: null,
        selectedPhotoIds: [],
        renderParams: mergedParams,
        projectFilePath: filePath,
        frameIndex: 0,
        isPlaying: false,
        past: [],
        future: [],
      };
    }),

  toProjectFileData: () => {
    const s = get();
    return {
      version: 2,
      savedAt: new Date().toISOString(),
      fps: s.fps,
      slides: s.slides,
      scenes: s.scenes,
      renderParams: s.renderParams,
      customLutPath: s.customLut?.filePath ?? null,
    };
  },

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return s;
      const previous = s.past[s.past.length - 1];
      const nextPast = s.past.slice(0, -1);
      const nextFuture = [takeSnapshot(s), ...s.future].slice(0, MAX_HISTORY);
      return {
        fps: previous.fps,
        slides: previous.slides,
        scenes: previous.scenes,
        renderParams: previous.renderParams,
        activeSceneId: previous.scenes[0]?.id ?? null,
        past: nextPast,
        future: nextFuture,
        frameIndex: 0,
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0];
      const nextFuture = s.future.slice(1);
      const nextPast = [...s.past, takeSnapshot(s)].slice(-MAX_HISTORY);
      return {
        fps: next.fps,
        slides: next.slides,
        scenes: next.scenes,
        renderParams: next.renderParams,
        activeSceneId: next.scenes[0]?.id ?? null,
        past: nextPast,
        future: nextFuture,
        frameIndex: 0,
      };
    }),

  setEngineCapabilities: (engineCapabilities) => set({ engineCapabilities }),
}));
