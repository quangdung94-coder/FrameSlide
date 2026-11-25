/** Time display helpers for the transport bar (Đợt 5.1c). */

/** "MM:SS:FF" (minutes : seconds : frame within the second), like editing apps. */
export function formatTimecode(frame: number, fps: number): string {
  const f = Math.max(0, Math.round(frame));
  const rate = Math.max(1, Math.round(fps));
  const totalSec = Math.floor(f / rate);
  const ff = f - totalSec * rate;
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec - mm * 60;
  return `${pad2(mm)}:${pad2(ss)}:${pad2(ff)}`;
}

/** "MM:SS.s" (tenths of a second). */
export function formatSecondsClock(sec: number): string {
  const tenths = Math.max(0, Math.round(sec * 10));
  const mm = Math.floor(tenths / 600);
  const rest = (tenths - mm * 600) / 10;
  return `${pad2(mm)}:${rest.toFixed(1).padStart(4, '0')}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

const RULER_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300];

/** Labelled ruler marks (seconds) for a clip, at most `maxLabels` of them, at a round step. */
export function rulerMarks(durationSec: number, maxLabels = 12): number[] {
  if (!(durationSec > 0)) return [];
  const step = RULER_STEPS.find((s) => durationSec / s <= maxLabels) ?? RULER_STEPS[RULER_STEPS.length - 1];
  const marks: number[] = [];
  for (let t = 0; t <= durationSec + 1e-6; t += step) marks.push(t);
  return marks;
}

export interface ScenePosition {
  /** 0-based index of the scene under the playhead. */
  index: number;
  /** Seconds since that scene started. */
  offsetSec: number;
  durationSec: number;
}

/** Which scene the playhead is in, from the resolved scene durations. */
export function scenePositionAt(timeSec: number, durations: readonly number[]): ScenePosition | null {
  if (durations.length === 0) return null;
  let start = 0;
  for (let i = 0; i < durations.length; i++) {
    const d = durations[i];
    if (timeSec < start + d || i === durations.length - 1) {
      return { index: i, offsetSec: Math.max(0, Math.min(d, timeSec - start)), durationSec: d };
    }
    start += d;
  }
  return null;
}
