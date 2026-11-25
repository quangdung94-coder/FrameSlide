import { useEffect, useMemo, useRef, useState } from 'react';
import { fitSceneZoom, wheelZoom } from './sceneTrackFit';
import { AUTO_MOTION_MODES } from '@engine/autoMotion';
import {
  getTransitionName,
  TRANSITION_PRESETS,
  type TransitionPreset,
} from '@engine/presets/transitions';
import { LAYOUT_LABELS } from '@engine/sceneBuilder';
import { getExportResolution } from '@engine/capabilities';
import { getLayoutRects } from '@engine/layoutGeometry';
import { backgroundCss, resolveSceneBackground } from '@engine/background';
import { resolveSlideDurations } from '@engine/timeline';
import { SCENE_SETTING_PARTS } from '@engine/sceneSettings';
import { useAppStore } from '../store/useAppStore';
import { useContextMenu, type MenuItem } from './ContextMenu';
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

/** Card width and mini frame height at zoom 1.0. */
const CARD_W_PER_ZOOM = 232;
const MINI_H_PER_ZOOM = 120;
const MIN_CARD_W = 156;

export function SceneTrack({ disabled }: SceneTrackProps) {
  const slides = useAppStore((s) => s.slides);
  const scenes = useAppStore((s) => s.scenes);
  const activeSceneId = useAppStore((s) => s.activeSceneId);
  const activeSlotIndex = useAppStore((s) => s.activeSlotIndex);
  const selectedPhotoId = useAppStore((s) => s.selectedPhotoId);
  const renderParams = useAppStore((s) => s.renderParams);
  const fps = useAppStore((s) => s.fps);

  const selectSceneAndSeek = useAppStore((s) => s.selectSceneAndSeek);
  const setInspectorScope = useAppStore((s) => s.setInspectorScope);
  const addScene = useAppStore((s) => s.addScene);
  const insertSceneAt = useAppStore((s) => s.insertSceneAt);
  const rotatePhoto90 = useAppStore((s) => s.rotatePhoto90);
  const copySceneSettings = useAppStore((s) => s.copySceneSettings);
  const pasteSceneSettings = useAppStore((s) => s.pasteSceneSettings);
  const hasClipboard = useAppStore((s) => s.sceneClipboard !== null);
  const duplicateScene = useAppStore((s) => s.duplicateScene);
  const removeScene = useAppStore((s) => s.removeScene);
  const removeScenes = useAppStore((s) => s.removeScenes);
  const clickScene = useAppStore((s) => s.clickScene);
  const clearSceneSelection = useAppStore((s) => s.clearSceneSelection);
  const rawSelectedIds = useAppStore((s) => s.selectedSceneIds);
  // Selection can hold ids of scenes removed by undo etc.: keep only live ones.
  const selectedIds = useMemo(() => {
    const keep = new Set(rawSelectedIds);
    return scenes.filter((sc) => keep.has(sc.id)).map((sc) => sc.id);
  }, [rawSelectedIds, scenes]);
  const multiSelected = selectedIds.length > 1;
  const moveScene = useAppStore((s) => s.moveScene);
  const reorderScene = useAppStore((s) => s.reorderScene);
  const randomizeSceneTransitions = useAppStore((s) => s.randomizeSceneTransitions);
  const applyAutoMotion = useAppStore((s) => s.applyAutoMotion);
  const setMarkRange = useAppStore((s) => s.setMarkRange);
  const clearAutoMotion = useAppStore((s) => s.clearAutoMotion);
  const autoMotionCount = scenes.filter((sc) => sc.motionAuto).length;
  const setSceneLayout = useAppStore((s) => s.setSceneLayout);
  const setSceneDuration = useAppStore((s) => s.setSceneDuration);
  const setSceneTransition = useAppStore((s) => s.setSceneTransition);
  const assignPhotoToSlot = useAppStore((s) => s.assignPhotoToSlot);
  const swapSceneSlots = useAppStore((s) => s.swapSceneSlots);
  const autoFillScenes = useAppStore((s) => s.autoFillScenes);
  const clearAllSceneSlots = useAppStore((s) => s.clearAllSceneSlots);

  const { menu, openAt } = useContextMenu();

  const sceneZoom = useLayoutStore((s) => s.sceneZoom);
  const setLayout = useLayoutStore((s) => s.setLayout);
  const sceneTrackMode = useLayoutStore((s) => s.sceneTrackMode);
  const setSceneTrackMode = useLayoutStore((s) => s.setSceneTrackMode);
  const gridMode = sceneTrackMode === 'grid';
  const stripRef = useRef<HTMLDivElement | null>(null);

  // Ctrl + wheel zooms the cards (like Premiere). In row mode a plain wheel scrolls sideways.
  // Native listener: React's wheel handler is passive and cannot stop Electron's page zoom.
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const st = useLayoutStore.getState();
        st.setLayout('sceneZoom', wheelZoom(st.sceneZoom, e.deltaY, ...LAYOUT_LIMITS.sceneZoom));
        return;
      }
      if (useLayoutStore.getState().sceneTrackMode === 'row' && e.deltaX === 0 && el.scrollWidth > el.clientWidth) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  /** "Vừa khung": switch to grid and pick the largest zoom that shows every scene. */
  const fitAllScenes = () => {
    const el = stripRef.current;
    const item = el?.firstElementChild as HTMLElement | null;
    if (!el || !item) return;
    setSceneTrackMode('grid');
    const r = item.getBoundingClientRect();
    setLayout(
      'sceneZoom',
      fitSceneZoom({
        sceneCount: scenes.length,
        areaWidth: el.clientWidth,
        areaHeight: el.clientHeight,
        itemWidth: r.width,
        itemHeight: r.height,
        measuredZoom: sceneZoom,
        cardWidthPerZoom: CARD_W_PER_ZOOM,
        miniHeightPerZoom: MINI_H_PER_ZOOM,
        gap: 6,
        minCardWidth: MIN_CARD_W,
        minZoom: LAYOUT_LIMITS.sceneZoom[0],
        maxZoom: LAYOUT_LIMITS.sceneZoom[1],
      })
    );
  };
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
  // Never narrower than the header row (badge, duration, ⋯) so nothing sticks out at small zoom.
  const cardW = Math.max(MIN_CARD_W, Math.round(CARD_W_PER_ZOOM * sceneZoom));
  const miniMaxW = cardW - 14;
  const miniMaxH = Math.round(MINI_H_PER_ZOOM * sceneZoom);
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

  // "T" shortcut: open the transition picker of the selected scene (not possible on the last scene).
  useEffect(() => {
    const onOpen = (e: Event) => {
      const sceneId = (e as CustomEvent<{ sceneId: string }>).detail?.sceneId;
      const st = useAppStore.getState();
      const idx = st.scenes.findIndex((sc) => sc.id === sceneId);
      if (idx >= 0 && idx < st.scenes.length - 1) setOpenTransMenuSceneId(sceneId);
    };
    window.addEventListener('frameslide:open-transition', onOpen);
    return () => window.removeEventListener('frameslide:open-transition', onOpen);
  }, []);

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

  const buildSceneMenu = (sceneId: string): MenuItem[] => {
    const idx = scenes.findIndex((sc) => sc.id === sceneId);
    const sc = scenes[idx];
    if (!sc) return [];
    const layoutNames: Record<SceneLayoutId, string> = {
      single: '1 ảnh',
      diptych: '2 ảnh',
      triptych: '3 ảnh',
      mosaic4: '4 ảnh',
    };
    return [
      { label: 'Nhân bản scene', onClick: () => duplicateScene(sceneId), disabled },
      { label: 'Dịch sang trái', onClick: () => moveScene(sceneId, -1), disabled: disabled || idx === 0 },
      {
        label: 'Dịch sang phải',
        onClick: () => moveScene(sceneId, 1),
        disabled: disabled || idx === scenes.length - 1,
      },
      {
        label: 'Đặt In / Out theo scene này',
        onClick: () => {
          const r = sceneFrameRanges[idx];
          if (r) setMarkRange(r.start, r.end);
        },
      },
      { separator: true, label: '' },
      { label: 'Sao chép thiết lập scene', hint: 'Ctrl+Shift+C', onClick: () => copySceneSettings(sceneId) },
      {
        label: 'Dán thiết lập (tất cả)',
        hint: 'Ctrl+Shift+V',
        onClick: () => pasteSceneSettings(sceneId, SCENE_SETTING_PARTS.map((p) => p.id)),
        disabled: disabled || !hasClipboard,
      },
      ...SCENE_SETTING_PARTS.map((part) => ({
        label: `Dán chỉ: ${part.label}`,
        onClick: () => pasteSceneSettings(sceneId, [part.id]),
        disabled: disabled || !hasClipboard,
      })),
      { separator: true, label: '' },
      { label: 'Chèn scene trống phía trước', onClick: () => insertSceneAt('single', idx), disabled },
      { label: 'Chèn scene trống phía sau', onClick: () => insertSceneAt('single', idx + 1), disabled },
      { separator: true, label: '' },
      ...(Object.keys(layoutNames) as SceneLayoutId[]).map((lay) => ({
        label: `Bố cục: ${layoutNames[lay]}`,
        checked: sc.layout === lay,
        onClick: () => setSceneLayout(sceneId, lay),
        disabled,
      })),
      ...(idx < scenes.length - 1
        ? [
            { separator: true, label: '' },
            {
              label: 'Đặt chuyển cảnh sang scene sau…',
              // Deferred so the click that picked this item doesn't immediately close the popover.
              onClick: () => setTimeout(() => setOpenTransMenuSceneId(sceneId), 0),
              disabled,
            },
          ]
        : []),
      { separator: true, label: '' },
      ...(multiSelected && selectedIds.includes(sceneId)
        ? [
            {
              label: `Xóa ${selectedIds.length} scene đã chọn`,
              hint: 'Delete',
              danger: true,
              onClick: () => removeScenes(selectedIds),
              disabled,
            },
          ]
        : []),
      {
        label: 'Xóa scene',
        danger: true,
        onClick: () => removeScene(sceneId),
        disabled: disabled || scenes.length <= 1,
      },
    ];
  };

  const buildSlotMenu = (sceneId: string, slotIdx: number): MenuItem[] => {
    const sc = scenes.find((x) => x.id === sceneId);
    const pid = sc?.slots[slotIdx] ?? null;
    const photo = pid ? photoMap.get(pid) : undefined;
    return [
      {
        label: 'Dùng ảnh đang chọn ở khay',
        onClick: () => selectedPhotoId && assignPhotoToSlot(sceneId, slotIdx, selectedPhotoId),
        disabled: disabled || !selectedPhotoId,
      },
      {
        label: 'Đặt tâm điểm (Focal Point)',
        onClick: () => {
          selectSceneAndSeek(sceneId, slotIdx);
          window.dispatchEvent(new CustomEvent('frameslide:focal-pick'));
        },
        disabled: disabled || !photo,
      },
      {
        label: 'Xoay 90°',
        onClick: () => photo && rotatePhoto90(photo.id),
        disabled: disabled || !photo,
      },
      { separator: true, label: '' },
      {
        label: 'Gỡ ảnh khỏi ô',
        danger: true,
        onClick: () => assignPhotoToSlot(sceneId, slotIdx, null),
        disabled: disabled || !photo,
      },
    ];
  };

  return (
    <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2">
      {menu}
      {/* Scene Track Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
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
            className="ml-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200 hover:border-amber-400 disabled:opacity-40"
          >
            ⚡ Đổ ảnh
          </button>
          <button
            type="button"
            disabled={disabled || scenes.length < 2}
            onClick={() => randomizeSceneTransitions()}
            title="Trộn ngẫu nhiên 18 kiểu chuyển cảnh mượt (gồm cả 3D, Ctrl+Z để hoàn tác)"
            className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200 hover:border-amber-400 disabled:opacity-40"
          >
            🎲 Trộn chuyển cảnh
          </button>
          <button
            type="button"
            disabled={disabled || scenes.length === 0}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              openAt({ clientX: r.left, clientY: r.bottom + 4 }, [
                ...AUTO_MOTION_MODES.map((m) => ({
                  label: m.label,
                  onClick: () => applyAutoMotion(m.id),
                })),
                { label: '', separator: true },
                {
                  label: `Đưa ${autoMotionCount} scene tự động về "Theo dự án"`,
                  disabled: autoMotionCount === 0,
                  onClick: () => clearAutoMotion(),
                },
              ]);
            }}
            title="Tự chọn Motion Template cho mọi scene (giữ nguyên scene anh đã chọn tay; Ctrl+Z để hoàn tác)"
            className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200 hover:border-amber-400 disabled:opacity-40"
          >
            🎬 Motion tự động ▾
          </button>
          <button
            type="button"
            disabled={disabled || scenes.length === 0}
            onClick={clearAllSceneSlots}
            className="rounded border border-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
          >
            Trống ô
          </button>
          {multiSelected && (
            <span
              role="status"
              className="ml-1 flex items-center gap-1 rounded border border-amber-400/60 bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-200"
            >
              Đã chọn {selectedIds.length} scene
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeScenes(selectedIds)}
                title="Xóa các scene đã chọn (phím Delete, Ctrl+Z để hoàn tác)"
                className="rounded bg-red-600/80 px-1.5 text-white hover:bg-red-500 disabled:opacity-40"
              >
                🗑 Xóa
              </button>
              <button
                type="button"
                onClick={clearSceneSelection}
                title="Bỏ chọn (Esc)"
                className="rounded px-1 text-zinc-300 hover:text-white"
              >
                ✕
              </button>
            </span>
          )}
          <label
            className="ml-1 flex items-center gap-1 text-xs text-zinc-400"
            title="Phóng to / thu nhỏ thẻ Scene (hoặc Ctrl + lăn chuột trên dải scene)"
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
            <span className="w-9 font-mono text-zinc-500">{Math.round(sceneZoom * 100)}%</span>
          </label>
          <div className="ml-1 flex overflow-hidden rounded border border-zinc-700" role="group" aria-label="Cách xếp scene">
            {(
              [
                ['row', 'Ngang', 'Xếp một hàng ngang (lăn chuột để cuộn ngang)'],
                ['grid', 'Lưới', 'Xếp xuống dòng, thấy nhiều scene cùng lúc'],
              ] as const
            ).map(([mode, label, title]) => (
              <button
                key={mode}
                type="button"
                title={title}
                aria-pressed={sceneTrackMode === mode}
                onClick={() => setSceneTrackMode(mode)}
                className={`px-2 py-0.5 text-xs ${
                  sceneTrackMode === mode ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-900 text-zinc-300 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              title="Xếp lưới và tự thu nhỏ cho vừa hết scene trong khung"
              disabled={scenes.length === 0}
              onClick={fitAllScenes}
              className="border-l border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-300 hover:text-white disabled:opacity-40"
            >
              Vừa khung
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs">
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
      <div
        ref={stripRef}
        className={`flex min-h-0 flex-1 items-start gap-1.5 pb-1 ${
          gridMode ? 'flex-wrap content-start overflow-y-auto overflow-x-hidden' : 'overflow-auto'
        }`}
      >
        {scenes.map((sc, idx) => {
          const isActive = sc.id === activeSceneId;
          const isSceneDropHot = dropSceneId === sc.id;
          const isMenuOpen = openTransMenuSceneId === sc.id;

          return (
            <div key={sc.id} className="relative flex shrink-0 items-stretch gap-1.5">
              <div
                draggable={!disabled}
                onMouseDown={(e) => {
                  // Shift + click would otherwise select page text.
                  if (e.shiftKey) e.preventDefault();
                }}
                onClick={(e) => {
                  clickScene(sc.id, e.shiftKey ? 'range' : e.ctrlKey || e.metaKey ? 'toggle' : 'single');
                  setInspectorScope('scene');
                }}
                onContextMenu={(e) => {
                  // Right-click inside a multi-selection keeps it (menu offers "Xóa N scene").
                  if (multiSelected && selectedIds.includes(sc.id)) {
                    openAt(e, buildSceneMenu(sc.id));
                    return;
                  }
                  selectSceneAndSeek(sc.id, 0);
                  setInspectorScope('scene');
                  openAt(e, buildSceneMenu(sc.id));
                }}
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
                      ? `border-amber-400 bg-zinc-800/90 shadow-md shadow-amber-500/10 ${multiSelected ? 'ring-2 ring-amber-400/70' : ''}`
                      : multiSelected && selectedIds.includes(sc.id)
                        ? 'border-amber-400/80 bg-amber-500/10 ring-2 ring-amber-400/70'
                        : 'border-zinc-800 bg-zinc-900/90 hover:border-zinc-700'
                }`}
                aria-selected={selectedIds.includes(sc.id)}
              >
                {/* Card Header */}
                <div className="mb-1 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <span
                      className="cursor-grab text-xs leading-none text-zinc-500 hover:text-zinc-300"
                      title="Kéo thả thẻ Scene để đổi thứ tự"
                    >
                      ⋮⋮
                    </span>
                    <span className="rounded bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-zinc-950">
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
                      className={`h-7 ${compactMode ? 'w-14 px-0' : 'w-16 px-1'} rounded border border-zinc-700 bg-zinc-950 text-center font-mono text-xs text-zinc-200`}
                      title="Thời lượng Scene (giây)"
                    />
                    {!compactMode && <span className="text-xs text-zinc-500">s</span>}
                  </div>

                  <button
                    type="button"
                    disabled={disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      const r = e.currentTarget.getBoundingClientRect();
                      openAt({ clientX: r.left, clientY: r.bottom + 2 }, buildSceneMenu(sc.id));
                    }}
                    title="Thêm thao tác cho scene (hoặc bấm chuột phải vào thẻ)"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-base leading-none text-zinc-300 hover:bg-zinc-700 hover:text-amber-300 disabled:opacity-30"
                  >
                    ⋯
                  </button>
                </div>

                {/* Layout Selector (hidden in compact mode to save vertical space) */}
                {!compactMode && (
                  <select
                    value={sc.layout}
                    disabled={disabled}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setSceneLayout(sc.id, e.target.value as SceneLayoutId)}
                    className="mb-1.5 w-full rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-xs text-zinc-200"
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
                  style={{
                    width: miniW,
                    height: Math.round(miniW / canvasAspect),
                    background: sc.slots.length > 1 ? backgroundCss(resolveSceneBackground(renderParams, sc)) : undefined,
                  }}
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
                        onContextMenu={(e) => {
                          selectSceneAndSeek(sc.id, slotIdx);
                          openAt(e, buildSlotMenu(sc.id, slotIdx));
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (e.shiftKey || e.ctrlKey || e.metaKey) {
                            // Shift / Ctrl + click anywhere on the card picks scenes (Đợt 6.2).
                            clickScene(sc.id, e.shiftKey ? 'range' : 'toggle');
                            setInspectorScope('scene');
                            return;
                          }
                          if (selectedPhotoId && !disabled) {
                            assignPhotoToSlot(sc.id, slotIdx, selectedPhotoId);
                            setInspectorScope('scene');
                          } else {
                            selectSceneAndSeek(sc.id, slotIdx);
                            setInspectorScope(photo ? 'photo' : 'scene');
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
                                : 'border-dashed border-zinc-700 bg-zinc-900/50 text-xs text-zinc-500 hover:border-amber-400 hover:text-amber-300'
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
                              className={`absolute top-0.5 left-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-xs font-bold leading-none ${
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
                                className="absolute top-0.5 right-0.5 hidden h-3.5 w-3.5 items-center justify-center rounded bg-black/80 text-xs text-white hover:bg-red-500 group-hover:flex"
                              >
                                ×
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-xs font-semibold">+{slotIdx + 1}</span>
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
                    title={`Chọn chuyển cảnh từ Scene ${idx + 1} → Scene ${idx + 2} (${getTransitionName(sc.transitionType)})`}
                    className={`rounded-full border px-2 py-1 text-xs transition disabled:opacity-40 ${
                      isMenuOpen
                        ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                        : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-amber-400 hover:text-amber-300'
                    }`}
                  >
                    {/* Small zoom: icon only, so more scenes fit (name stays in the tooltip). */}
                    ⇄{compactMode ? '' : ` ${getTransitionName(sc.transitionType)}`}
                  </button>

                  {isMenuOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="fixed bottom-44 z-50 max-h-80 w-60 overflow-y-auto rounded-lg border border-zinc-700 bg-[#18181f] p-2 shadow-2xl"
                    >
                      <div className="mb-1.5 flex items-center justify-between border-b border-zinc-800 pb-1 text-xs font-semibold text-amber-400">
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
                            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
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
                                    className={`flex items-center justify-between rounded px-2 py-1 text-left text-xs transition ${
                                      active
                                        ? 'bg-amber-500 font-semibold text-zinc-950'
                                        : 'text-zinc-200 hover:bg-zinc-800'
                                    }`}
                                  >
                                    <span>{tr.name}</span>
                                    {tr.group === '3D Phối cảnh' && (
                                      <span
                                        className={`rounded px-1 text-xs ${
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
