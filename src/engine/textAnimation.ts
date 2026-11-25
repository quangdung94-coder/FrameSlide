import type { CaptionTiming, TextAnimationId, TextOffset, TextTimingMode } from '@shared/types';
import { clamp } from './num';

export const TEXT_ANIMATIONS: { id: TextAnimationId; label: string }[] = [
  { id: 'fade', label: 'Mờ vào' },
  { id: 'typewriter', label: 'Gõ máy chữ' },
  { id: 'slide-up', label: 'Trượt lên' },
];

export const TEXT_OFFSET_LIMIT = 0.45;

/** Seconds a slide-up entry takes. */
const SLIDE_SEC = 0.7;
/** Slide-up starts this far below its final place (fraction of frame height). */
const SLIDE_DISTANCE = 0.05;
/** Typewriter speed. */
const TYPE_SEC_PER_CHAR = 0.055;
const TYPE_MAX_SEC = 2.5;

export interface TextAnimInput {
  animation?: TextAnimationId;
  timing: TextTimingMode;
  sceneIndex: number;
  sceneCount: number;
  /** Seconds into the current scene's own slot. */
  sceneLocalSec: number;
  /** Length of the current scene's slot (seconds). */
  slotSec: number;
  /** Seconds since the start of the video (used by "always"). */
  timeSec: number;
  /** Per-scene caption in/out window (only used by "per-scene"). */
  captionTiming?: CaptionTiming;
  /** Number of characters to type (typewriter only). */
  charCount: number;
}

export interface TextAnimState {
  /** Overall opacity multiplier 0..1. */
  alpha: number;
  /** Characters to show (typewriter), or Infinity for all. */
  revealChars: number;
  /** Extra downward offset (fraction of frame height) for slide-up. */
  slideY: number;
}

const ALL: TextAnimState = { alpha: 1, revealChars: Infinity, slideY: 0 };

/** Resolved caption window in seconds within a slot, clamped so in < out. */
export function resolveCaptionWindow(timing: CaptionTiming | undefined, slotSec: number): [number, number] {
  const inSec = clamp(timing?.inSec ?? 0, 0, Math.max(0, slotSec - 0.2));
  const outSec = clamp(timing?.outSec ?? slotSec, inSec + 0.2, slotSec);
  return [inSec, outSec];
}

/**
 * Opacity, typewriter progress and slide-up offset of the text overlay at one moment.
 * Pure function of time (from frameIndex), so preview and export match exactly.
 * With `animation` 'fade' and no caption timing this reproduces the original fades.
 */
export function computeTextAnim(i: TextAnimInput): TextAnimState {
  const p = i.slotSec > 0 ? clamp(i.sceneLocalSec / i.slotSec, 0, 1) : 0;
  let alpha = 1;
  let startSec = 0; // when the text starts entering, on the clock `localSec`
  let localSec = i.sceneLocalSec;

  if (i.timing === 'intro') {
    if (i.sceneIndex > 0) return { ...ALL, alpha: 0 };
    alpha = Math.max(0, Math.min(Math.min(1, p / 0.18), Math.min(1, (1 - p) / 0.2)));
  } else if (i.timing === 'outro') {
    if (i.sceneIndex < Math.max(0, i.sceneCount - 1)) return { ...ALL, alpha: 0 };
    alpha = Math.max(0, Math.min(Math.min(1, p / 0.2), Math.min(1, (1 - p) / 0.18)));
  } else if (i.timing === 'per-scene') {
    if (i.captionTiming && (i.captionTiming.inSec !== undefined || i.captionTiming.outSec !== undefined)) {
      const [inSec, outSec] = resolveCaptionWindow(i.captionTiming, i.slotSec);
      const fade = Math.min(0.4, (outSec - inSec) * 0.25);
      const t = i.sceneLocalSec;
      alpha = t < inSec || t > outSec ? 0 : Math.min(1, (t - inSec) / fade, (outSec - t) / fade);
      startSec = inSec;
    } else {
      alpha = Math.max(0, Math.min(Math.min(1, p / 0.15), Math.min(1, (1 - p) / 0.18)));
    }
  } else {
    localSec = i.timeSec; // "always": the text enters once, at the start of the video
  }

  const since = localSec - startSec;
  switch (i.animation ?? 'fade') {
    case 'typewriter': {
      const typeSec = Math.min(TYPE_MAX_SEC, Math.max(0.4, i.charCount * TYPE_SEC_PER_CHAR));
      const reveal = Math.floor(clamp(since / typeSec, 0, 1) * i.charCount);
      // Typing replaces the fade-in; the fade-out at the end is kept.
      return { alpha: since >= 0 ? Math.max(alpha, Math.min(1, alpha * 4)) : 0, revealChars: reveal, slideY: 0 };
    }
    case 'slide-up': {
      const e = clamp(since / SLIDE_SEC, 0, 1);
      const eased = 1 - Math.pow(1 - e, 3);
      return { alpha, revealChars: Infinity, slideY: (1 - eased) * SLIDE_DISTANCE };
    }
    default:
      return { alpha, revealChars: Infinity, slideY: 0 };
  }
}

/** Clamps a dragged text offset to stay mostly inside the frame. */
export function clampTextOffset(o: TextOffset | undefined | null): TextOffset {
  const L = TEXT_OFFSET_LIMIT;
  return { x: clamp(o?.x ?? 0, -L, L), y: clamp(o?.y ?? 0, -L, L) };
}
