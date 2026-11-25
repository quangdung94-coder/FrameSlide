import type { FilmLookParams, SceneLayoutId } from '@shared/types';
import { clamp } from './num';

/**
 * Cheap CSS approximation of a Film Look for the small hover thumbnails in the Look tab (U9).
 * It is only a hint: the real look is rendered by the WebGL pipeline on the main preview.
 */
export interface LookPreviewStyle {
  /** CSS `filter` for the photo. */
  filter: string;
  /** 0..1 strength of the dark edge overlay. */
  vignette: number;
  /** 0..1 opacity of the animated grain overlay. */
  grain: number;
  /** 0..1 opacity of the warm edge glow (halation / light leak). */
  glow: number;
  /** Whether the thumbnail should flicker / weave while hovered. */
  flicker: boolean;
  weave: boolean;
  /** Raised black level (fade), 0..1 opacity of a grey wash. */
  fade: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function lookPreviewStyle(look: FilmLookParams): LookPreviewStyle {
  if (!look.enabled) {
    return { filter: 'none', vignette: 0, grain: 0, glow: 0, flicker: false, weave: false, fade: 0 };
  }
  const k = clamp(look.intensity, 0, 1);
  const mix = (neutral: number, v: number) => neutral + (v - neutral) * k;
  const warm = clamp(look.warmShift, -1, 1) * k;
  const parts = [
    `contrast(${r2(mix(1, look.contrast))})`,
    `saturate(${r2(mix(1, look.saturation))})`,
    `sepia(${r2(clamp(look.sepia * k + Math.max(0, warm) * 0.25, 0, 1))})`,
  ];
  if (warm < -0.05) parts.push(`hue-rotate(${Math.round(warm * 18)}deg)`);
  return {
    filter: parts.join(' '),
    vignette: r2(clamp(look.vignette * k, 0, 1)),
    grain: r2(clamp(look.grain * k * 0.55, 0, 0.5)),
    glow: r2(clamp(Math.max(look.halation, look.ambientLeak) * k * 0.45, 0, 0.45)),
    flicker: look.flicker * k > 0.08,
    weave: look.gateWeave * k > 0.08,
    fade: r2(clamp((look.fade / 0.35) * k * 0.35, 0, 0.35)),
  };
}

/** Normalised cells (x, y, w, h in 0..1 of a 16:9 frame) of each scene layout, for template thumbnails. */
export const LAYOUT_PREVIEW_CELLS: Record<SceneLayoutId, [number, number, number, number][]> = {
  single: [[0, 0, 1, 1]],
  diptych: [
    [0.06, 0.08, 0.42, 0.84],
    [0.52, 0.08, 0.42, 0.84],
  ],
  triptych: [
    [0.04, 0.14, 0.29, 0.72],
    [0.355, 0.14, 0.29, 0.72],
    [0.67, 0.14, 0.29, 0.72],
  ],
  mosaic4: [
    [0.05, 0.06, 0.44, 0.42],
    [0.51, 0.06, 0.44, 0.42],
    [0.05, 0.52, 0.44, 0.42],
    [0.51, 0.52, 0.44, 0.42],
  ],
};
