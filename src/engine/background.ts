import type {
  BackgroundOptions,
  BackgroundPattern,
  BackgroundStyle,
  RenderParams,
  SceneBackground,
  SceneItem,
} from '@shared/types';

export const DEFAULT_BACKGROUND_OPTIONS: BackgroundOptions = {
  color1: '#1c1612',
  color2: '#6b4a33',
  angleDeg: 135,
  pattern: 'dots',
};

export interface GradientPreset {
  id: string;
  label: string;
  color1: string;
  color2: string;
  angleDeg: number;
}

/** Warm, film-friendly gradients that sit well behind wedding / event photos. */
export const GRADIENT_PRESETS: GradientPreset[] = [
  { id: 'sunset', label: 'Hoàng hôn', color1: '#2a1810', color2: '#b8693a', angleDeg: 160 },
  { id: 'ivory', label: 'Kem cưới', color1: '#f1e8da', color2: '#c4b096', angleDeg: 180 },
  { id: 'wine', label: 'Rượu vang', color1: '#14070b', color2: '#6e2235', angleDeg: 135 },
  { id: 'night', label: 'Đêm xanh', color1: '#070c18', color2: '#2b4a6e', angleDeg: 200 },
  { id: 'moss', label: 'Rêu cổ', color1: '#10140d', color2: '#4d5a39', angleDeg: 120 },
  { id: 'blush', label: 'Hồng phấn', color1: '#3a2026', color2: '#d9a3a6', angleDeg: 45 },
  { id: 'gold', label: 'Vàng đồng', color1: '#1a1206', color2: '#a8813c', angleDeg: 90 },
  { id: 'charcoal', label: 'Than chì', color1: '#0b0b0e', color2: '#3b3c45', angleDeg: 180 },
];

export const BACKGROUND_PATTERN_LABELS: Record<BackgroundPattern, string> = {
  dots: 'Chấm bi',
  stripes: 'Sọc chéo',
  grid: 'Kẻ ô',
  diamonds: 'Quả trám',
};

export const BACKGROUND_STYLE_LABELS: Record<BackgroundStyle, string> = {
  blur: 'Ảnh mờ',
  black: 'Đen thuần',
  paper: 'Giấy ảnh',
  studio: 'Studio',
  solid: 'Màu trơn',
  gradient: 'Gradient',
  pattern: 'Họa tiết',
};

export const BG_STYLE_CODE: Record<BackgroundStyle, number> = {
  blur: 0,
  black: 1,
  paper: 2,
  studio: 3,
  solid: 4,
  gradient: 5,
  pattern: 6,
};

export const BG_PATTERN_CODE: Record<BackgroundPattern, number> = {
  dots: 0,
  stripes: 1,
  grid: 2,
  diamonds: 3,
};

/** The background a scene really uses: its own override, else the project setting. */
export function resolveSceneBackground(
  params: Pick<RenderParams, 'backgroundStyle' | 'backgroundOptions'> | undefined,
  scene: Pick<SceneItem, 'background'> | undefined
): SceneBackground {
  if (scene?.background) return { ...DEFAULT_BACKGROUND_OPTIONS, ...scene.background };
  return {
    ...DEFAULT_BACKGROUND_OPTIONS,
    ...(params?.backgroundOptions ?? {}),
    style: params?.backgroundStyle ?? 'blur',
  };
}

/** "#rrggbb" / "#rgb" → linear-light RGB 0..1 (the render pipeline works in linear). */
export function hexToLinearRgb(hex: string): [number, number, number] {
  let h = (hex ?? '').trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [0, 0, 0];
  const toLin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return [
    toLin(parseInt(h.slice(0, 2), 16)),
    toLin(parseInt(h.slice(2, 4), 16)),
    toLin(parseInt(h.slice(4, 6), 16)),
  ];
}

/** CSS approximation of a background, for small UI swatches / scene thumbnails. */
export function backgroundCss(bg: SceneBackground): string {
  switch (bg.style) {
    case 'black':
      return '#020203';
    case 'paper':
      return '#c9bfae';
    case 'studio':
      return 'radial-gradient(circle, #2b2c33 0%, #0a0a0d 75%)';
    case 'solid':
      return bg.color1;
    case 'gradient':
      return `linear-gradient(${bg.angleDeg}deg, ${bg.color1}, ${bg.color2})`;
    case 'pattern':
      switch (bg.pattern) {
        case 'stripes':
          return `repeating-linear-gradient(45deg, ${bg.color1} 0 5px, ${bg.color2} 5px 7px)`;
        case 'grid':
          return `linear-gradient(${bg.color2} 1px, transparent 1px) 0 0 / 8px 8px, linear-gradient(90deg, ${bg.color2} 1px, ${bg.color1} 1px) 0 0 / 8px 8px`;
        case 'diamonds':
          return `conic-gradient(from 45deg, ${bg.color2} 25%, ${bg.color1} 0 50%, ${bg.color2} 0 75%, ${bg.color1} 0) 0 0 / 8px 8px`;
        default:
          return `radial-gradient(${bg.color2} 22%, ${bg.color1} 24%) 0 0 / 7px 7px`;
      }
    default:
      return '#17171c';
  }
}
