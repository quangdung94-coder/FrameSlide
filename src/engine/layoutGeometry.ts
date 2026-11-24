import type { SceneLayoutId } from '@shared/types';

/** A photo card rectangle in frame coordinates (0..1, origin top-left, y down). */
export interface LayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Where each slot's card sits in the frame for the default (non-Polaroid, non-3D)
 * motion styles, at rest (no drift). Used by the UI to draw mini scene thumbnails
 * that match the real render. Keep in sync with `sampleScene()` in
 * shaders/sceneTransitionShader.ts.
 */
export function getLayoutRects(layout: SceneLayoutId, canvasAspect: number): LayoutRect[] {
  const fromCenter = (cx: number, cyUp: number, w: number, h: number): LayoutRect => ({
    x: cx - w / 2,
    // shader uv has y up; CSS has y down
    y: 1 - cyUp - h / 2,
    w,
    h,
  });

  switch (layout) {
    case 'diptych': {
      const frameH = 0.8;
      const frameW = Math.min(0.41, (frameH * (canvasAspect < 1 ? 0.52 : 0.72)) / canvasAspect);
      const gap = canvasAspect < 1 ? 0.022 : 0.032;
      const off = frameW / 2 + gap;
      return [fromCenter(0.5 - off, 0.5, frameW, frameH), fromCenter(0.5 + off, 0.5, frameW, frameH)];
    }
    case 'triptych': {
      const w = 0.275;
      const h = 0.72;
      const spacing = 0.305;
      return [-1, 0, 1].map((side) => fromCenter(0.5 + side * spacing, 0.5, w, h));
    }
    case 'mosaic4': {
      const w = 0.43;
      const h = 0.41;
      const gx = 0.232;
      const gy = 0.228;
      // order: top-left, top-right, bottom-left, bottom-right
      return [
        fromCenter(0.5 - gx, 0.5 + gy, w, h),
        fromCenter(0.5 + gx, 0.5 + gy, w, h),
        fromCenter(0.5 - gx, 0.5 - gy, w, h),
        fromCenter(0.5 + gx, 0.5 - gy, w, h),
      ];
    }
    default:
      return [{ x: 0, y: 0, w: 1, h: 1 }];
  }
}

export interface SlotRectOptions {
  /** Shader motion style code (MOTION_STYLE_CODE_MAP): 1 parallax, 2 polaroid, 5/6 3D. */
  motionStyle?: number;
  /** Width / height of the photo after its 90° rotation. */
  photoAspect?: number;
  portraitMode?: 'smart-pairing' | 'safe-top-third' | string;
}

/**
 * Frame of one slot (where the photo is drawn) for any motion style, at rest.
 * Mirrors the sizes in `sampleScene()`; used to place the on-preview photo editor.
 */
export function getSlotFrameRect(
  layout: SceneLayoutId,
  slotIdx: number,
  canvasAspect: number,
  opts: SlotRectOptions = {}
): LayoutRect {
  const style = opts.motionStyle ?? 0;
  const polaroid = style === 2;
  const parallax = style === 1;
  const is3d = style === 5 || style === 6;
  const centered = (w: number, h: number): LayoutRect => ({ x: 0.5 - w / 2, y: 0.5 - h / 2, w, h });

  if (layout === 'single') {
    const asp0 = opts.photoAspect ?? canvasAspect;
    const isPortrait = asp0 < 0.95;
    const framed =
      polaroid ||
      parallax ||
      is3d ||
      (isPortrait && opts.portraitMode !== 'safe-top-third' && canvasAspect > 1.05);
    if (!framed) return { x: 0, y: 0, w: 1, h: 1 };
    const frameH = polaroid ? 0.74 : is3d ? 0.78 : parallax ? 0.8 : 0.86;
    const targetAsp = isPortrait ? asp0 : Math.min(asp0, 1.65);
    const frameW = Math.min(0.84, (frameH * targetAsp) / canvasAspect);
    return centered(frameW, frameH);
  }
  if (layout === 'diptych') {
    const frameH = polaroid ? 0.72 : is3d ? 0.76 : 0.8;
    const frameW = Math.min(0.41, (frameH * (canvasAspect < 1 ? 0.52 : 0.72)) / canvasAspect);
    const gap = canvasAspect < 1 ? 0.022 : 0.032;
    const side = slotIdx === 0 ? -1 : 1;
    const cx = 0.5 + side * (frameW / 2 + gap);
    return { x: cx - frameW / 2, y: 0.5 - frameH / 2, w: frameW, h: frameH };
  }
  if (layout === 'triptych') {
    const w = 0.275;
    const h = polaroid ? 0.64 : 0.72;
    const cx = 0.5 + (Math.max(0, Math.min(2, slotIdx)) - 1) * 0.305;
    return { x: cx - w / 2, y: 0.5 - h / 2, w, h };
  }
  return getLayoutRects(layout, canvasAspect)[Math.max(0, Math.min(3, slotIdx))];
}
