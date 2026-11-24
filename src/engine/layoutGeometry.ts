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
