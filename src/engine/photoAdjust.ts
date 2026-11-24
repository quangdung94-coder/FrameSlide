import type { PhotoAdjust } from '@shared/types';

export const PHOTO_ADJUST_LIMITS = {
  contrast: [0.5, 1.6],
  saturation: [0, 2],
  warmth: [-1, 1],
  opacity: [0, 1],
} as const;

export const IDENTITY_PHOTO_ADJUST: Required<PhotoAdjust> = {
  contrast: 1,
  saturation: 1,
  warmth: 0,
  opacity: 1,
};

const num = (v: unknown, fallback: number, [lo, hi]: readonly [number, number]) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;

/** Fills missing fields with neutral values and clamps everything to a safe range. */
export function normalizePhotoAdjust(a: PhotoAdjust | undefined | null): Required<PhotoAdjust> {
  const L = PHOTO_ADJUST_LIMITS;
  return {
    contrast: num(a?.contrast, 1, L.contrast),
    saturation: num(a?.saturation, 1, L.saturation),
    warmth: num(a?.warmth, 0, L.warmth),
    opacity: num(a?.opacity, 1, L.opacity),
  };
}

export function isIdentityPhotoAdjust(a: PhotoAdjust | undefined | null): boolean {
  const n = normalizePhotoAdjust(a);
  return (
    Math.abs(n.contrast - 1) < 1e-4 &&
    Math.abs(n.saturation - 1) < 1e-4 &&
    Math.abs(n.warmth) < 1e-4 &&
    Math.abs(n.opacity - 1) < 1e-4
  );
}

/** [contrast, saturation, warmth, opacity] for the shader's per-slot uniform. */
export function photoAdjustToUniform(a: PhotoAdjust | undefined | null): [number, number, number, number] {
  const n = normalizePhotoAdjust(a);
  return [n.contrast, n.saturation, n.warmth, n.opacity];
}
