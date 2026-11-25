/**
 * "Vừa khung" for the scene strip (Đợt 5.2b): the largest card zoom at which every scene
 * fits the visible area in grid mode, estimated from one measured item.
 */
export interface SceneFitInput {
  sceneCount: number;
  /** Visible strip area in px. */
  areaWidth: number;
  areaHeight: number;
  /** Size of one measured item (card + its transition chip) at `measuredZoom`. */
  itemWidth: number;
  itemHeight: number;
  measuredZoom: number;
  /** Card width and mini frame height per 1.0 zoom (SceneTrack constants). */
  cardWidthPerZoom: number;
  miniHeightPerZoom: number;
  gap: number;
  /** Cards never get narrower than this (px). */
  minCardWidth?: number;
  minZoom: number;
  maxZoom: number;
}

export function fitSceneZoom(input: SceneFitInput): number {
  const { sceneCount, areaWidth, areaHeight, gap, minZoom, maxZoom } = input;
  if (sceneCount <= 0 || areaWidth <= 0 || areaHeight <= 0) return minZoom;
  // Parts of an item that do not scale with zoom (chip, header, padding).
  const minCard = input.minCardWidth ?? 0;
  const cardAt = (z: number) => Math.max(minCard, input.cardWidthPerZoom * z);
  const fixedW = Math.max(0, input.itemWidth - cardAt(input.measuredZoom));
  const fixedH = Math.max(0, input.itemHeight - input.miniHeightPerZoom * input.measuredZoom);
  for (let z = maxZoom; z >= minZoom - 1e-6; z -= 0.05) {
    const w = fixedW + cardAt(z);
    const h = fixedH + input.miniHeightPerZoom * z;
    const cols = Math.max(1, Math.floor((areaWidth + gap) / (w + gap)));
    const rows = Math.ceil(sceneCount / cols);
    if (rows * h + (rows - 1) * gap <= areaHeight) return Math.round(z * 100) / 100;
  }
  return minZoom;
}

/** Ctrl + wheel: one notch = ±0.1 zoom, kept inside the limits. */
export function wheelZoom(current: number, deltaY: number, min: number, max: number): number {
  if (deltaY === 0) return current;
  const next = current + (deltaY < 0 ? 0.1 : -0.1);
  return Math.round(Math.min(max, Math.max(min, next)) * 100) / 100;
}
