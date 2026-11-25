/** Copy of `obj` without `keys` (replaces the `const { key: _drop, ...rest } = obj` pattern). */
export function omitKeys<T extends object, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> {
  const out = { ...obj };
  for (const k of keys) delete out[k];
  return out;
}

/**
 * Sets `key` to `value`, or removes it when `value` is undefined / null, so optional
 * per-scene / per-photo settings stay absent from the project file when not used.
 */
export function withOptional<T extends object, K extends keyof T>(obj: T, key: K, value: T[K] | null | undefined): T {
  const out = omitKeys(obj, key) as T;
  if (value !== undefined && value !== null) out[key] = value;
  return out;
}

/** Maps only the item whose `id` matches; other items are returned unchanged. */
export function mapById<T extends { id: string }>(items: readonly T[], id: string, fn: (item: T) => T): T[] {
  return items.map((item) => (item.id === id ? fn(item) : item));
}
