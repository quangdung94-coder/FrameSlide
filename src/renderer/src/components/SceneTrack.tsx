import { useEffect, useMemo, useState } from 'react';
import {
  getTransitionName,
  TRANSITION_PRESETS,
  type TransitionPreset,
} from '@engine/presets/transitions';
import { LAYOUT_LABELS } from '@engine/sceneBuilder';
import { getExportResolution } from '@engine/capabilities';
import { getLayoutRects } from '@engine/layoutGeometry';
import { resolveSlideDurations } from '@engine/timeline';
import { useAppStore } from '../store/useAppStore';
import { LAYOUT_LIMITS, useLayoutStore } from '../store/useLayoutStore';
import type { SceneLayoutId } from '@shared/types';

interface SceneTrackProps {
  disabled: boolean;
}


const TRANSITION_GROUPS: TransitionPreset['group'][] = [
  'Mềm & Cổ điển',
  'Ánh sáng & Phim',
  'Chuyển động',
  'Giấy & Khung',
  '3D Phối cảnh',
];

/**
 * Thin time bar under a scene card: shows the playhead while it is inside this scene,
 * and clicking/dragging on it jumps the playhead to that exact moment of the scene.
 */
function SceneTimeStrip({
  sceneId,
  startFrame,
  endFrame,
  disabled,
}: {
  sceneId: string;
  startFrame: number;
  endFrame: number;
  disabled: boolean;
}) {
  // Only re-renders when this scene's own playhead position changes.
  const fraction = useAppStore((s) =>
    s.frameIndex >= startFrame && s.frameIndex < endFrame
      ? (s.frameIndex - startFrame) / Math.max(1, endFrame - startFrame)
      : null
  );
  const seekToSceneFraction = useAppStore((s) => s.seekToSceneFraction);

  const seekFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    seekToSceneFraction(sceneId, (e.clientX - rect.left) / Math.max(1, rect.width));
  };

  return (
    <div
      role="slider"
      aria-label="Vị trí trong scene"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={fraction === null ? 0 : Math.round(fraction * 100)}
      title="Bấm hoặc kéo để nhảy playhead tới vị trí này trong scene"
      draggable={false}
      onClick={(e) => e.stopPropagation()}
      onDragStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onPointerDown={(e) => {
        if (disabled) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        seekFromPointer(e);
      }}
      onPointerMove={(e) => {
        if (disabled || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
        seekFromPointer(e);
      }}
      className={`relative mt-1 h-2.5 w-full overflow-hidden rounded-sm bg-zinc-800 ${
        disabled ? 'cursor-not-allowed' : 'cursor-ew-resize hover:bg-zinc-700'
      }`}
    >
      {fraction !== null && (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 left-0 bg-amber-500/35"
            style={{ width: `${fraction * 100}%` }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-amber-400"
            style={{ left: `calc(${fraction * 100}% - 1px)` }}
          />
        </>
      )}
    </div>
  );
}

export function SceneTrack({ disabled }: SceneTrackProps) {
  const slides = useAppStore((s) => s.slides);
  const scenes = useAppStore((s) => s.scenes);
  const activeSceneId = useAppStore((s) => s.activeSceneId);
  const activeSlotIndex = useAppStore((s) => s.activeSlotIndex);
  const selectedPhotoId = useAppStore((s) => s.selectedPhotoId);
  const renderParams = useAppStore((s) => s.renderParams);
  const fps = useAppStore((s) => s.fps);

  const selectSceneAndSeek = useAppStore((s) => s.selectSceneAndSeek);
  const addScene = useAppStore((s) => s.addScene);
  const duplicateScene = useAppStore((s) => s.duplicateScene);
  const removeScene = useAppStore((s) => s.removeScene);
  const moveScene = useAppStore((s) => s.moveScene);
  const reorderScene = useAppStore((s) => s.reorderScene);
  const randomizeSceneTransitions = useAppStore((s) => s.randomizeSceneTransitions);
  const setSceneLayout = useAppStore((s) => s.setSceneLayout);
  const setSceneDuration = useAppStore((s) => s.setSceneDuration);
  const setSceneTransition = useAppStore((s) => s.setSceneTransition);
  const assignPhotoToSlot = useAppStore((s) => s.assignPhotoToSlot);
  const swapSceneSlots = useAppStore((s) => s.swapSceneSlots);
  const autoFillScenes = useAppStore((s) => s.autoFillScenes);
  const clearAllSceneSlots = useAppStore((s) => s.clearAllSceneSlots);

  const sceneZoom = useLayoutStore((s) => s.sceneZoom);
  const setLayout = useLayoutStore((s) => s.setLayout);
  // Small zoom hides the layout dropdown to save height.
  const compactMode = sceneZoom < 0.8;
  const outRes = getExportResolution(renderParams.outputAspect);
  const canvasAspect = outRes.width / outRes.height;
  const layoutRects = useMemo(
    () => ({
      single: getLayoutRects('single', canvasAspect),
      diptych: getLayoutRects('diptych', canvasAspect),
      triptych: getLayoutRects('triptych', canvasAspect),
      mosaic4: getLayoutRects('mosaic4', canvasAspect),
    }),
    [canvasAspect]
  );
  // Mini frame keeps the real output shape and slot positions.
  // Card width grows with the zoom slider; the mini frame keeps the real output shape.
  const cardW = Math.round(232 * sceneZoom);
  const miniMaxW = cardW - 14;
  const miniMaxH = Math.round(120 * sceneZoom);
  const miniW = Math.min(miniMaxW, Math.round(miniMaxH * canvasAspect));

  const sceneFrameRanges = useMemo(() => {
    const durations = resolveSlideDurations(scenes.length, {
      durationMode: renderParams.durationMode,
      totalDurationSec: renderParams.totalDurationSec,
      defaultSlideDurationSec: renderParams.defaultSlideDurationSec,
      slideDurations: scenes.map((item) => item.durationSec),
      handlesSec: renderParams.handlesSec,
    });
    let startSec = 0;
    return scenes.map((_, idx) => {
      const range = {
        start: Math.round(startSec * fps),
        end: Math.round((startSec + durations[idx]) * fps),
      };
      startSec += durations[idx];
      return range;
    });
  }, [scenes, renderParams, fps]);

  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [dropSceneId, setDropSceneId] = useState<string | null>(null);
  const [openTransMenuSceneId, setOpenTransMenuSceneId] = useState<string | null>(null);

  useEffect(() => {
    if (!openTransMenuSceneId) return;
    const onGlobalClick = () => setOpenTransMenuSceneId(null);
    window.addEventListener('click', onGlobalClick);
    return () => window.removeEventListener('click', onGlobalClick);
  }, [openTransMenuSceneId]);

  const photoMap = useMemo(() => new Map(slides.map((p) => [p.id, p])), [slides]);

  const { totalSlots, filledSlots } = useMemo(() => {
    let total = 0;
    let filled = 0;
    for (const sc of scenes) {
      total += sc.slots.length;
      for (const pid of sc.slots) {
        if (pid && photoMap.has(pid)) filled++;
      }
    }
    return { totalSlots: total, filledSlots: filled };
  }, [scenes, photoMap]);

  return (
    <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2">
      {/* Scene Track Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-1.5 text-zinc-300">
          <span className="font-semibold text-amber-400">
            Dải Scene ({scenes.length} Scene)
          </span>
          <span className="text-zinc-600">•</span>
          <span className={filledSlots === totalSlots ? 'text-emerald-400' : 'text-amber-300'}>
            {filledSlots}/{totalSlots} ô
          </span>
          <button
            type="button"
            disabled={disabled || slides.length === 0}
            onClick={autoFillScenes}
            className="ml-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-200 hover:border-amber-400 disabled:opacity-40"
          >
            ⚡ Đổ ảnh
          </button>
          <button
            type="button"
            disabled={disabled || scenes.length < 2}
            onClick={() => randomizeSceneTransitions()}
            title="Trộn ngẫu nhiên 18 kiểu chuyển cảnh mượt (gồm cả 3D, Ctrl+Z để hoàn tác)"
            className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-200 hover:border-amber-400 disabled:opacity-40"
          >
            🎲 Trộn chuyển cảnh
          </button>
          <button
            type="button"
            disabled={disabled || scenes.length === 0}
            onClick={clearAllSceneSlots}
            className="rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
          >
            Trống ô
          </button>
          <label
            className="ml-1 flex items-center gap-1 text-[10px] text-zinc-400"
            title="Phóng to / thu nhỏ thẻ Scene"
          >
            <span>🔍</span>
            <input
              type="range"
              aria-label="Zoom thẻ scene"
              min={LAYOUT_LIMITS.sceneZoom[0]}
              max={LAYOUT_LIMITS.sceneZoom[1]}
              step={0.05}
              value={sceneZoom}
              onChange={(e) => setLayout('sceneZoom', Number(e.target.value))}
              className="h-1 w-20 cursor-pointer accent-amber-400"
            />
            <span className="w-8 font-mono text-zinc-500">{Math.round(sceneZoom * 100)}%</span>
          </label>
        </div>

        <div className="flex items-center gap-1 text-[10px]">
          <span className="text-zinc-500">Thêm:</span>
          {(['single', 'diptych', 'triptych', 'mosaic4'] as SceneLayoutId[]).map((lay) => (
            <button
              key={lay}
              type="button"
              disabled={disabled}
              onClick={() => addScene(lay)}
              className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-zinc-200 hover:border-amber-400 disabled:opacity-40"
            >
              + {lay === 'single' ? '1' : lay === 'diptych' ? '2' : lay === 'triptych' ? '3' : '4'}
            </button>
          ))}
        </div>
      </div>

      {/* Horizontal Scene Cards */}
      <div className="flex min-h-0 flex-1 items-start gap-1.5 overflow-auto pb-1">
        {scenes.map((sc, idx) => {
          const isActive = sc.id === activeSceneId;
          const isSceneDropHot = dropSceneId === sc.id;
          const isMenuOpen = openTransMenuSceneId === sc.id;

          return (
            <div key={sc.id} className="relative flex shrink-0 items-stretch gap-1.5">
              <div
                draggable={!disabled}
                onClick={() => selectSceneAndSeek(sc.id, 0)}
                onDragStart={(e) => {
                  if (disabled) return;
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData(
                    'application/x-frameslide-scene',
                    JSON.stringify({ kind: 'scene-card', sceneId: sc.id })
                  );
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes('application/x-frameslide-scene')) {
                    e.preventDefault();
                    if (dropSceneId !== sc.id) setDropSceneId(sc.id);
                  }
                }}
                onDragLeave={(e) => {
                  if (
                    !e.currentTarget.contains(e.relatedTarget as Node | null) &&
                    dropSceneId === sc.id
                  ) {
                    setDropSceneId(null);
                  }
                }}
                onDrop={(e) => {
                  const raw = e.dataTransfer.getData('application/x-frameslide-scene');
                  if (!raw) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setDropSceneId(null);
                  try {
                    const payload = JSON.parse(raw);
                    if (payload.kind === 'scene-card' && payload.sceneId) {
                      reorderScene(payload.sceneId, sc.id);
                    }
                  } catch {
                    // ignore malformed drop
                  }
                }}
                onDragEnd={() => {
                  setDropSceneId(null);
                  setDropTargetKey(null);
                }}
                style={{ width: cardW }}
                className={`flex shrink-0 cursor-pointer flex-col justify-between rounded-md border p-1.5 transition-colors ${
                  isSceneDropHot
                    ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400'
                    : isActive
                      ? 'border-amber-400 bg-zinc-800/90 shadow-md shadow-amber-500/10'
                      : 'border-zinc-800 bg-zinc-900/90 hover:border-zinc-700'
                }`}
              >
                {/* Card Header */}
                <div className="mb-1 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <span
                      className="cursor-grab text-[11px] leading-none text-zinc-500 hover:text-zinc-300"
                      title="Kéo thả thẻ Scene để đổi thứ tự"
                    >
                      ⋮⋮
                    </span>
                    <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-zinc-950">
                      S{idx + 1}
                    </span>
                    <input
                      type="number"
                      min={0.5}
                      max={20}
                      step={0.5}
                      value={sc.durationSec}
                      disabled={disabled}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setSceneDuration(sc.id, Number(e.target.value) || 3)}
                      className="w-10 rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5 text-center font-mono text-[10px] text-zinc-200"
                      title="Thời lượng Scene (giây)"
                    />
                    <span className="text-[10px] text-zinc-500">s</span>
                  </div>

                  <div className="flex items-center gap-0.5 text-[10px]">
                    <button
                      type="button"
                      disabled={disabled || idx === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveScene(sc.id, -1);
                      }}
                      className="rounded px-0.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-30"
                      title="Dịch trái"
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      disabled={disabled || idx === scenes.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveScene(sc.id, 1);
                      }}
                      className="rounded px-0.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-30"
                      title="Dịch phải"
                    >
                      ▶
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateScene(sc.id);
                      }}
                      className="rounded px-1 text-zinc-400 hover:bg-zinc-700 hover:text-amber-300 disabled:opacity-30"
                      title="Nhân bản Scene này"
                    >
                      ⧉
                    </button>
                    {scenes.length > 1 && (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeScene(sc.id);
                        }}
                        className="rounded px-1 text-zinc-400 hover:bg-red-500 hover:text-white disabled:opacity-30"
                        title="Xóa Scene"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Layout Selector (hidden in compact mode to save vertical space) */}
                {!compactMode && (
                  <select
                    value={sc.layout}
                    disabled={disabled}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setSceneLayout(sc.id, e.target.value as SceneLayoutId)}
                    className="mb-1.5 w-full rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-[10px] text-zinc-200"
                  >
                    {(Object.keys(LAYOUT_LABELS) as SceneLayoutId[]).map((lay) => (
                      <option key={lay} value={lay}>
                        {LAYOUT_LABELS[lay]}
                      </option>
                    ))}
                  </select>
                )}

                {/* Mini frame: each slot drawn where it really sits in the video */}
                <div
                  className="relative mx-auto overflow-hidden rounded border border-zinc-800 bg-zinc-950"
                  style={{ width: miniW, height: Math.round(miniW / canvasAspect) }}
                  title={`${LAYOUT_LABELS[sc.layout]}: kéo ô này sang ô khác để đổi chỗ ảnh`}
                >
                  {sc.slots.map((pid, slotIdx) => {
                    const photo = pid ? photoMap.get(pid) : undefined;
                    const slotKey = `${sc.id}:${slotIdx}`;
                    const isDropHot = dropTargetKey === slotKey;
                    const isFocusedSlot = isActive && activeSlotIndex === slotIdx && Boolean(photo);
                    const rect = layoutRects[sc.layout][slotIdx] ?? layoutRects.single[0];
                    const isMulti = sc.slots.length > 1;

                    return (
                      <div
                        key={slotKey}
                        draggable={!disabled && Boolean(photo)}
                        title={
                          photo
                            ? `Ô ${slotIdx + 1}: ${photo.name} — Click chọn chỉnh Focal Point/Xoay/Sáng, hoặc kéo đổi ô`
                            : `Ô ${slotIdx + 1} trống — Kéo ảnh vào hoặc click ảnh bên Khay rồi click vào đây`
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedPhotoId && !disabled) {
                            assignPhotoToSlot(sc.id, slotIdx, selectedPhotoId);
                          } else {
                            selectSceneAndSeek(sc.id, slotIdx);
                          }
                        }}
                        onDragStart={(e) => {
                          if (!pid) return;
                          e.stopPropagation();
                          e.dataTransfer.setData(
                            'application/x-frameslide',
                            JSON.stringify({
                              kind: 'scene-slot',
                              sourceSid: sc.id,
                              sourceIdx: slotIdx,
                              photoId: pid,
                            })
                          );
                        }}
                        onDragOver={(e) => {
                          if (e.dataTransfer.types.includes('application/x-frameslide')) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (dropTargetKey !== slotKey) setDropTargetKey(slotKey);
                          }
                        }}
                        onDragLeave={() => {
                          if (dropTargetKey === slotKey) setDropTargetKey(null);
                        }}
                        onDrop={(e) => {
                          const raw = e.dataTransfer.getData('application/x-frameslide');
                          if (!raw) return;
                          e.preventDefault();
                          e.stopPropagation();
                          setDropTargetKey(null);
                          try {
                            const payload = JSON.parse(raw);
                            if (payload.kind === 'bin-photo') {
                              assignPhotoToSlot(sc.id, slotIdx, payload.photoId);
                            } else if (payload.kind === 'scene-slot') {
                              swapSceneSlots(payload.sourceSid, payload.sourceIdx, sc.id, slotIdx);
                            }
                          } catch {
                            // ignore malformed drop
                          }
                        }}
                        style={{
                          left: `${rect.x * 100}%`,
                          top: `${rect.y * 100}%`,
                          width: `${rect.w * 100}%`,
                          height: `${rect.h * 100}%`,
                        }}
                        className={`group absolute flex items-center justify-center overflow-hidden border transition ${
                          isMulti ? 'rounded-sm' : ''
                        } ${
                          isDropHot
                            ? 'border-amber-400 bg-amber-500/20'
                            : isFocusedSlot
                              ? 'border-amber-400 ring-1 ring-amber-400 bg-zinc-900 cursor-grab'
                              : photo
                                ? 'border-zinc-700 bg-zinc-900 cursor-grab hover:border-zinc-500'
                                : 'border-dashed border-zinc-700 bg-zinc-900/50 text-[10px] text-zinc-500 hover:border-amber-400 hover:text-amber-300'
                        }`}
                      >
                        {photo ? (
                          <>
                            <img
                              src={photo.thumbUrl}
                              alt={photo.name}
                              draggable={false}
                              style={
                                photo.rotationDeg
                                  ? { transform: `rotate(${photo.rotationDeg}deg)` }
                                  : undefined
                              }
                              className="h-full w-full object-cover"
                            />
                            <span
                              className={`absolute top-0.5 left-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[9px] font-bold leading-none ${
                                isFocusedSlot
                                  ? 'bg-amber-400 text-zinc-950'
                                  : 'bg-black/80 text-zinc-100'
                              }`}
                            >
                              {slotIdx + 1}
                            </span>
                            {!disabled && (
                              <button
                                type="button"
                                title="Gỡ ảnh khỏi ô"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  assignPhotoToSlot(sc.id, slotIdx, null);
                                }}
                                className="absolute top-0.5 right-0.5 hidden h-3.5 w-3.5 items-center justify-center rounded bg-black/80 text-[9px] text-white hover:bg-red-500 group-hover:flex"
                              >
                                ×
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-[10px] font-semibold">+{slotIdx + 1}</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <SceneTimeStrip
                  sceneId={sc.id}
                  startFrame={sceneFrameRanges[idx]?.start ?? 0}
                  endFrame={sceneFrameRanges[idx]?.end ?? 0}
                  disabled={disabled}
                />
              </div>

              {/* Transition Connector Pill + Grouped Popover Menu */}
              {idx < scenes.length - 1 && (
                <div className="relative flex items-center">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenTransMenuSceneId(isMenuOpen ? null : sc.id);
                    }}
                    title={`Chọn chuyển cảnh từ Scene ${idx + 1} → Scene ${idx + 2}`}
                    className={`rounded-full border px-2 py-1 text-[10px] transition disabled:opacity-40 ${
                      isMenuOpen
                        ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                        : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-amber-400 hover:text-amber-300'
                    }`}
                  >
                    ⇄ {getTransitionName(sc.transitionType)}
                  </button>

                  {isMenuOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="fixed bottom-44 z-50 max-h-80 w-60 overflow-y-auto rounded-lg border border-zinc-700 bg-[#18181f] p-2 shadow-2xl"
                    >
                      <div className="mb-1.5 flex items-center justify-between border-b border-zinc-800 pb-1 text-[10px] font-semibold text-amber-400">
                        <span>
                          Chuyển cảnh S{idx + 1} → S{idx + 2} (20 kiểu)
                        </span>
                        <button
                          type="button"
                          onClick={() => setOpenTransMenuSceneId(null)}
                          className="text-zinc-400 hover:text-white"
                        >
                          ×
                        </button>
                      </div>
                      {TRANSITION_GROUPS.map((groupName) => {
                        const items = TRANSITION_PRESETS.filter((t) => t.group === groupName);
                        if (items.length === 0) return null;
                        return (
                          <div key={groupName} className="mb-2 last:mb-0">
                            <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                              {groupName}
                            </div>
                            <div className="grid grid-cols-1 gap-0.5">
                              {items.map((tr) => {
                                const active = sc.transitionType === tr.id;
                                return (
                                  <button
                                    key={tr.id}
                                    type="button"
                                    onClick={() => {
                                      setSceneTransition(sc.id, tr.id);
                                      setOpenTransMenuSceneId(null);
                                    }}
                                    className={`flex items-center justify-between rounded px-2 py-1 text-left text-[11px] transition ${
                                      active
                                        ? 'bg-amber-500 font-semibold text-zinc-950'
                                        : 'text-zinc-200 hover:bg-zinc-800'
                                    }`}
                                  >
                                    <span>{tr.name}</span>
                                    {tr.group === '3D Phối cảnh' && (
                                      <span
                                        className={`rounded px-1 text-[9px] ${
                                          active
                                            ? 'bg-zinc-950/20 text-zinc-950'
                                            : 'bg-amber-500/20 text-amber-300'
                                        }`}
                                      >
                                        3D
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
