/**
 * Selecting several scene cards (Đợt 6.2), like a file explorer: click = only this one,
 * Shift + click = the run from the anchor to this one, Ctrl + click = add / remove one.
 * The anchor is the last card clicked without Shift.
 */
export type SceneClickMode = 'single' | 'range' | 'toggle';

export interface SceneSelection {
  selected: string[];
  anchor: string | null;
}

export function clickSceneSelection(
  order: readonly string[],
  current: SceneSelection,
  clickedId: string,
  mode: SceneClickMode
): SceneSelection {
  if (!order.includes(clickedId)) return current;
  if (mode === 'toggle') {
    const has = current.selected.includes(clickedId);
    const picked = new Set(has ? current.selected.filter((id) => id !== clickedId) : [...current.selected, clickedId]);
    return { selected: order.filter((id) => picked.has(id)), anchor: clickedId };
  }
  if (mode === 'range') {
    const anchor = current.anchor && order.includes(current.anchor) ? current.anchor : clickedId;
    const a = order.indexOf(anchor);
    const b = order.indexOf(clickedId);
    return { selected: order.slice(Math.min(a, b), Math.max(a, b) + 1), anchor };
  }
  return { selected: [clickedId], anchor: clickedId };
}

/** Drops ids of scenes that no longer exist, keeping timeline order. */
export function pruneSceneSelection(order: readonly string[], selected: readonly string[]): string[] {
  const keep = new Set(selected);
  return order.filter((id) => keep.has(id));
}
