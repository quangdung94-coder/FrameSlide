import type {
  MotionDirection,
  MotionTemplateId,
  SceneBackground,
  SceneCardStyle,
  SceneItem,
  SceneLayoutId,
  SceneStagger,
  TransitionType,
  CaptionTiming,
  TextOffset,
} from '@shared/types';
import { resizeSceneSlots } from './sceneBuilder';

/** Parts of a scene that can be copied to another scene (the photos themselves never are). */
export type SceneSettingPart =
  | 'layout'
  | 'duration'
  | 'motion'
  | 'background'
  | 'transition'
  | 'caption'
  | 'frame'
  | 'look';

export const SCENE_SETTING_PARTS: { id: SceneSettingPart; label: string }[] = [
  { id: 'layout', label: 'Bố cục' },
  { id: 'duration', label: 'Thời lượng' },
  { id: 'motion', label: 'Chuyển động' },
  { id: 'background', label: 'Nền' },
  { id: 'transition', label: 'Chuyển cảnh' },
  { id: 'caption', label: 'Chữ' },
  { id: 'frame', label: 'Khung ảnh' },
  { id: 'look', label: 'Film Look' },
];

/** Snapshot of everything copyable about a scene. */
export interface SceneSettings {
  layout: SceneLayoutId;
  durationSec: number;
  transitionType: TransitionType;
  transitionDurationSec?: number;
  motionDirection?: MotionDirection;
  motionTemplate?: MotionTemplateId;
  stagger?: SceneStagger;
  background?: SceneBackground;
  caption?: string;
  captionTiming?: CaptionTiming;
  captionOffset?: TextOffset;
  cardStyle?: SceneCardStyle;
  filmLookOff?: boolean;
}

export function copySceneSettings(scene: SceneItem): SceneSettings {
  return {
    layout: scene.layout,
    durationSec: scene.durationSec,
    transitionType: scene.transitionType,
    transitionDurationSec: scene.transitionDurationSec,
    motionDirection: scene.motionDirection,
    motionTemplate: scene.motionTemplate,
    stagger: scene.stagger ? { ...scene.stagger } : undefined,
    background: scene.background ? { ...scene.background } : undefined,
    caption: scene.caption,
    captionTiming: scene.captionTiming ? { ...scene.captionTiming } : undefined,
    captionOffset: scene.captionOffset ? { ...scene.captionOffset } : undefined,
    cardStyle: scene.cardStyle ? { ...scene.cardStyle } : undefined,
    filmLookOff: scene.filmLookOff,
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
        next.motionTemplate = settings.motionTemplate;
        // A pasted template is a deliberate choice: auto motion must leave it alone.
        delete next.motionAuto;
        next.stagger = settings.stagger ? { ...settings.stagger } : undefined;
        break;
      case 'background':
        next.background = settings.background ? { ...settings.background } : undefined;
        break;
      case 'transition':
        next.transitionType = settings.transitionType;
        next.transitionDurationSec = settings.transitionDurationSec;
        break;
      case 'caption':
        next.caption = settings.caption;
        next.captionTiming = settings.captionTiming ? { ...settings.captionTiming } : undefined;
        next.captionOffset = settings.captionOffset ? { ...settings.captionOffset } : undefined;
        break;
      case 'frame':
        next.cardStyle = settings.cardStyle ? { ...settings.cardStyle } : undefined;
        break;
      case 'look':
        next.filmLookOff = settings.filmLookOff;
        break;
    }
  }
  return next;
}
