import type {
  MotionTemplateId,
  PortraitMode,
  SceneItem,
  SceneLayoutId,
  SlideAsset,
  TransitionType,
} from '@shared/types';
import { getMotionTemplate } from './presets/motionTemplates';

export const LAYOUT_SLOT_COUNTS: Record<SceneLayoutId, number> = {
  single: 1,
  diptych: 2,
  triptych: 3,
  mosaic4: 4,
};

export const LAYOUT_LABELS: Record<SceneLayoutId, string> = {
  single: '1 Ảnh Full',
  diptych: '2 Ảnh Ghép đôi',
  triptych: '3 Ảnh Filmstrip',
  mosaic4: '4 Ảnh Mosaic',
};

let sceneCounter = 1;
export function createSceneId(): string {
  return `scene_${Date.now().toString(36)}_${sceneCounter++}`;
}

export function createEmptyScene(
  layout: SceneLayoutId,
  durationSec = 3.5,
  transitionType: TransitionType = 'light-leak'
): SceneItem {
  return {
    id: createSceneId(),
    layout,
    durationSec,
    transitionType,
    slots: new Array<string | null>(LAYOUT_SLOT_COUNTS[layout]).fill(null),
  };
}

/** Deep copy of a scene with a fresh id (used by "Nhân bản scene"). */
export function cloneScene(src: SceneItem): SceneItem {
  return { ...structuredClone(src), id: createSceneId() };
}

/** The project settings `buildScenesFromPhotos` needs (same names as in RenderParams). */
export interface SceneBuildParams {
  portraitMode: PortraitMode;
  motionTemplate?: MotionTemplateId;
  defaultSlideDurationSec?: number;
  transitionType?: TransitionType;
}

/** `buildScenesFromPhotos` with the project's render settings. */
export function buildScenesForProject(photos: SlideAsset[], params: SceneBuildParams): SceneItem[] {
  return buildScenesFromPhotos({
    photos,
    portraitMode: params.portraitMode,
    motionTemplate: params.motionTemplate,
    defaultDurationSec: params.defaultSlideDurationSec,
    defaultTransition: params.transitionType,
  });
}

/**
 * Automatically builds a clean Scene list from raw photos according to portraitMode
 * or a chosen MotionTemplate's layout pattern.
 */
export function buildScenesFromPhotos(opts: {
  photos: SlideAsset[];
  portraitMode: PortraitMode;
  motionTemplate?: MotionTemplateId;
  defaultDurationSec?: number;
  defaultTransition?: TransitionType;
}): SceneItem[] {
  const { photos, portraitMode } = opts;
  if (photos.length === 0) return [];

  const dur = opts.defaultDurationSec ?? 3.5;
  const trans = opts.defaultTransition ?? 'light-leak';
  const scenes: SceneItem[] = [];

  if (opts.motionTemplate && opts.motionTemplate !== 'ken-burns-classic') {
    const tpl = getMotionTemplate(opts.motionTemplate);
    let cursor = 0;
    let patIdx = 0;
    while (cursor < photos.length) {
      const remaining = photos.length - cursor;
      let layout = tpl.layoutPattern[patIdx % tpl.layoutPattern.length];
      let needed = LAYOUT_SLOT_COUNTS[layout];
      if (remaining < needed) {
        if (remaining >= 3) layout = 'triptych';
        else if (remaining === 2) layout = 'diptych';
        else layout = 'single';
        needed = LAYOUT_SLOT_COUNTS[layout];
      }
      const slots: (string | null)[] = [];
      for (let k = 0; k < needed; k++) {
        slots.push(photos[cursor++]?.id ?? null);
      }
      scenes.push({
        id: createSceneId(),
        layout,
        durationSec: dur,
        transitionType: trans,
        slots,
      });
      patIdx++;
    }
    return scenes;
  }

  // Smart default: pair consecutive portraits when portraitMode === 'smart-pairing'
  let i = 0;
  while (i < photos.length) {
    const curr = photos[i];
    const next = photos[i + 1];
    if (
      portraitMode === 'smart-pairing' &&
      curr.orientation === 'portrait' &&
      next &&
      next.orientation === 'portrait'
    ) {
      scenes.push({
        id: createSceneId(),
        layout: 'diptych',
        durationSec: dur,
        transitionType: trans,
        slots: [curr.id, next.id],
      });
      i += 2;
    } else {
      scenes.push({
        id: createSceneId(),
        layout: 'single',
        durationSec: dur,
        transitionType: trans,
        slots: [curr.id],
      });
      i += 1;
    }
  }
  return scenes;
}

/**
 * Auto-fills all existing scenes sequentially with available photos (wrapping if fewer photos than slots).
 */
export function autoFillScenesWithPhotos(
  scenes: SceneItem[],
  photos: SlideAsset[]
): SceneItem[] {
  if (photos.length === 0) return scenes;
  let cursor = 0;
  return scenes.map((sc) => ({
    ...sc,
    slots: sc.slots.map(() => {
      const p = photos[cursor % photos.length];
      cursor++;
      return p.id;
    }),
  }));
}

export function resizeSceneSlots(scene: SceneItem, nextLayout: SceneLayoutId): SceneItem {
  const targetLen = LAYOUT_SLOT_COUNTS[nextLayout];
  const nextSlots = Array.from({ length: targetLen }, (_, i) => scene.slots[i] ?? null);
  return { ...scene, layout: nextLayout, slots: nextSlots };
}
