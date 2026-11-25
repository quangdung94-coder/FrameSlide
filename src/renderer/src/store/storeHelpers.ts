import {
  DEFAULT_SUPER8_PARAMS,
  DEFAULT_TEXT_OVERLAY,
  type RenderParams,
  type SceneItem,
  type SlideAsset,
  type SupportedFps,
  type UserPreset,
} from '@shared/types';

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

const USER_PRESETS_KEY = 'frameslide_user_presets_v1';

export function loadUserPresets(): UserPreset[] {
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

export function persistUserPresets(presets: UserPreset[]): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(presets));
    }
  } catch {
    // ignore storage quota errors
  }
}
