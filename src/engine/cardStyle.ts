import type { SceneCardStyle } from '@shared/types';
import { isNearDefaults, normalizeByLimits } from './num';

export const CARD_STYLE_LIMITS = {
  corner: [0, 1],
  shadow: [0, 2],
  border: [0, 3],
  feather: [0, 1],
} as const;

export const NEUTRAL_CARD_STYLE: Required<SceneCardStyle> = { corner: 0, shadow: 1, border: 1, feather: 0 };

export function normalizeCardStyle(s: SceneCardStyle | undefined | null): Required<SceneCardStyle> {
  return normalizeByLimits(s, NEUTRAL_CARD_STYLE, CARD_STYLE_LIMITS);
}

export function isNeutralCardStyle(s: SceneCardStyle | undefined | null): boolean {
  return isNearDefaults(normalizeCardStyle(s), NEUTRAL_CARD_STYLE);
}

/** [corner, shadow, border, feather] for the shader's per-scene uniform. */
export function cardStyleToUniform(s: SceneCardStyle | undefined | null): [number, number, number, number] {
  const n = normalizeCardStyle(s);
  return [n.corner, n.shadow, n.border, n.feather];
}
