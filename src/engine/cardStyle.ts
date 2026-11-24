import type { SceneCardStyle } from '@shared/types';

export const CARD_STYLE_LIMITS = {
  corner: [0, 1],
  shadow: [0, 2],
  border: [0, 3],
  feather: [0, 1],
} as const;

export const NEUTRAL_CARD_STYLE: Required<SceneCardStyle> = { corner: 0, shadow: 1, border: 1, feather: 0 };

const num = (v: unknown, fallback: number, [lo, hi]: readonly [number, number]) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;

export function normalizeCardStyle(s: SceneCardStyle | undefined | null): Required<SceneCardStyle> {
  const L = CARD_STYLE_LIMITS;
  return {
    corner: num(s?.corner, 0, L.corner),
    shadow: num(s?.shadow, 1, L.shadow),
    border: num(s?.border, 1, L.border),
    feather: num(s?.feather, 0, L.feather),
  };
}

export function isNeutralCardStyle(s: SceneCardStyle | undefined | null): boolean {
  const n = normalizeCardStyle(s);
  return (
    n.corner < 1e-4 && Math.abs(n.shadow - 1) < 1e-4 && Math.abs(n.border - 1) < 1e-4 && n.feather < 1e-4
  );
}

/** [corner, shadow, border, feather] for the shader's per-scene uniform. */
export function cardStyleToUniform(s: SceneCardStyle | undefined | null): [number, number, number, number] {
  const n = normalizeCardStyle(s);
  return [n.corner, n.shadow, n.border, n.feather];
}
