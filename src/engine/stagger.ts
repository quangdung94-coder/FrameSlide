import type { SceneStagger, StaggerStyle } from '@shared/types';
import { clamp, clampOr } from './num';

export const STAGGER_LIMITS = {
  delaySec: [0.05, 1.5],
  entrySec: [0.1, 2],
} as const;

export const DEFAULT_STAGGER: Required<SceneStagger> = { style: 'fade', delaySec: 0.35, entrySec: 0.6 };

export const STAGGER_STYLES: { id: StaggerStyle; label: string }[] = [
  { id: 'fade', label: 'Mờ dần' },
  { id: 'slide', label: 'Trượt lên' },
  { id: 'zoom', label: 'Phóng ra' },
];

/** Shader code of each entry style (0 = off). */
export const STAGGER_STYLE_CODE: Record<StaggerStyle, number> = { fade: 1, slide: 2, zoom: 3 };

export function normalizeStagger(s: SceneStagger | undefined | null): Required<SceneStagger> | null {
  if (!s) return null;
  return {
    style: s.style in STAGGER_STYLE_CODE ? s.style : DEFAULT_STAGGER.style,
    delaySec: clampOr(s.delaySec, DEFAULT_STAGGER.delaySec, STAGGER_LIMITS.delaySec),
    entrySec: clampOr(s.entrySec, DEFAULT_STAGGER.entrySec, STAGGER_LIMITS.entrySec),
  };
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * How far each of the (up to 4) photos has appeared, 0..1, `sceneTimeSec` seconds after the
 * scene became visible. Pure function of time, so preview and export match frame for frame.
 */
export function staggerAppear(
  stagger: SceneStagger | undefined | null,
  photoCount: number,
  sceneTimeSec: number
): [number, number, number, number] {
  const n = normalizeStagger(stagger);
  const out: [number, number, number, number] = [1, 1, 1, 1];
  if (!n || photoCount < 2) return out;
  for (let i = 0; i < Math.min(4, photoCount); i++) {
    const t = (sceneTimeSec - i * n.delaySec) / n.entrySec;
    out[i] = easeOutCubic(clamp(t, 0, 1));
  }
  return out;
}

/** Seconds until the last photo is fully in (for UI hints). */
export function staggerTotalSec(stagger: SceneStagger | undefined | null, photoCount: number): number {
  const n = normalizeStagger(stagger);
  if (!n || photoCount < 2) return 0;
  return (photoCount - 1) * n.delaySec + n.entrySec;
}
