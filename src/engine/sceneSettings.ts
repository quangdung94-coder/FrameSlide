import type { MotionDirection, SceneBackground, SceneItem, SceneLayoutId, TransitionType } from '@shared/types';
import { resizeSceneSlots } from './sceneBuilder';

/** Parts of a scene that can be copied to another scene (the photos themselves never are). */
export type SceneSettingPart =
  | 'layout'
  | 'duration'
  | 'motion'
  | 'background'
  | 'transition'
  | 'caption';

export const SCENE_SETTING_PARTS: { id: SceneSettingPart; label: string }[] = [
  { id: 'layout', label: 'Bố cục' },
  { id: 'duration', label: 'Thời lượng' },
  { id: 'motion', label: 'Chuyển động' },
  { id: 'background', label: 'Nền' },
  { id: 'transition', label: 'Chuyển cảnh' },
  { id: 'caption', label: 'Chữ' },
];

/** Snapshot of everything copyable about a scene. */
export interface SceneSettings {
  layout: SceneLayoutId;
  durationSec: number;
  transitionType: TransitionType;
  motionDirection?: MotionDirection;
  background?: SceneBackground;
  caption?: string;
}

export function copySceneSettings(scene: SceneItem): SceneSettings {
  return {
    layout: scene.layout,
    durationSec: scene.durationSec,
    transitionType: scene.transitionType,
    motionDirection: scene.motionDirection,
    background: scene.background ? { ...scene.background } : undefined,
    caption: scene.caption,
  };
}

/** Returns a copy of `target` with the chosen parts taken from `settings`. Slots/photos are kept. */
export function applySceneSettings(
  target: SceneItem,
  settings: SceneSettings,
  parts: readonly SceneSettingPart[]
): SceneItem {
  let next: SceneItem = { ...target };
  for (const part of parts) {
    switch (part) {
      case 'layout':
        next = resizeSceneSlots(next, settings.layout);
        break;
      case 'duration':
        next.durationSec = settings.durationSec;
        break;
      case 'motion':
        next.motionDirection = settings.motionDirection;
        break;
      case 'background':
        next.background = settings.background ? { ...settings.background } : undefined;
        break;
      case 'transition':
        next.transitionType = settings.transitionType;
        break;
      case 'caption':
        next.caption = settings.caption;
        break;
    }
  }
  return next;
}
