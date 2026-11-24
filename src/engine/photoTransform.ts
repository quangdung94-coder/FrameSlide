import type { PhotoTransform } from '@shared/types';

export const IDENTITY_PHOTO_TRANSFORM: PhotoTransform = { x: 0, y: 0, scale: 1, rotationDeg: 0 };

export const PHOTO_TRANSFORM_LIMITS = {
  offset: 1, // ±100% of the frame
  scaleMin: 0.2,
  scaleMax: 5,
  rotation: 180,
} as const;

const finiteOr = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/** Clamps every field to a safe range; missing/invalid values become the identity. */
export function normalizePhotoTransform(t: Partial<PhotoTransform> | undefined | null): PhotoTransform {
  const L = PHOTO_TRANSFORM_LIMITS;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  let rot = finiteOr(t?.rotationDeg, 0);
  // wrap to -180..180
  rot = ((((rot + 180) % 360) + 360) % 360) - 180;
  return {
    x: clamp(finiteOr(t?.x, 0), -L.offset, L.offset),
    y: clamp(finiteOr(t?.y, 0), -L.offset, L.offset),
    scale: clamp(finiteOr(t?.scale, 1), L.scaleMin, L.scaleMax),
    rotationDeg: rot,
  };
}

export function isIdentityTransform(t: PhotoTransform | undefined | null): boolean {
  const n = normalizePhotoTransform(t);
  return (
    Math.abs(n.x) < 1e-4 &&
    Math.abs(n.y) < 1e-4 &&
    Math.abs(n.scale - 1) < 1e-4 &&
    Math.abs(n.rotationDeg) < 1e-3
  );
}
