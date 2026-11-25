/**
 * "Motion tự động" (Đợt 5.2a): give every scene its own Motion Template in one click, so a
 * project with many scenes does not need a template picked scene by scene.
 *
 * Scenes whose template was chosen by hand (set, and not marked `motionAuto`) are kept.
 * The result is written into `SceneItem.motionTemplate`, so preview and export stay identical.
 */
import type { MotionTemplateId, SceneLayoutId } from '@shared/types';
import { MOTION_TEMPLATE_PRESETS } from './presets/motionTemplates';

export type AutoMotionMode = 'cycle' | 'random' | 'by-layout';

export const AUTO_MOTION_MODES: readonly { id: AutoMotionMode; label: string; desc: string }[] = [
  { id: 'by-layout', label: 'Theo bố cục (đề xuất)', desc: '1 ảnh: Ken Burns / Parallax / 3D Gallery; 2–4 ảnh: Polaroid, Filmstrip, Mosaic, Photo Wall' },
  { id: 'cycle', label: 'Xoay vòng', desc: 'Lần lượt từng mẫu, scene sau khác scene trước' },
  { id: 'random', label: 'Ngẫu nhiên (bấm lại ra bộ khác)', desc: 'Bấm lại để ra bộ khác; Ctrl+Z để quay lại' },
];

/** Templates that suit each layout, best first. */
export const LAYOUT_MOTION_AFFINITY: Record<SceneLayoutId, readonly MotionTemplateId[]> = {
  single: ['ken-burns-classic', 'parallax-25d', 'gallery-3d'],
  diptych: ['polaroid-memories', 'gallery-3d', 'parallax-25d'],
  triptych: ['filmstrip-roll', 'wall-3d', 'polaroid-memories'],
  mosaic4: ['minimal-mosaic', 'wall-3d', 'polaroid-memories'],
};

export interface AutoMotionScene {
  layout: SceneLayoutId;
  motionTemplate?: MotionTemplateId;
  motionAuto?: boolean;
}

export interface AutoMotionOptions {
  mode: AutoMotionMode;
  /** Random seed (mode "random"); same seed, same result. */
  seed?: number;
  /** Templates to use (default: all). */
  pool?: readonly MotionTemplateId[];
}

/** True when the scene's template was picked by hand and auto motion must not touch it. */
export function isManualMotion(scene: AutoMotionScene): boolean {
  return scene.motionTemplate !== undefined && !scene.motionAuto;
}

/**
 * New template for every scene (null = leave that scene as it is). Never gives two
 * neighbouring scenes the same template when the pool has more than one.
 */
export function planAutoMotion(
  scenes: readonly AutoMotionScene[],
  options: AutoMotionOptions
): (MotionTemplateId | null)[] {
  const pool = (options.pool && options.pool.length > 0
    ? [...options.pool]
    : MOTION_TEMPLATE_PRESETS.map((m) => m.id)) as MotionTemplateId[];
  let rng = (options.seed ?? 1) >>> 0 || 1;
  const rand = () => {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    return rng / 4294967296;
  };

  const result: (MotionTemplateId | null)[] = [];
  let prev: MotionTemplateId | null = null;
  let cycleIdx = 0;
  const layoutTurn: Partial<Record<SceneLayoutId, number>> = {};

  for (const scene of scenes) {
    if (isManualMotion(scene)) {
      result.push(null);
      prev = scene.motionTemplate ?? null;
      continue;
    }

    let candidates: MotionTemplateId[];
    if (options.mode === 'by-layout') {
      const fit = LAYOUT_MOTION_AFFINITY[scene.layout].filter((id) => pool.includes(id));
      const list = fit.length > 0 ? fit : pool;
      const turn = layoutTurn[scene.layout] ?? 0;
      layoutTurn[scene.layout] = turn + 1;
      // Rotate within the layout's list so repeated layouts still vary.
      candidates = list.map((_, i) => list[(turn + i) % list.length]);
    } else if (options.mode === 'cycle') {
      candidates = pool.map((_, i) => pool[(cycleIdx + i) % pool.length]);
      cycleIdx++;
    } else {
      const start = Math.floor(rand() * pool.length);
      candidates = pool.map((_, i) => pool[(start + i) % pool.length]);
    }

    const pick = candidates.find((id) => id !== prev) ?? candidates[0];
    result.push(pick);
    prev = pick;
  }
  return result;
}
