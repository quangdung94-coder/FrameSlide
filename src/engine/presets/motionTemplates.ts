import type {
  FilmLookId,
  MotionTemplateId,
  PortraitMode,
  SceneLayoutId,
  TextStyleId,
  TransitionType,
} from '@shared/types';

export interface MotionTemplatePreset {
  id: MotionTemplateId;
  shaderStyleCode: number; // 0=classic, 1=parallax25d, 2=polaroid, 3=filmstrip, 4=mosaic
  name: string;
  desc: string;
  heavyLevel: 'light' | 'medium';
  recommendedLook: FilmLookId;
  recommendedTransition: TransitionType;
  recommendedPortraitMode: PortraitMode;
  recommendedTextStyle: TextStyleId;
  /** Default scene layout sequence when building scenes automatically from photos */
  layoutPattern: SceneLayoutId[];
}

export const MOTION_TEMPLATE_PRESETS: MotionTemplatePreset[] = [
  {
    id: 'ken-burns-classic',
    shaderStyleCode: 0,
    name: 'Ken Burns Classic',
    desc: 'Lướt & zoom chậm mượt, sang trọng, nhẹ GPU nhất',
    heavyLevel: 'light',
    recommendedLook: 'super8-family',
    recommendedTransition: 'light-leak',
    recommendedPortraitMode: 'smart-pairing',
    recommendedTextStyle: 'date-stamp-90s',
    layoutPattern: ['single', 'diptych', 'single'],
  },
  {
    id: 'parallax-25d',
    shaderStyleCode: 1,
    name: '2.5D Parallax Depth',
    desc: 'Khung ảnh nổi có chiều sâu Z, nền mờ trôi lệch tốc độ',
    heavyLevel: 'medium',
    recommendedLook: '35mm-cinema',
    recommendedTransition: 'smooth-zoom-in',
    recommendedPortraitMode: 'matte-framed',
    recommendedTextStyle: 'minimal-fade',
    layoutPattern: ['single', 'single', 'diptych'],
  },
  {
    id: 'polaroid-memories',
    shaderStyleCode: 2,
    name: 'Polaroid Kỷ Niệm',
    desc: 'Khung ảnh trắng bản dày kiểu lấy liền, nghiêng nhẹ',
    heavyLevel: 'light',
    recommendedLook: 'instant-polaroid',
    recommendedTransition: 'paper-slide',
    recommendedPortraitMode: 'smart-pairing',
    recommendedTextStyle: 'editorial-serif',
    layoutPattern: ['diptych', 'single', 'diptych'],
  },
  {
    id: 'filmstrip-roll',
    shaderStyleCode: 3,
    name: 'Filmstrip Cuộn Phim',
    desc: 'Dải 3 khung phim liên tiếp, trượt ngang kiểu phim nhựa',
    heavyLevel: 'light',
    recommendedLook: '16mm-doc',
    recommendedTransition: 'filmstrip-push',
    recommendedPortraitMode: 'smart-pairing',
    recommendedTextStyle: 'filmstrip-label',
    layoutPattern: ['triptych', 'single', 'triptych'],
  },
  {
    id: 'minimal-mosaic',
    shaderStyleCode: 4,
    name: 'Minimal Mosaic',
    desc: 'Lưới 4 ảnh & 2 ảnh hiện đại, hợp sự kiện & tiệc cuối năm',
    heavyLevel: 'medium',
    recommendedLook: 'bleach-bypass',
    recommendedTransition: 'whip-pan-left',
    recommendedPortraitMode: 'smart-pairing',
    recommendedTextStyle: 'lower-third',
    layoutPattern: ['mosaic4', 'diptych', 'single'],
  },
  {
    id: 'gallery-3d',
    shaderStyleCode: 5,
    name: '3D Floating Gallery',
    desc: 'Thẻ ảnh nổi nghiêng phối cảnh 3D thật, đổ bóng sâu, camera lướt chéo',
    heavyLevel: 'medium',
    recommendedLook: '35mm-cinema',
    recommendedTransition: 'dolly-3d',
    recommendedPortraitMode: 'matte-framed',
    recommendedTextStyle: 'editorial-serif',
    layoutPattern: ['single', 'diptych', 'single'],
  },
  {
    id: 'wall-3d',
    shaderStyleCode: 6,
    name: '3D Photo Wall Depth',
    desc: 'Tường ảnh 3D phân tầng chiều sâu Z, camera orbit nhẹ cực sang',
    heavyLevel: 'medium',
    recommendedLook: 'super8-family',
    recommendedTransition: 'cube-3d',
    recommendedPortraitMode: 'smart-pairing',
    recommendedTextStyle: 'minimal-fade',
    layoutPattern: ['mosaic4', 'triptych', 'diptych'],
  },
];

export const MOTION_STYLE_CODE_MAP: Record<MotionTemplateId, number> = Object.fromEntries(
  MOTION_TEMPLATE_PRESETS.map((m) => [m.id, m.shaderStyleCode])
) as Record<MotionTemplateId, number>;

export function getMotionTemplate(id: MotionTemplateId): MotionTemplatePreset {
  return MOTION_TEMPLATE_PRESETS.find((m) => m.id === id) ?? MOTION_TEMPLATE_PRESETS[0];
}
