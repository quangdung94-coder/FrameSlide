import { memo, useMemo, useState, type ReactNode } from 'react';
import { resolveSlideDurations } from '@engine/timeline';
import { applyShuttleKey, formatPlaybackRate, PLAYBACK_RATES } from '@engine/playback';
import { formatSecondsClock, formatTimecode, rulerMarks, scenePositionAt } from '@engine/timecode';
import { marksToRange } from '@engine/frameRange';
import { useAppStore } from '../store/useAppStore';
import type { CompareMode } from '@shared/types';

interface PlaybackBarProps {
  totalFrames: number;
  effectiveDurationSec: number;
  disabled: boolean;
  onToggleFullscreen: () => void;
}


/** Transport icons as inline SVG, so they look the same on every Windows font (no emoji). */
const ICON_PATHS = {
  start: 'M1.5 3h2v10h-2zM9 3v10L4 8zM15 3v10l-5-5z',
  end: 'M12.5 3h2v10h-2zM7 3v10l5-5zM1 3v10l5-5z',
  stepBack: 'M10 3v10L3 8zM11 3h2v10h-2z',
  stepFwd: 'M6 3v10l7-5zM3 3h2v10H3z',
  rewind: 'M8 3v10L1 8zM15 3v10L8 8z',
  ffwd: 'M8 3v10l7-5zM1 3v10l7-5z',
  play: 'M5 2.5v11L14 8z',
  pause: 'M4 3h3v10H4zM9 3h3v10H9z',
} as const;

function Icon({ name, size = 14 }: { name: keyof typeof ICON_PATHS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

function LoopIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M3 7a4 4 0 0 1 4-4h5M10 1l2 2-2 2M13 9a4 4 0 0 1-4 4H4M6 15l-2-2 2-2" />
    </svg>
  );
}

/** Square 32px transport button with a tooltip. */
function TransportButton({
  title,
  onClick,
  disabled,
  active,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center rounded-md border px-1.5 text-xs transition disabled:opacity-30 ${
        active
          ? 'border-amber-400 bg-amber-500/15 text-amber-300'
          : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Transport bar (Đợt 5.1c): transport buttons with a large play button, speed and loop,
 * a one-line timecode with the current scene, and a seconds ruler over the scrubber
 * (scene boundaries and Handles shaded). Subscribed to the high-frequency `frameIndex`.
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
  const playbackRate = useAppStore((s) => s.playbackRate);
  const playDirection = useAppStore((s) => s.playDirection);
  const loopPlayback = useAppStore((s) => s.loopPlayback);
  const markIn = useAppStore((s) => s.markIn);
  const markOut = useAppStore((s) => s.markOut);
  const setMarkIn = useAppStore((s) => s.setMarkIn);
  const setMarkOut = useAppStore((s) => s.setMarkOut);
  const clearMarks = useAppStore((s) => s.clearMarks);

  const setIsPlaying = useAppStore((s) => s.setIsPlaying);
  const setTransport = useAppStore((s) => s.setTransport);
  const setPlaybackRate = useAppStore((s) => s.setPlaybackRate);
  const setLoopPlayback = useAppStore((s) => s.setLoopPlayback);
  const setFrameIndex = useAppStore((s) => s.setFrameIndex);
  const setCompareMode = useAppStore((s) => s.setCompareMode);

  /** Timecode (MM:SS:FF) or seconds (MM:SS.s); click the clock to switch. */
  const [showFrames, setShowFrames] = useState(true);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);

  const lastFrame = Math.max(0, totalFrames - 1);
  const shownFrame = Math.min(frameIndex, lastFrame);
  const timeSec = shownFrame / fps;

  const durations = useMemo(() => {
    if (scenes.length === 0) return [] as number[];
    return resolveSlideDurations(scenes.length, {
      durationMode: renderParams.durationMode,
      totalDurationSec: renderParams.totalDurationSec,
      defaultSlideDurationSec: renderParams.defaultSlideDurationSec,
      slideDurations: scenes.map((sc) => sc.durationSec),
      handlesSec: renderParams.handlesSec,
    });
  }, [scenes, renderParams]);

  // Scene boundary ticks, scene segments, Handles zones and ruler labels (percent 0..100 of the clip).
  const { tickPercents, sceneSegments, handlePct, marks } = useMemo(() => {
    if (durations.length === 0 || effectiveDurationSec <= 0) {
      return {
        tickPercents: [] as number[],
        sceneSegments: [] as { index: number; startPct: number; widthPct: number }[],
        handlePct: 0,
        marks: [] as number[],
      };
    }
    const ticks: number[] = [];
    const segs: { index: number; startPct: number; widthPct: number }[] = [];
    let acc = 0;
    for (let i = 0; i < durations.length; i++) {
      const d = durations[i];
      segs.push({
        index: i,
        startPct: (acc / effectiveDurationSec) * 100,
        widthPct: (d / effectiveDurationSec) * 100,
      });
      acc += d;
      if (i < durations.length - 1) ticks.push((acc / effectiveDurationSec) * 100);
    }
    const hPct =
      renderParams.handlesSec > 0 ? Math.min(25, (renderParams.handlesSec / effectiveDurationSec) * 100) : 0;
    return { tickPercents: ticks, sceneSegments: segs, handlePct: hPct, marks: rulerMarks(effectiveDurationSec, 12) };
  }, [durations, renderParams.handlesSec, effectiveDurationSec]);

  const scenePos = scenePositionAt(timeSec, durations);
  const hoverSec = hoverRatio !== null ? hoverRatio * effectiveDurationSec : null;
  const hoverScenePos = hoverSec !== null ? scenePositionAt(hoverSec, durations) : null;
  const marked = marksToRange(markIn, markOut, totalFrames);
  const framePct = (f: number) => `${(f / Math.max(1, lastFrame)) * 100}%`;

  const seek = (frame: number) => {
    setIsPlaying(false);
    setFrameIndex(Math.max(0, Math.min(lastFrame, frame)));
  };
  const shuttle = (key: 'j' | 'l') =>
    setTransport(applyShuttleKey({ isPlaying, direction: playDirection, rate: playbackRate }, key));
  const togglePlay = () =>
    isPlaying ? setIsPlaying(false) : setTransport({ isPlaying: true, direction: 1, rate: playbackRate });

  const cycleCompare = () => {
    const order: CompareMode[] = ['normal', 'split', 'before'];
    const next = order[(order.indexOf(compareMode) + 1) % order.length];
    setCompareMode(next);
  };

  const reverseActive = isPlaying && playDirection === -1;
  const forwardShuttle = isPlaying && playDirection === 1 && playbackRate > 1;
  const pct = (sec: number) => `${(sec / Math.max(1e-6, effectiveDurationSec)) * 100}%`;

  return (
    <div className="flex flex-col gap-1">
      {/* Wraps onto two lines on narrow windows instead of pushing controls off-screen. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {/* Transport */}
        <div className="flex items-center gap-1">
          <TransportButton title="Về đầu clip (Home)" disabled={disabled} onClick={() => seek(0)}>
            <Icon name="start" />
          </TransportButton>
          <TransportButton title="Lùi 1 frame (← hoặc giữ K + J)" disabled={disabled} onClick={() => seek(shownFrame - 1)}>
            <Icon name="stepBack" />
          </TransportButton>
          <TransportButton
            title="Phát lùi (J), bấm lại để nhanh 2× → 4×"
            disabled={disabled}
            active={reverseActive}
            onClick={() => shuttle('j')}
          >
            <Icon name="rewind" />
            {reverseActive && <span className="ml-0.5 text-2xs">{formatPlaybackRate(playbackRate)}</span>}
          </TransportButton>
          <button
            type="button"
            onClick={togglePlay}
            disabled={disabled}
            title={isPlaying ? 'Tạm dừng (Space / K)' : 'Phát (Space)'}
            aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
            className="mx-1 flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-base text-zinc-950 shadow hover:bg-amber-400 disabled:opacity-40"
          >
            <Icon name={isPlaying ? 'pause' : 'play'} size={16} />
          </button>
          <TransportButton
            title="Phát tới nhanh (L), bấm lại để 2× → 4×"
            disabled={disabled}
            active={forwardShuttle}
            onClick={() => shuttle('l')}
          >
            {forwardShuttle && <span className="mr-0.5 text-2xs">{formatPlaybackRate(playbackRate)}</span>}
            <Icon name="ffwd" />
          </TransportButton>
          <TransportButton title="Tiến 1 frame (→ hoặc giữ K + L)" disabled={disabled} onClick={() => seek(shownFrame + 1)}>
            <Icon name="stepFwd" />
          </TransportButton>
          <TransportButton title="Về cuối clip (End)" disabled={disabled} onClick={() => seek(lastFrame)}>
            <Icon name="end" />
          </TransportButton>
        </div>

        <div className="flex items-center gap-1">
          <select
            value={String(playbackRate)}
            disabled={disabled}
            onChange={(e) => setPlaybackRate(Number(e.target.value))}
            title="Tốc độ xem trước (J / L để phát lùi / tới nhanh hơn). Không ảnh hưởng file xuất."
            aria-label="Tốc độ xem trước"
            className="h-8 rounded-md border border-zinc-700 bg-zinc-900 px-1.5 text-xs text-zinc-200 disabled:opacity-30"
          >
            {PLAYBACK_RATES.map((r) => (
              <option key={r} value={String(r)}>
                {formatPlaybackRate(r)}
              </option>
            ))}
          </select>
          <TransportButton
            title={loopPlayback ? 'Đang lặp lại khi hết clip (bấm để tắt)' : 'Phát hết clip thì dừng (bấm để lặp lại)'}
            disabled={disabled}
            active={loopPlayback}
            onClick={() => setLoopPlayback(!loopPlayback)}
          >
            <LoopIcon />
          </TransportButton>
        </div>

        {/* In / Out */}
        <div className="flex items-center gap-1">
          <TransportButton
            title="Đặt điểm vào (In) tại playhead (phím I)"
            disabled={disabled}
            active={markIn !== null}
            onClick={() => setMarkIn(shownFrame)}
          >
            <span className="font-semibold">In</span>
          </TransportButton>
          <TransportButton
            title="Đặt điểm ra (Out) tại playhead (phím O)"
            disabled={disabled}
            active={markOut !== null}
            onClick={() => setMarkOut(shownFrame)}
          >
            <span className="font-semibold">Out</span>
          </TransportButton>
          {marked && (
            <TransportButton title="Xóa In / Out (Alt + X)" disabled={disabled} onClick={clearMarks}>
              ✕
            </TransportButton>
          )}
        </div>

        {/* Clock: one line, current big + total small; scene under the playhead below. */}
        <button
          type="button"
          onClick={() => setShowFrames((v) => !v)}
          title="Bấm để đổi giữa phút:giây:frame và phút:giây"
          className="ml-auto flex flex-col items-end rounded px-1 leading-tight hover:bg-zinc-800/60"
        >
          <span className="whitespace-nowrap font-mono">
            <span className="text-base text-zinc-100">
              {showFrames ? formatTimecode(shownFrame, fps) : formatSecondsClock(timeSec)}
            </span>
            <span className="ml-1.5 text-xs text-zinc-500">
              / {showFrames ? formatTimecode(totalFrames, fps) : formatSecondsClock(effectiveDurationSec)}
            </span>
          </span>
          <span className="whitespace-nowrap text-2xs text-zinc-400">
            {marked && (
              <span className="mr-1.5 text-amber-300">
                In–Out {formatTimecode(marked.start, fps)}–{formatTimecode(marked.end - 1, fps)} ·
              </span>
            )}
            {scenePos
              ? `Scene ${scenePos.index + 1}/${durations.length} · ${scenePos.offsetSec.toFixed(1)} / ${scenePos.durationSec.toFixed(1)}s`
              : 'Chưa có scene'}
          </span>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={disabled}
            onClick={cycleCompare}
            title="So sánh Gốc / Chia đôi / Film Look (hoặc giữ phím \)"
            className={`h-8 whitespace-nowrap rounded-md border px-2 text-xs font-medium transition disabled:opacity-30 ${
              compareMode === 'normal'
                ? 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500'
                : 'border-amber-400 bg-amber-500/20 text-amber-300'
            }`}
          >
            {compareMode === 'normal' ? 'So sánh' : compareMode === 'split' ? 'Chia đôi' : 'Ảnh gốc'}
          </button>
          <TransportButton title="Phóng to xem trước (F)" disabled={disabled} onClick={onToggleFullscreen}>
            ⛶
          </TransportButton>
        </div>
      </div>

      {/* Ruler (seconds) + arrow playhead + scrubber with scene labels, ticks and Handles zones. */}
      <div className="relative mx-[7px]">
        <div className="relative h-3.5 select-none">
          {marks.map((t) => (
            <span
              key={t}
              className="absolute top-0 -translate-x-1/2 font-mono text-2xs leading-none text-zinc-500"
              style={{ left: pct(t) }}
            >
              {t}s
            </span>
          ))}
        </div>
        <div
          className="relative flex h-6 items-center"
          onPointerMove={(e) => {
            if (disabled) return;
            const r = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width)));
            setHoverRatio(ratio);
          }}
          onPointerLeave={() => setHoverRatio(null)}
        >
          {/* Track background + per-scene labels (S1, S2...) */}
          <div className="pointer-events-none absolute inset-x-0 top-1.5 bottom-1 overflow-hidden rounded bg-zinc-800/90">
            {sceneSegments.map((seg) => (
              <div
                key={seg.index}
                style={{ left: `${seg.startPct}%`, width: `${seg.widthPct}%` }}
                className={`absolute inset-y-0 flex items-center justify-center overflow-hidden ${
                  seg.index % 2 === 1 ? 'bg-zinc-900/45' : ''
                }`}
              >
                {seg.widthPct >= 4.2 && (
                  <span className="truncate px-0.5 font-mono text-2xs leading-none text-zinc-500">
                    S{seg.index + 1}
                  </span>
                )}
              </div>
            ))}
          </div>

          {handlePct > 0 && (
            <>
              <div
                className="pointer-events-none absolute top-1.5 bottom-1 left-0 rounded-l bg-amber-500/25"
                style={{ width: `${handlePct}%` }}
                title="Handles đầu clip"
              />
              <div
                className="pointer-events-none absolute top-1.5 bottom-1 right-0 rounded-r bg-amber-500/25"
                style={{ width: `${handlePct}%` }}
                title="Handles cuối clip"
              />
            </>
          )}
          {marked && (
            <div
              className="pointer-events-none absolute top-1 bottom-0.5 rounded-sm border-x-2 border-amber-400 bg-amber-500/30"
              style={{ left: framePct(marked.start), width: `calc(${framePct(marked.end - 1)} - ${framePct(marked.start)})` }}
              title="Đoạn In / Out"
            />
          )}
          {marks.map((t) => (
            <div
              key={`m${t}`}
              className="pointer-events-none absolute top-0 h-1.5 w-px bg-zinc-600"
              style={{ left: pct(t) }}
            />
          ))}
          {tickPercents.map((p, i) => (
            <div
              key={i}
              className="pointer-events-none absolute top-1.5 bottom-1 w-px bg-zinc-400/70"
              style={{ left: `${p}%` }}
            />
          ))}

          {/* Hover guide tooltip: shows which scene the cursor is pointing to */}
          {!isScrubbing && hoverRatio !== null && hoverScenePos && hoverSec !== null && (
            <div
              className="pointer-events-none absolute -top-6 z-20 -translate-x-1/2 whitespace-nowrap rounded border border-zinc-700 bg-zinc-950/95 px-1.5 py-0.5 font-mono text-2xs text-zinc-200 shadow"
              style={{ left: `${hoverRatio * 100}%` }}
            >
              S{hoverScenePos.index + 1} • {formatSecondsClock(hoverSec)}
            </div>
          )}

          {/* Arrow Playhead (▼ + vertical line) */}
          {!disabled && (
            <div
              className="pointer-events-none absolute inset-y-0 z-20 -translate-x-1/2"
              style={{ left: framePct(shownFrame) }}
            >
              {isScrubbing && scenePos && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-amber-400 px-1.5 py-0.5 font-mono text-2xs font-bold text-zinc-950 shadow">
                  S{scenePos.index + 1} • {formatSecondsClock(timeSec)}
                </div>
              )}
              <svg
                width="12"
                height="9"
                viewBox="0 0 12 9"
                className="-mt-0.5 block text-amber-400 drop-shadow"
                aria-hidden="true"
              >
                <path d="M1 0h10L6 8z" fill="currentColor" />
              </svg>
              <div className="mx-auto h-full w-0.5 -mt-0.5 bg-amber-400 shadow" />
            </div>
          )}

          <input
            type="range"
            min={0}
            max={lastFrame}
            value={shownFrame}
            disabled={disabled}
            aria-label="Thanh tua"
            onPointerDown={() => setIsScrubbing(true)}
            onChange={(e) => {
              setIsPlaying(false);
              setFrameIndex(Number(e.target.value));
            }}
            // Hand the keyboard back after a drag so ← → and the other shortcuts work right away.
            onPointerUp={(e) => {
              setIsScrubbing(false);
              e.currentTarget.blur();
            }}
            onPointerCancel={() => setIsScrubbing(false)}
            className="relative z-10 -mx-[7px] h-full w-[calc(100%+14px)] cursor-pointer opacity-0"
          />
        </div>
      </div>
    </div>
  );
});
