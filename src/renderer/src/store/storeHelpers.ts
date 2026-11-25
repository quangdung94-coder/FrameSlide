import {
  DEFAULT_SUPER8_PARAMS,
  DEFAULT_TEXT_OVERLAY,
  type RenderParams,
  type SceneItem,
  type SlideAsset,
  type SupportedFps,
  type UserPreset,
} from '@shared/types';
import type { SceneStyle } from '@engine/sceneStyles';

/** The part of the project that undo / redo restores. */
export interface HistorySnapshot {
  fps: SupportedFps;
  slides: SlideAsset[];
  scenes: SceneItem[];
  renderParams: RenderParams;
}

export const MAX_HISTORY = 40;

export function takeSnapshot(state: HistorySnapshot): HistorySnapshot {
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

/** State fields that put `snap` back on screen (playhead to 0, first scene selected). */
export function restoreSnapshot(snap: HistorySnapshot) {
  return {
    fps: snap.fps,
    slides: snap.slides,
    scenes: snap.scenes,
    renderParams: snap.renderParams,
    activeSceneId: snap.scenes[0]?.id ?? null,
    frameIndex: 0,
  };
}

/** Fills settings missing from an older project / preset with today's defaults. */
export function mergeRenderParams(defaults: RenderParams, saved: RenderParams): RenderParams {
  return {
    ...defaults,
    ...saved,
    super8: { ...DEFAULT_SUPER8_PARAMS, ...saved.super8 },
    textOverlay: { ...DEFAULT_TEXT_OVERLAY, ...saved.textOverlay },
  };
}

/** Reads a JSON list saved on this computer (not in the project file); [] when missing or broken. */
export function loadLocalList<T>(key: string): T[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalList<T>(key: string, list: T[]): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(list));
    }
  } catch {
    // ignore storage quota errors
  }
}

const USER_PRESETS_KEY = 'frameslide_user_presets_v1';
const SCENE_STYLES_KEY = 'frameslide_scene_styles_v1';

export const loadUserPresets = () => loadLocalList<UserPreset>(USER_PRESETS_KEY);
export const persistUserPresets = (presets: UserPreset[]) => saveLocalList(USER_PRESETS_KEY, presets);
export const loadSceneStyles = () => loadLocalList<SceneStyle>(SCENE_STYLES_KEY);
export const persistSceneStyles = (styles: SceneStyle[]) => saveLocalList(SCENE_STYLES_KEY, styles);
