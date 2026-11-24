import type { TransitionType } from '@shared/types';

export interface TransitionPreset {
  id: TransitionType;
  shaderCode: number;
  name: string;
  group: 'Mềm & Cổ điển' | 'Ánh sáng & Phim' | 'Chuyển động' | 'Giấy & Khung' | '3D Phối cảnh';
  heavyLevel: 'light' | 'medium';
}

export const TRANSITION_PRESETS: TransitionPreset[] = [
  { id: 'film-dissolve',      shaderCode: 0,  name: 'Film Dissolve',      group: 'Mềm & Cổ điển',   heavyLevel: 'light' },
  { id: 'light-leak',         shaderCode: 1,  name: 'Light Leak Wipe',    group: 'Ánh sáng & Phim', heavyLevel: 'medium' },
  { id: 'dip-black',          shaderCode: 2,  name: 'Dip to Black',       group: 'Mềm & Cổ điển',   heavyLevel: 'light' },
  { id: 'dip-white',          shaderCode: 3,  name: 'Dip to White',       group: 'Mềm & Cổ điển',   heavyLevel: 'light' },
  { id: 'dreamy-blur',        shaderCode: 4,  name: 'Dreamy Blur',        group: 'Mềm & Cổ điển',   heavyLevel: 'medium' },
  { id: 'bloom-dissolve',     shaderCode: 5,  name: 'Bloom Dissolve',     group: 'Mềm & Cổ điển',   heavyLevel: 'medium' },
  { id: 'film-burn',          shaderCode: 6,  name: 'Film Burn',          group: 'Ánh sáng & Phim', heavyLevel: 'medium' },
  { id: 'overexposure-flash', shaderCode: 7,  name: 'Overexposure Flash', group: 'Ánh sáng & Phim', heavyLevel: 'light' },
  { id: 'filmstrip-push',     shaderCode: 8,  name: 'Filmstrip Push',     group: 'Ánh sáng & Phim', heavyLevel: 'light' },
  { id: 'smooth-zoom-in',     shaderCode: 9,  name: 'Smooth Zoom In',     group: 'Chuyển động',     heavyLevel: 'light' },
  { id: 'smooth-zoom-out',    shaderCode: 10, name: 'Smooth Zoom Out',    group: 'Chuyển động',     heavyLevel: 'light' },
  { id: 'whip-pan-left',      shaderCode: 11, name: 'Whip Pan Trái',      group: 'Chuyển động',     heavyLevel: 'light' },
  { id: 'whip-pan-right',     shaderCode: 12, name: 'Whip Pan Phải',      group: 'Chuyển động',     heavyLevel: 'light' },
  { id: 'camera-shake-cut',   shaderCode: 13, name: 'Camera Shake Cut',   group: 'Chuyển động',     heavyLevel: 'light' },
  { id: 'paper-slide',        shaderCode: 14, name: 'Paper Slide',        group: 'Giấy & Khung',    heavyLevel: 'light' },
  { id: 'page-curl',          shaderCode: 15, name: 'Page Curl (Lật nhẹ)', group: 'Giấy & Khung',   heavyLevel: 'medium' },
  { id: 'flip-3d',            shaderCode: 16, name: '3D Card Flip',       group: '3D Phối cảnh',    heavyLevel: 'light' },
  { id: 'cube-3d',            shaderCode: 17, name: '3D Cube Turn',       group: '3D Phối cảnh',    heavyLevel: 'light' },
  { id: 'dolly-3d',           shaderCode: 18, name: '3D Dolly Fly-Through', group: '3D Phối cảnh',  heavyLevel: 'medium' },
  { id: 'page-turn-3d',       shaderCode: 19, name: '3D Page Turn',       group: '3D Phối cảnh',    heavyLevel: 'medium' },
];

export const TRANSITION_CODE_MAP: Record<TransitionType, number> = Object.fromEntries(
  TRANSITION_PRESETS.map((t) => [t.id, t.shaderCode])
) as Record<TransitionType, number>;

export const CINEMATIC_RANDOM_TRANSITIONS: TransitionType[] = [
  'film-dissolve',
  'light-leak',
  'dip-black',
  'dip-white',
  'dreamy-blur',
  'bloom-dissolve',
  'film-burn',
  'filmstrip-push',
  'smooth-zoom-in',
  'smooth-zoom-out',
  'whip-pan-left',
  'whip-pan-right',
  'paper-slide',
  'page-curl',
  'flip-3d',
  'cube-3d',
  'dolly-3d',
  'page-turn-3d',
];

export function getTransitionName(id: TransitionType): string {
  return TRANSITION_PRESETS.find((t) => t.id === id)?.name ?? id;
}
