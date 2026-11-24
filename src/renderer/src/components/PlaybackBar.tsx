import { memo, useMemo } from 'react';
import { resolveSlideDurations } from '@engine/timeline';
import { useAppStore } from '../store/useAppStore';
import type { CompareMode } from '@shared/types';

interface PlaybackBarProps {
  totalFrames: number;
  effectiveDurationSec: number;
  disabled: boolean;
  onToggleFullscreen: () => void;
}

function formatTime(sec: number): string {
  const s = Math.max(0, sec);
  const mins = Math.floor(s / 60);
  const rem = s - mins * 60;
  return `${String(mins).padStart(2, '0')}:${rem.toFixed(1).padStart(4, '0')}`;
}

/**
 * Isolated playback bar subscribed to high-frequency `frameIndex` updates
 * with visual Scene tick markers, Handles zone highlight, Frame Step,
 * Before/After Compare toggle, and Fullscreen Preview button.
 */
export const PlaybackBar = memo(function PlaybackBar({
  totalFrames,
  effectiveDurationSec,
  disabled,
  onToggleFullscreen,
}: PlaybackBarProps) {
  const frameIndex = useAppStore((s) => s.frameIndex);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const fps = useAppStore((s) => s.fps);
  const scenes = useAppStore((s) => s.scenes);
  const renderParams = useAppStore((s) => s.renderParams);
  const compareMode = useAppStore((s) => s.compareMode);

  const setIsPlaying = useAppStore((s) => s.setIsPlaying);
  const setFrameIndex = useAppStore((s) => s.setFrameIndex);
  const setCompareMode = useAppStore((s) => s.setCompareMode);

  // Compute scene boundary tick positions (percentage 0..100)
  const { tickPercents, handlePct } = useMemo(() => {
    if (scenes.length === 0 || effectiveDurationSec <= 0) {
      return { tickPercents: [] as number[], handlePct: 0 };
    }
    const durations = resolveSlideDurations(scenes.length, {
      durationMode: renderParams.durationMode,
      totalDurationSec: renderParams.totalDurationSec,
      defaultSlideDurationSec: renderParams.defaultSlideDurationSec,
      slideDurations: scenes.map((sc) => sc.durationSec),
      handlesSec: renderParams.handlesSec,
    });
    const ticks: number[] = [];
    let acc = 0;
    for (let i = 0; i < durations.length - 1; i++) {
      acc += durations[i];
      ticks.push((acc / effectiveDurationSec) * 100);
    }
    const hPct =
      renderParams.handlesSec > 0
        ? Math.min(25, (renderParams.handlesSec / effectiveDurationSec) * 100)
        : 0;
    return { tickPercents: ticks, handlePct: hPct };
  }, [scenes, renderParams, effectiveDurationSec]);

  const stepFrame = (delta: number) => {
    setIsPlaying(false);
    const next = Math.max(0, Math.min(Math.max(0, totalFrames - 1), frameIndex + delta));
    setFrameIndex(next);
  };

  const cycleCompare = () => {
    const order: CompareMode[] = ['normal', 'split', 'before'];
    const next = order[(order.indexOf(compareMode) + 1) % order.length];
    setCompareMode(next);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setIsPlaying(!isPlaying)}
        disabled={disabled}
        className="w-18 rounded bg-amber-500 px-2.5 py-1 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
      >
        {isPlaying ? 'Tạm dừng' : 'Phát'}
      </button>

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => stepFrame(-1)}
          title="Lùi 1 frame (←)"
          className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-1 text-xs text-zinc-300 hover:border-zinc-600 disabled:opacity-30"
        >
          ◀|
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => stepFrame(1)}
          title="Tiến 1 frame (→)"
          className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-1 text-xs text-zinc-300 hover:border-zinc-600 disabled:opacity-30"
        >
          |▶
        </button>
      </div>

      {/* Scrubber with Scene Tick Markers & Handles Highlight */}
      <div className="relative flex flex-1 items-center py-1">
        {handlePct > 0 && (
          <>
            <div
              className="pointer-events-none absolute left-0 h-2 rounded-l bg-amber-500/25"
              style={{ width: `${handlePct}%` }}
              title="Handles đầu clip"
            />
            <div
              className="pointer-events-none absolute right-0 h-2 rounded-r bg-amber-500/25"
              style={{ width: `${handlePct}%` }}
              title="Handles cuối clip"
            />
          </>
        )}
        {tickPercents.map((pct, i) => (
          <div
            key={i}
            className="pointer-events-none absolute top-0.5 bottom-0.5 w-px bg-zinc-500/70"
            style={{ left: `${pct}%` }}
          />
        ))}
        <input
          type="range"
          min={0}
          max={Math.max(0, totalFrames - 1)}
          value={Math.min(frameIndex, Math.max(0, totalFrames - 1))}
          disabled={disabled}
          onChange={(e) => {
            setIsPlaying(false);
            setFrameIndex(Number(e.target.value));
          }}
          className="relative z-10 h-1.5 w-full cursor-pointer accent-amber-400"
        />
      </div>

      <span className="w-28 text-right font-mono text-xs text-zinc-300">
        {formatTime(frameIndex / fps)} / {formatTime(effectiveDurationSec)}
      </span>

      <button
        type="button"
        disabled={disabled}
        onClick={cycleCompare}
        title="So sánh Gốc / Chia đôi / Film Look (hoặc giữ phím \)"
        className={`rounded border px-2 py-1 text-xs font-medium transition disabled:opacity-30 ${
          compareMode === 'normal'
            ? 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600'
            : 'border-amber-400 bg-amber-500/20 text-amber-300'
        }`}
      >
        {compareMode === 'normal' ? 'So sánh' : compareMode === 'split' ? 'Chia đôi' : 'Ảnh gốc'}
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={onToggleFullscreen}
        title="Phóng to xem trước (Phím F)"
        className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 hover:border-amber-400 hover:text-amber-300 disabled:opacity-30"
      >
        ⛶
      </button>
    </div>
  );
});
