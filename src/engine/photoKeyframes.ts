import type { PhotoKeyframeEase, PhotoTransform } from '@shared/types';
import { normalizePhotoTransform } from './photoTransform';

export const KEYFRAME_EASE_LABELS: Record<PhotoKeyframeEase, string> = {
  linear: 'Đều',
  smooth: 'Êm (vào chậm, ra chậm)',
  'ease-in': 'Tăng tốc',
  'ease-out': 'Giảm tốc',
};

export const KEYFRAME_EASES = Object.keys(KEYFRAME_EASE_LABELS) as PhotoKeyframeEase[];

/** Maps linear progress 0..1 to eased progress 0..1. */
export function easeKeyframe(t: number, ease: PhotoKeyframeEase | undefined): number {
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  switch (ease) {
    case 'smooth':
      return x * x * (3 - 2 * x);
    case 'ease-in':
      return x * x;
    case 'ease-out':
      return 1 - (1 - x) * (1 - x);
    default:
      return x;
  }
}

interface KeyframedPhoto {
  transform?: PhotoTransform;
  transformEnd?: PhotoTransform;
  keyframeEase?: PhotoKeyframeEase;
}

export function hasPhotoKeyframes(photo: KeyframedPhoto | undefined | null): boolean {
  return Boolean(photo?.transformEnd);
}

/**
 * The photo's move/zoom/rotate at a point of its scene's motion (progress 0..1).
 * Without an End keyframe it is simply the (static) Start transform. Zoom is interpolated
 * geometrically so it feels even; rotation turns the direct way between the two angles.
 * Pure function of its inputs, so preview and export always agree (frame-index driven).
 * `preview` pins the result to the Start or End keyframe (used while editing on the preview).
 */
export function resolvePhotoTransform(
  photo: KeyframedPhoto | undefined | null,
  progress: number,
  preview: 'start' | 'end' | null = null
): PhotoTransform {
  const start = normalizePhotoTransform(photo?.transform);
  if (!photo?.transformEnd) return start;
  const end = normalizePhotoTransform(photo.transformEnd);
  const t = preview === 'start' ? 0 : preview === 'end' ? 1 : easeKeyframe(progress, photo.keyframeEase);
  return normalizePhotoTransform({
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
    scale: start.scale * Math.pow(end.scale / start.scale, t),
    rotationDeg: start.rotationDeg + (end.rotationDeg - start.rotationDeg) * t,
  });
}
