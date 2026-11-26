import type {
  CardFitMode,
  RenderParams,
  SceneItem,
  SceneLayoutId,
  SlotFrameOverride,
} from '@shared/types';
import { getSlotFrameRect, type LayoutRect, type SlotRectOptions } from './layoutGeometry';
import { clamp } from './num';

export const SLOT_FRAME_LIMITS = {
  dxMin: -0.45,
  dxMax: 0.45,
  dyMin: -0.45,
  dyMax: 0.45,
  scaleMin: 0.3,
  scaleMax: 2.2,
  groupScaleMin: 0.5,
  groupScaleMax: 1.4,
  groupGapMin: 0,
  groupGapMax: 2,
} as const;

export const IDENTITY_SLOT_FRAME: SlotFrameOverride = {
  dx: 0,
  dy: 0,
  scaleX: 1,
  scaleY: 1,
};

export function normalizeSlotFrame(
  raw: Partial<SlotFrameOverride> | null | undefined
): SlotFrameOverride {
  if (!raw) return { ...IDENTITY_SLOT_FRAME };
  return {
    dx: clamp(Number.isFinite(raw.dx) ? raw.dx! : 0, SLOT_FRAME_LIMITS.dxMin, SLOT_FRAME_LIMITS.dxMax),
    dy: clamp(Number.isFinite(raw.dy) ? raw.dy! : 0, SLOT_FRAME_LIMITS.dyMin, SLOT_FRAME_LIMITS.dyMax),
    scaleX: clamp(
      Number.isFinite(raw.scaleX) ? raw.scaleX! : 1,
      SLOT_FRAME_LIMITS.scaleMin,
      SLOT_FRAME_LIMITS.scaleMax
    ),
    scaleY: clamp(
      Number.isFinite(raw.scaleY) ? raw.scaleY! : 1,
      SLOT_FRAME_LIMITS.scaleMin,
      SLOT_FRAME_LIMITS.scaleMax
    ),
  };
}

export function isIdentitySlotFrame(f: Partial<SlotFrameOverride> | null | undefined): boolean {
  if (!f) return true;
  const n = normalizeSlotFrame(f);
  return (
    Math.abs(n.dx) < 1e-4 &&
    Math.abs(n.dy) < 1e-4 &&
    Math.abs(n.scaleX - 1) < 1e-4 &&
    Math.abs(n.scaleY - 1) < 1e-4
  );
}

export function clampFrameScale(scale: number | undefined): number {
  if (typeof scale !== 'number' || !Number.isFinite(scale)) return 1;
  return clamp(scale, SLOT_FRAME_LIMITS.groupScaleMin, SLOT_FRAME_LIMITS.groupScaleMax);
}

export function clampFrameGap(gap: number | undefined): number {
  if (typeof gap !== 'number' || !Number.isFinite(gap)) return 1;
  return clamp(gap, SLOT_FRAME_LIMITS.groupGapMin, SLOT_FRAME_LIMITS.groupGapMax);
}

/** Default is 'fit' so vertical/portrait photos are never cropped top-and-bottom in multi-photo layouts. */
export function resolveCardFitMode(
  scene?: Pick<SceneItem, 'cardFitMode'> | null,
  params?: Pick<RenderParams, 'cardFitMode'> | null
): CardFitMode {
  return scene?.cardFitMode ?? params?.cardFitMode ?? 'fit';
}

export function hasCustomSingleFrame(scene?: SceneItem | null): boolean {
  if (!scene || scene.layout !== 'single') return false;
  if (Math.abs(clampFrameScale(scene.frameScale) - 1) > 1e-3) return true;
  return !isIdentitySlotFrame(scene.slotFrames?.[0]);
}

export interface SlotFrameUniformInput extends SlotRectOptions {
  layout: SceneLayoutId;
  slotIdx: number;
  canvasAspect: number;
  fitMode: CardFitMode;
  frameScale?: number;
  frameGap?: number;
  override?: SlotFrameOverride | null;
}

/**
 * Computes `[dx, dyUp, scaleX, scaleY]` for the shader's `uFrameA/B` uniform so that:
 * 1. In `'fit'` mode (default), multi-photo cards shrink along whichever axis avoids cropping the photo.
 * 2. Group `frameScale` / `frameGap` and per-slot `override` apply identically in GPU and UI overlay.
 */
export function computeSlotFrameUniform(
  input: SlotFrameUniformInput
): [number, number, number, number] {
  const baseRect = getSlotFrameRect(input.layout, input.slotIdx, input.canvasAspect, input);
  let fitScaleX = 1;
  let fitScaleY = 1;

  if (
    input.layout !== 'single' &&
    input.fitMode === 'fit' &&
    typeof input.photoAspect === 'number' &&
    Number.isFinite(input.photoAspect) &&
    input.photoAspect > 0.05 &&
    baseRect.w > 0 &&
    baseRect.h > 0
  ) {
    const boxAspect = (baseRect.w * input.canvasAspect) / baseRect.h;
    if (input.photoAspect < boxAspect - 0.001) {
      // Portrait / taller photo inside a wider box: narrow the card horizontally so top & bottom are never cut.
      fitScaleX = clamp(input.photoAspect / boxAspect, 0.22, 1);
    } else if (input.photoAspect > boxAspect + 0.001) {
      // Wide photo inside a taller box: shorten vertically so left & right are never cut.
      fitScaleY = clamp(boxAspect / input.photoAspect, 0.22, 1);
    }
  }

  const groupScale = clampFrameScale(input.frameScale);
  const groupGap = clampFrameGap(input.frameGap);
  const ov = normalizeSlotFrame(input.override);

  const baseCx = baseRect.x + baseRect.w / 2;
  const baseCy = baseRect.y + baseRect.h / 2;
  const gapShift = input.layout === 'single' ? 0 : (groupGap - 1) * 0.28;
  const dx = (baseCx - 0.5) * gapShift + ov.dx;
  const dyDown = (baseCy - 0.5) * gapShift + ov.dy;

  const scaleX = clamp(fitScaleX * groupScale * ov.scaleX, 0.15, 3.0);
  const scaleY = clamp(fitScaleY * groupScale * ov.scaleY, 0.15, 3.0);

  // Shader uv has y up, UI has y down.
  return [dx === 0 ? 0 : dx, dyDown === 0 ? 0 : -dyDown, scaleX, scaleY];
}

/**
 * Exact on-screen rectangle (0..1 canvas coords, y down) of slot `slotIdx` after fit mode,
 * group scale/gap, and manual per-slot frame override. Matches `sampleScene()` in GLSL 1:1.
 */
export function getEffectiveSlotFrameRect(input: SlotFrameUniformInput): LayoutRect {
  const baseRect = getSlotFrameRect(input.layout, input.slotIdx, input.canvasAspect, input);
  const [dx, dyUp, scaleX, scaleY] = computeSlotFrameUniform(input);
  const cx = baseRect.x + baseRect.w / 2 + dx;
  const cy = baseRect.y + baseRect.h / 2 - dyUp;
  const w = baseRect.w * scaleX;
  const h = baseRect.h * scaleY;
  return {
    x: cx - w / 2,
    y: cy - h / 2,
    w,
    h,
  };
}
