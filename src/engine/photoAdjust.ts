import type { PhotoAdjust } from '@shared/types';
import { isNearDefaults, normalizeByLimits } from './num';

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

/** Fills missing fields with neutral values and clamps everything to a safe range. */
export function normalizePhotoAdjust(a: PhotoAdjust | undefined | null): Required<PhotoAdjust> {
  return normalizeByLimits(a, IDENTITY_PHOTO_ADJUST, PHOTO_ADJUST_LIMITS);
}

export function isIdentityPhotoAdjust(a: PhotoAdjust | undefined | null): boolean {
  return isNearDefaults(normalizePhotoAdjust(a), IDENTITY_PHOTO_ADJUST);
}

/** [contrast, saturation, warmth, opacity] for the shader's per-slot uniform. */
export function photoAdjustToUniform(a: PhotoAdjust | undefined | null): [number, number, number, number] {
  const n = normalizePhotoAdjust(a);
  return [n.contrast, n.saturation, n.warmth, n.opacity];
}
