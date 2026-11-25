/**
 * In / Out range (Đợt 5.2c): mark part of the clip to loop in preview or export alone.
 * Frames keep their project index, so grain / dust / weave in the exported part match the
 * preview exactly (deterministic render, D06).
 */

/** Frames `start` .. `end - 1` (end exclusive). */
export interface FrameRange {
  start: number;
  end: number;
}

export type ExportRangeMode = 'all' | 'inout' | 'scene';

/**
 * The marked range, clamped to the clip. Only In set: In → end of clip. Only Out set:
 * start → Out (Out frame included). In after Out: the two are swapped. Null when nothing is marked.
 */
export function marksToRange(markIn: number | null, markOut: number | null, totalFrames: number): FrameRange | null {
  const total = Math.max(0, Math.floor(totalFrames));
  if (total === 0 || (markIn === null && markOut === null)) return null;
  const last = total - 1;
  const clampF = (f: number) => Math.max(0, Math.min(last, Math.round(f)));
  let a = markIn === null ? 0 : clampF(markIn);
  let b = markOut === null ? last : clampF(markOut);
  if (a > b) [a, b] = [b, a];
  return { start: a, end: b + 1 };
}

/** Frame range of scene `index`, rounded the same way as the scene track. */
export function sceneFrameRange(index: number, durations: readonly number[], fps: number): FrameRange | null {
  if (index < 0 || index >= durations.length) return null;
  let startSec = 0;
  for (let i = 0; i < index; i++) startSec += durations[i];
  return { start: Math.round(startSec * fps), end: Math.round((startSec + durations[index]) * fps) };
}

export function rangeFrameCount(range: FrameRange): number {
  return Math.max(0, range.end - range.start);
}

/** "_00m06s-00m16s" for the exported file name. */
export function rangeFileSuffix(range: FrameRange, fps: number): string {
  const stamp = (frame: number) => {
    const sec = Math.floor(frame / Math.max(1, fps));
    return `${String(Math.floor(sec / 60)).padStart(2, '0')}m${String(sec % 60).padStart(2, '0')}s`;
  };
  return `_${stamp(range.start)}-${stamp(range.end)}`;
}

/** Range that an export of the given mode covers (null = whole clip). */
export function resolveExportRange(
  mode: ExportRangeMode,
  input: { markIn: number | null; markOut: number | null; totalFrames: number; sceneRange: FrameRange | null }
): FrameRange | null {
  if (mode === 'inout') return marksToRange(input.markIn, input.markOut, input.totalFrames);
  if (mode === 'scene' && input.sceneRange) {
    const end = Math.min(input.totalFrames, input.sceneRange.end);
    const start = Math.max(0, Math.min(input.sceneRange.start, end));
    return end > start ? { start, end } : null;
  }
  return null;
}
