/** Small numeric helpers shared by the engine, the store and the UI. */

export type Range = readonly [number, number];

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** `v` when it is a finite number, otherwise `fallback`. */
export const finiteOr = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/** `v` clamped into `range` when it is a finite number, otherwise `fallback` (not clamped). */
export const clampOr = (v: unknown, fallback: number, [lo, hi]: Range): number =>
  typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback;

/**
 * Fills every key of `defaults` from `src`, clamping into `limits`; missing or invalid
 * values take the default. Used for the small optional settings objects (photo colour,
 * card style, …) that are stored sparsely in the project file.
 */
export function normalizeByLimits<K extends string>(
  src: Partial<Record<K, unknown>> | null | undefined,
  defaults: Readonly<Record<K, number>>,
  limits: Readonly<Record<K, Range>>
): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const key of Object.keys(defaults) as K[]) {
    out[key] = clampOr(src?.[key], defaults[key], limits[key]);
  }
  return out;
}

/** True when every key of `values` is within `eps` of `defaults`. */
export function isNearDefaults<K extends string>(
  values: Readonly<Record<K, number>>,
  defaults: Readonly<Record<K, number>>,
  eps = 1e-4
): boolean {
  return (Object.keys(defaults) as K[]).every((k) => Math.abs(values[k] - defaults[k]) < eps);
}
