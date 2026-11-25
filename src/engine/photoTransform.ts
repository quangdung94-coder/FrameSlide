import type { PhotoTransform } from '@shared/types';
import { clamp, finiteOr } from './num';

export const IDENTITY_PHOTO_TRANSFORM: PhotoTransform = { x: 0, y: 0, scale: 1, rotationDeg: 0 };

export const PHOTO_TRANSFORM_LIMITS = {
  offset: 1, // ±100% of the frame
  scaleMin: 0.2,
  scaleMax: 5,
  rotation: 180,
} as const;

/** Clamps every field to a safe range; missing/invalid values become the identity. */
export function normalizePhotoTransform(t: Partial<PhotoTransform> | undefined | null): PhotoTransform {
  const L = PHOTO_TRANSFORM_LIMITS;
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

// ---------------------------------------------------------------------------------------------
// Crop mode (Đợt 5.3d). The crop box lives in the slot frame's own units: its centre is an
// offset from the frame centre (fractions of the frame width / height, y down, like
// PhotoTransform.x/y) and `size` is its width as a fraction of the frame width. It is locked to
// the frame's aspect, so its height is the same fraction of the frame height. Applying the box
// maps it onto the frame: the photo is moved and zoomed so the boxed part fills the slot.
// ---------------------------------------------------------------------------------------------

export interface CropBox {
  x: number;
  y: number;
  size: number;
}

export const FULL_CROP_BOX: CropBox = { x: 0, y: 0, size: 1 };

export const CROP_BOX_LIMITS = { sizeMin: 0.08, sizeMax: 4 } as const;

export function normalizeCropBox(box: CropBox): CropBox {
  return {
    x: clamp(finiteOr(box.x, 0), -2, 2),
    y: clamp(finiteOr(box.y, 0), -2, 2),
    size: clamp(finiteOr(box.size, 1), CROP_BOX_LIMITS.sizeMin, CROP_BOX_LIMITS.sizeMax),
  };
}

/** The transform that makes the part of the photo inside `box` fill the whole slot frame. */
export function applyCropBox(t: PhotoTransform, box: CropBox): PhotoTransform {
  const b = normalizeCropBox(box);
  return normalizePhotoTransform({
    x: (t.x - b.x) / b.size,
    y: (t.y - b.y) / b.size,
    scale: t.scale / b.size,
    rotationDeg: t.rotationDeg,
  });
}

/**
 * Rotates the photo by `deltaDeg` (clockwise on screen) around `pivot` (frame units).
 * `frameAspect` = frame width / height, needed because x and y use different units.
 */
export function rotatePhotoAbout(
  t: PhotoTransform,
  pivot: { x: number; y: number },
  deltaDeg: number,
  frameAspect: number
): PhotoTransform {
  const a = Math.max(1e-6, frameAspect);
  const rad = (deltaDeg * Math.PI) / 180;
  const vx = (t.x - pivot.x) * a;
  const vy = t.y - pivot.y;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return {
    x: pivot.x + (c * vx - s * vy) / a,
    y: pivot.y + (s * vx + c * vy),
    scale: t.scale,
    rotationDeg: t.rotationDeg + deltaDeg,
  };
}

/**
 * "Làm thẳng": the user drags a line along something that should be level (horizon) or upright
 * (a wall). Returns the rotation (degrees, clockwise) that makes it exactly level or upright,
 * always the smaller of the two fixes (at most 45°). Too-short lines return 0.
 */
export function straightenDelta(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (Math.hypot(dx, dy) < 4) return 0;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  // Distance to the nearest multiple of 90°, in (-45, 45].
  let off = deg - Math.round(deg / 90) * 90;
  if (off <= -45) off += 90;
  const out = -off;
  return Math.abs(out) < 1e-9 ? 0 : out;
}

/**
 * Resizes the crop box by dragging one handle while the opposite side (or corner) stays put.
 * `handle` uses compass names (n, ne, e, se, s, sw, w, nw); `px`, `py` is the pointer in frame
 * units. The aspect stays locked: edges change the size from the dragged axis only.
 */
export function resizeCropBox(
  box: CropBox,
  handle: 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw',
  px: number,
  py: number
): CropBox {
  const b = normalizeCropBox(box);
  const h = b.size / 2;
  const sx = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0;
  const sy = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;
  // Anchor: the opposite side / corner.
  const ax = b.x - sx * h;
  const ay = b.y - sy * h;
  const fromX = sx !== 0 ? (px - ax) * sx : -Infinity;
  const fromY = sy !== 0 ? (py - ay) * sy : -Infinity;
  const size = clamp(Math.max(fromX, fromY), CROP_BOX_LIMITS.sizeMin, CROP_BOX_LIMITS.sizeMax);
  return {
    x: sx !== 0 ? ax + (sx * size) / 2 : b.x,
    y: sy !== 0 ? ay + (sy * size) / 2 : b.y,
    size,
  };
}

/**
 * Where the photo's cover-fitted picture comes from in the (90°-rotated) source image, matching
 * the shader's `coverUvWithFocal`: a rectangle of the frame's aspect, centred on the focal point
 * (kept 15% away from the edges). Values are fractions of the rotated image (y down).
 */
export function coverSourceRect(
  imgW: number,
  imgH: number,
  frameAspect: number,
  focal: { x: number; y: number }
): { x: number; y: number; w: number; h: number } {
  const imgAspect = imgW / Math.max(1, imgH);
  const ax = clamp(focal.x, 0.15, 0.85);
  const ay = clamp(focal.y, 0.15, 0.85);
  if (imgAspect > frameAspect) {
    const w = frameAspect / imgAspect;
    const cx = clamp(ax, w / 2, 1 - w / 2);
    return { x: cx - w / 2, y: 0, w, h: 1 };
  }
  const h = imgAspect / frameAspect;
  const cy = clamp(ay, h / 2, 1 - h / 2);
  return { x: 0, y: cy - h / 2, w: 1, h };
}
