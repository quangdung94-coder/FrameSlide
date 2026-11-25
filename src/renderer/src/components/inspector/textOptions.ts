import { TEXT_ANIMATIONS } from '@engine/textAnimation';
import type { TextAnimationId, TextStyleId } from '@shared/types';
import type { SelectOption } from '../ui';

export const TEXT_STYLE_OPTIONS: SelectOption<TextStyleId>[] = [
  { value: 'none', label: 'Tắt chữ' },
  { value: 'date-stamp-90s', label: 'Date Stamp 90s (Cam điện tử)' },
  { value: 'minimal-fade', label: 'Minimal Title (Hiện đại)' },
  { value: 'editorial-serif', label: 'Editorial Serif (Phim cưới)' },
  { value: 'filmstrip-label', label: 'Filmstrip Label (Viền phim)' },
  { value: 'lower-third', label: 'Lower Third (Góc trái dưới)' },
];

export const TEXT_ANIMATION_OPTIONS: SelectOption<TextAnimationId>[] = TEXT_ANIMATIONS.map((a) => ({
  value: a.id,
  label: a.label,
}));
