import type { SceneItem } from '@shared/types';
import { applySceneSettings, copySceneSettings, type SceneSettingPart, type SceneSettings } from './sceneSettings';

/** A reusable scene look: layout + timing + motion + background + frame + caption timing/position. */
export interface SceneStyle {
  id: string;
  name: string;
  /** Short description shown under the name. */
  desc?: string;
  builtIn?: boolean;
  settings: SceneSettings;
}

/** What a style changes. The photos and the caption text of the target scene are always kept. */
export const SCENE_STYLE_PARTS: readonly SceneSettingPart[] = [
  'layout',
  'duration',
  'motion',
  'background',
  'transition',
  'frame',
  'look',
];

export function sceneStyleFromScene(scene: SceneItem, name: string, id: string): SceneStyle {
  const settings = copySceneSettings(scene);
  delete settings.caption; // a style never carries the words themselves
  return { id, name: name.trim(), settings };
}

export function applySceneStyle(target: SceneItem, style: SceneStyle): SceneItem {
  const next = applySceneSettings(target, style.settings, SCENE_STYLE_PARTS);
  next.captionTiming = style.settings.captionTiming ? { ...style.settings.captionTiming } : undefined;
  next.captionOffset = style.settings.captionOffset ? { ...style.settings.captionOffset } : undefined;
  return next;
}

/** Ready-made styles for wedding / event B-roll. */
export const BUILT_IN_SCENE_STYLES: readonly SceneStyle[] = [
  {
    id: 'builtin-opening',
    name: 'Mở đầu',
    desc: '1 ảnh, 5 giây, đẩy chậm vào, chữ hiện sau 0.8 giây',
    builtIn: true,
    settings: {
      layout: 'single',
      durationSec: 5,
      transitionType: 'film-dissolve',
      transitionDurationSec: 1.4,
      motionDirection: 'zoom-in',
      captionTiming: { inSec: 0.8 },
    },
  },
  {
    id: 'builtin-ending',
    name: 'Kết thúc',
    desc: '1 ảnh, 5 giây, lùi chậm ra, tối dần sang đen',
    builtIn: true,
    settings: {
      layout: 'single',
      durationSec: 5,
      transitionType: 'dip-black',
      transitionDurationSec: 1.8,
      motionDirection: 'zoom-out',
      captionTiming: { inSec: 0.5, outSec: 4 },
    },
  },
  {
    id: 'builtin-couple-portrait',
    name: 'Chân dung đôi',
    desc: '2 ảnh dọc cạnh nhau, lần lượt trượt lên, bo góc nhẹ',
    builtIn: true,
    settings: {
      layout: 'diptych',
      durationSec: 4.5,
      transitionType: 'dreamy-blur',
      stagger: { style: 'slide', delaySec: 0.45, entrySec: 0.7 },
      cardStyle: { corner: 0.12, shadow: 1.3, border: 0.6, feather: 0 },
    },
  },
  {
    id: 'builtin-memory-grid',
    name: 'Lưới kỷ niệm',
    desc: '4 ảnh lưới, lần lượt mờ vào, nền giấy ấm',
    builtIn: true,
    settings: {
      layout: 'mosaic4',
      durationSec: 5,
      transitionType: 'film-dissolve',
      stagger: { style: 'fade', delaySec: 0.3, entrySec: 0.6 },
      cardStyle: { corner: 0.06, shadow: 1, border: 1, feather: 0 },
      background: { style: 'paper', color1: '#2a211a', color2: '#5a4634', angleDeg: 135, pattern: 'dots' },
    },
  },
];
