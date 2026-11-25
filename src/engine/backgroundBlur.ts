import type { BackgroundBlurKind, BackgroundOptions } from '@shared/types';
import { clamp, finiteOr } from './num';

/**
 * "Ảnh mờ" background (Đợt 5.4c, D29). Each photo gets a small blurred copy made once (canvas,
 * cached with the photo) instead of a heavy blur loop in the main shader; the shader reads it
 * once. Nothing is random per frame, so preview and export match.
 */

export const BLUR_KINDS: readonly { id: BackgroundBlurKind; label: string; hint: string }[] = [
  { id: 'smooth', label: 'Mờ mịn', hint: 'Mờ đều như ống kính xóa phông' },
  { id: 'zoom', label: 'Mờ phóng', hint: 'Vệt mờ tỏa ra từ giữa ảnh' },
  { id: 'motion', label: 'Mờ chuyển động', hint: 'Vệt mờ theo chiều ngang' },
  { id: 'frosted', label: 'Kính mờ', hint: 'Mờ có hạt như kính nhám' },
  { id: 'vignette', label: 'Mờ tối viền', hint: 'Mờ, tối dần ra mép khung' },
];

export const DEFAULT_BLUR = { kind: 'smooth' as BackgroundBlurKind, amount: 60, darkness: 80, zoom: 118 };

/** Longest edge of the blurred copy in px (small on purpose: it is blurred anyway). */
export const BLUR_TEXTURE_EDGE = 320;

export interface BlurSettings {
  kind: BackgroundBlurKind;
  amount: number;
  darkness: number;
  zoom: number;
}

export function resolveBlurSettings(opts: Partial<BackgroundOptions> | undefined): BlurSettings {
  const kind = BLUR_KINDS.some((k) => k.id === opts?.blurKind) ? (opts!.blurKind as BackgroundBlurKind) : DEFAULT_BLUR.kind;
  return {
    kind,
    amount: clamp(Math.round(finiteOr(opts?.blurAmount, DEFAULT_BLUR.amount)), 0, 100),
    darkness: clamp(Math.round(finiteOr(opts?.blurDarkness, DEFAULT_BLUR.darkness)), 0, 100),
    zoom: clamp(Math.round(finiteOr(opts?.blurZoom, DEFAULT_BLUR.zoom)), 100, 160),
  };
}

/**
 * Shader values: brightness multiplier (darkness 80 = 0.24, the original look), zoom factor and
 * edge darkening (only "Mờ tối viền").
 */
export function blurShaderParams(b: BlurSettings): { brightness: number; zoom: number; vignette: number } {
  return {
    brightness: clamp(1 - b.darkness * 0.0095, 0.05, 1),
    zoom: b.zoom / 100,
    vignette: b.kind === 'vignette' ? 0.85 : 0,
  };
}

export interface BlurPass {
  /** Scale about the image centre. */
  scale: number;
  /** Horizontal shift as a fraction of the width. */
  dx: number;
  /** Canvas globalAlpha for this pass (running average: 1 / (i + 1)). */
  alpha: number;
}

export interface BlurRecipe {
  /** CSS blur radius in px on the BLUR_TEXTURE_EDGE canvas. */
  filterPx: number;
  passes: BlurPass[];
  /** Grain strength 0..1 ("Kính mờ"). */
  noise: number;
}

const STREAK_PASSES = 12;

/** How to draw the blurred copy for a blur type and strength (pure, so it is testable). */
export function blurRecipe(kind: BackgroundBlurKind, amount: number): BlurRecipe {
  const a = clamp(amount, 0, 100) / 100;
  const r = a * 20;
  const streak = (fn: (t: number) => Omit<BlurPass, 'alpha'>) =>
    Array.from({ length: STREAK_PASSES }, (_, i) => ({ ...fn(i / (STREAK_PASSES - 1)), alpha: 1 / (i + 1) }));
  switch (kind) {
    case 'zoom':
      return { filterPx: r * 0.3, passes: streak((t) => ({ scale: 1 + t * a * 0.3, dx: 0 })), noise: 0 };
    case 'motion':
      return { filterPx: r * 0.25, passes: streak((t) => ({ scale: 1, dx: (t - 0.5) * a * 0.2 })), noise: 0 };
    case 'frosted':
      return { filterPx: r * 0.6, passes: [{ scale: 1, dx: 0, alpha: 1 }], noise: 0.05 + a * 0.1 };
    default:
      return { filterPx: r, passes: [{ scale: 1, dx: 0, alpha: 1 }], noise: 0 };
  }
}

/** Cache key of a photo's blurred copy. */
export function blurCacheKey(url: string, kind: BackgroundBlurKind, amount: number): string {
  // "Mờ tối viền" darkens in the shader, so it shares the "Mờ mịn" copy.
  return `${url}|${kind === 'vignette' ? 'smooth' : kind}|${Math.round(amount)}`;
}
