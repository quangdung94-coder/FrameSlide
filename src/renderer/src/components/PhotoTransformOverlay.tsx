import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { clamp } from '@engine/num';
import { IDENTITY_PHOTO_TRANSFORM, normalizePhotoTransform, PHOTO_TRANSFORM_LIMITS } from '@engine/photoTransform';
import { hasCustomSingleFrame, normalizeSlotFrame, SLOT_FRAME_LIMITS } from '@engine/slotFrame';
import type { PhotoTransform, SlotFrameOverride } from '@shared/types';
import { useAppStore } from '../store/useAppStore';
import { usePhotoEditTarget } from './usePhotoEditTarget';

interface Props {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onClose: () => void;
  /** Slot in the tool strip above the preview; the exact-value fields go there (outside the picture). */
  toolSlot?: HTMLElement | null;
}

type FrameHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const HANDLE_DIRS: Record<FrameHandle, [number, number]> = {
  nw: [-1, -1],
  n: [0, -1],
  ne: [1, -1],
  e: [1, 0],
  se: [1, 1],
  s: [0, 1],
  sw: [-1, 1],
  w: [-1, 0],
};

const FRAME_HANDLES: FrameHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

type DragState =
  | {
      kind: 'photo';
      mode: 'move' | 'scale' | 'rotate';
      startX: number;
      startY: number;
      start: PhotoTransform;
      centerX: number;
      centerY: number;
      startDist: number;
      startAngle: number;
    }
  | {
      kind: 'frame-move';
      startX: number;
      startY: number;
      startOv: SlotFrameOverride;
    }
  | {
      kind: 'frame-resize';
      handle: FrameHandle;
      startX: number;
      startY: number;
      startOv: SlotFrameOverride;
      startW: number;
      startH: number;
      baseW: number;
      baseH: number;
    };

/**
 * Lets the user either:
 * 1. Resize & move each photo frame card directly on the preview (corner drag keeps ratio;
 *    hold Shift or drag edges for Photoshop-style free resize), OR
 * 2. Move / zoom / rotate the photo inside its frame.
 */
export function PhotoTransformOverlay({ canvasRef, onClose, toolSlot }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const lastWheelRef = useRef(0);
  const pushUndoPoint = useAppStore((s) => s.pushUndoPoint);
  const selectSceneAndSeek = useAppStore((s) => s.selectSceneAndSeek);
  const keyframeEditPhase = useAppStore((s) => s.keyframeEditPhase);
  const setKeyframeEditPhase = useAppStore((s) => s.setKeyframeEditPhase);
  const setSceneSlotFrame = useAppStore((s) => s.setSceneSlotFrame);
  const { box, scene, slotIdx, photo, editingEnd, setPhotoTransform, xf, rectFor, baseRectFor, fx, fy, fw, fh } =
    usePhotoEditTarget(canvasRef, rootRef);

  const [layer, setLayer] = useState<'frame' | 'photo'>(() =>
    (scene?.slots.length ?? 1) > 1 || hasCustomSingleFrame(scene) ? 'frame' : 'frame'
  );

  const frameOv = normalizeSlotFrame(scene?.slotFrames?.[slotIdx]);
  const baseRect = baseRectFor(slotIdx);
  const baseW = baseRect.w * box.width;
  const baseH = baseRect.h * box.height;

  const cx = fx + fw / 2 + xf.x * fw;
  const cy = fy + fh / 2 + xf.y * fh;
  const gx = Math.min(Math.max(cx, box.left + 70), box.left + box.width - 70);
  const gy = Math.min(Math.max(cy, box.top + 70), box.top + box.height - 70);

  const applyPhoto = (patch: Partial<PhotoTransform>, history = false) => {
    if (photo) setPhotoTransform(photo.id, { ...xf, ...patch }, history);
  };

  const applyFrame = (patch: Partial<SlotFrameOverride>, history = false) => {
    if (scene) setSceneSlotFrame(scene.id, slotIdx, patch, history);
  };

  const beginPhotoDrag = (mode: 'move' | 'scale' | 'rotate', pivot: 'photo' | 'gizmo' = 'photo') => (e: React.PointerEvent) => {
    if (!photo || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rootRect = rootRef.current?.getBoundingClientRect();
    const centerX = (rootRect?.left ?? 0) + (pivot === 'gizmo' ? gx : cx);
    const centerY = (rootRect?.top ?? 0) + (pivot === 'gizmo' ? gy : cy);
    pushUndoPoint();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: 'photo',
      mode,
      startX: e.clientX,
      startY: e.clientY,
      start: xf,
      centerX,
      centerY,
      startDist: Math.max(4, Math.hypot(e.clientX - centerX, e.clientY - centerY)),
      startAngle: Math.atan2(e.clientY - centerY, e.clientX - centerX),
    };
  };

  const beginFrameMove = (e: React.PointerEvent) => {
    if (!scene || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    pushUndoPoint();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: 'frame-move',
      startX: e.clientX,
      startY: e.clientY,
      startOv: frameOv,
    };
  };

  const beginFrameResize = (handle: FrameHandle) => (e: React.PointerEvent) => {
    if (!scene || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    pushUndoPoint();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: 'frame-resize',
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startOv: frameOv,
      startW: fw,
      startH: fh,
      baseW,
      baseH,
    };
  };

  const onDragMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;

    if (d.kind === 'frame-move') {
      if (box.width <= 0 || box.height <= 0) return;
      applyFrame({
        dx: d.startOv.dx + (e.clientX - d.startX) / box.width,
        dy: d.startOv.dy + (e.clientY - d.startY) / box.height,
      });
      return;
    }

    if (d.kind === 'frame-resize') {
      if (box.width <= 0 || box.height <= 0 || d.baseW <= 0 || d.baseH <= 0 || d.startW <= 0 || d.startH <= 0) {
        return;
      }
      const [sxDir, syDir] = HANDLE_DIRS[d.handle];
      const deltaPxX = (e.clientX - d.startX) * sxDir;
      const deltaPxY = (e.clientY - d.startY) * syDir;
      const rawW = sxDir !== 0 ? Math.max(20, d.startW + deltaPxX) : d.startW;
      const rawH = syDir !== 0 ? Math.max(20, d.startH + deltaPxY) : d.startH;

      let nextScaleX = d.startOv.scaleX;
      let nextScaleY = d.startOv.scaleY;

      if (sxDir !== 0 && syDir !== 0 && !e.shiftKey) {
        // Default corner drag keeps aspect ratio; hold Shift for free Photoshop-style scaling.
        const ratioW = rawW / d.startW;
        const ratioH = rawH / d.startH;
        const kRaw = Math.abs(deltaPxX / d.startW) >= Math.abs(deltaPxY / d.startH) ? ratioW : ratioH;
        const minK = Math.max(
          SLOT_FRAME_LIMITS.scaleMin / d.startOv.scaleX,
          SLOT_FRAME_LIMITS.scaleMin / d.startOv.scaleY
        );
        const maxK = Math.min(
          SLOT_FRAME_LIMITS.scaleMax / d.startOv.scaleX,
          SLOT_FRAME_LIMITS.scaleMax / d.startOv.scaleY
        );
        const k = clamp(kRaw, minK, maxK);
        nextScaleX = d.startOv.scaleX * k;
        nextScaleY = d.startOv.scaleY * k;
      } else {
        if (sxDir !== 0) {
          nextScaleX = clamp(
            d.startOv.scaleX * (rawW / d.startW),
            SLOT_FRAME_LIMITS.scaleMin,
            SLOT_FRAME_LIMITS.scaleMax
          );
        }
        if (syDir !== 0) {
          nextScaleY = clamp(
            d.startOv.scaleY * (rawH / d.startH),
            SLOT_FRAME_LIMITS.scaleMin,
            SLOT_FRAME_LIMITS.scaleMax
          );
        }
      }

      const actualW = d.baseW * nextScaleX;
      const actualH = d.baseH * nextScaleY;
      const shiftX = sxDir !== 0 ? (sxDir * (actualW - d.startW)) / 2 : 0;
      const shiftY = syDir !== 0 ? (syDir * (actualH - d.startH)) / 2 : 0;

      applyFrame({
        scaleX: nextScaleX,
        scaleY: nextScaleY,
        dx: d.startOv.dx + shiftX / box.width,
        dy: d.startOv.dy + shiftY / box.height,
      });
      return;
    }

    if (!photo || fw <= 0 || fh <= 0) return;
    if (d.mode === 'move') {
      applyPhoto({
        x: d.start.x + (e.clientX - d.startX) / fw,
        y: d.start.y + (e.clientY - d.startY) / fh,
      });
    } else if (d.mode === 'scale') {
      const dist = Math.hypot(e.clientX - d.centerX, e.clientY - d.centerY);
      applyPhoto({ scale: d.start.scale * (dist / d.startDist) });
    } else {
      const ang = Math.atan2(e.clientY - d.centerY, e.clientX - d.centerX);
      let deg = d.start.rotationDeg + ((ang - d.startAngle) * 180) / Math.PI;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      applyPhoto({ rotationDeg: deg });
    }
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  // Plain wheel zooms the selected layer; Ctrl+wheel bubbles to App's preview viewport zoom.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      if (layer === 'frame') {
        if (!scene) return;
        e.preventDefault();
        const now = performance.now();
        if (now - lastWheelRef.current > 400) pushUndoPoint();
        lastWheelRef.current = now;
        const liveScene = useAppStore.getState().scenes.find((sc) => sc.id === scene.id);
        const cur = normalizeSlotFrame(liveScene?.slotFrames?.[slotIdx]);
        const factor = Math.exp(-e.deltaY * 0.0012);
        const minK = Math.max(SLOT_FRAME_LIMITS.scaleMin / cur.scaleX, SLOT_FRAME_LIMITS.scaleMin / cur.scaleY);
        const maxK = Math.min(SLOT_FRAME_LIMITS.scaleMax / cur.scaleX, SLOT_FRAME_LIMITS.scaleMax / cur.scaleY);
        const k = clamp(factor, minK, maxK);
        setSceneSlotFrame(scene.id, slotIdx, { scaleX: cur.scaleX * k, scaleY: cur.scaleY * k }, false);
        return;
      }
      if (!photo) return;
      e.preventDefault();
      const now = performance.now();
      if (now - lastWheelRef.current > 400) pushUndoPoint();
      lastWheelRef.current = now;
      const live = useAppStore.getState().slides.find((p) => p.id === photo.id);
      const cur = normalizePhotoTransform(editingEnd ? live?.transformEnd : live?.transform);
      setPhotoTransform(photo.id, { ...cur, scale: cur.scale * Math.exp(-e.deltaY * 0.0015) }, false);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [layer, scene, slotIdx, photo, editingEnd, pushUndoPoint, setPhotoTransform, setSceneSlotFrame]);

  const numField = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    step: number,
    suffix: string,
    disabledField = false
  ) => (
    <label className="flex items-center gap-1">
      <span className="text-zinc-400">{label}</span>
      <input
        type="number"
        step={step}
        value={Number(value.toFixed(1))}
        disabled={disabledField}
        onFocus={() => pushUndoPoint()}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="w-18 rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5 text-right font-mono text-zinc-100"
      />
      <span className="text-zinc-500">{suffix}</span>
    </label>
  );

  const valuePanel = (
    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-200">
      <div className="flex overflow-hidden rounded border border-zinc-700" role="tablist" aria-label="Đối tượng chỉnh">
        {(
          [
            ['frame', 'Khung ảnh'],
            ['photo', 'Ảnh bên trong'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={layer === id}
            onClick={() => setLayer(id)}
            className={`px-2 py-0.5 font-medium ${
              layer === id
                ? 'bg-amber-500 text-zinc-950'
                : 'bg-zinc-900 text-zinc-300 hover:text-amber-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {scene && scene.slots.length > 1 && (
        <span className="font-semibold text-amber-400">Ô {slotIdx + 1}</span>
      )}

      {layer === 'frame' ? (
        <>
          {numField('Rộng', frameOv.scaleX * 100, (v) => applyFrame({ scaleX: v / 100 }), 5, '%', !scene)}
          {numField('Cao', frameOv.scaleY * 100, (v) => applyFrame({ scaleY: v / 100 }), 5, '%', !scene)}
          <span className="hidden text-2xs text-zinc-500 xl:inline">
            Kéo góc: giữ tỷ lệ • Giữ Shift: tự do
          </span>
          <button
            type="button"
            disabled={!scene}
            onClick={() => scene && setSceneSlotFrame(scene.id, slotIdx, null, true)}
            className="rounded border border-zinc-700 px-1.5 py-0.5 hover:border-amber-400 hover:text-amber-300 disabled:opacity-40"
          >
            Đặt lại khung
          </button>
        </>
      ) : (
        <>
          {photo?.transformEnd && (
            <div className="flex overflow-hidden rounded border border-zinc-700">
              {(
                [
                  ['start', 'Đầu'],
                  ['end', 'Cuối'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setKeyframeEditPhase(id)}
                  title={id === 'start' ? 'Chỉnh tư thế lúc bắt đầu scene' : 'Chỉnh tư thế lúc kết thúc scene'}
                  className={`px-2 py-0.5 ${
                    keyframeEditPhase === id
                      ? 'bg-amber-500 font-semibold text-zinc-950'
                      : 'bg-zinc-900 text-zinc-300 hover:text-amber-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {numField('X', xf.x * 100, (v) => applyPhoto({ x: v / 100 }), 1, '%', !photo)}
          {numField('Y', xf.y * 100, (v) => applyPhoto({ y: v / 100 }), 1, '%', !photo)}
          {numField(
            'Zoom',
            xf.scale * 100,
            (v) => applyPhoto({ scale: v / 100 }),
            5,
            `% (${PHOTO_TRANSFORM_LIMITS.scaleMin * 100}–${PHOTO_TRANSFORM_LIMITS.scaleMax * 100})`,
            !photo
          )}
          {numField('Xoay', xf.rotationDeg, (v) => applyPhoto({ rotationDeg: v }), 1, '°', !photo)}
          <button
            type="button"
            disabled={!photo}
            onClick={() => photo && setPhotoTransform(photo.id, { ...IDENTITY_PHOTO_TRANSFORM }, true)}
            className="rounded border border-zinc-700 px-1.5 py-0.5 hover:border-amber-400 hover:text-amber-300 disabled:opacity-40"
          >
            Đặt lại
          </button>
        </>
      )}

      <button
        type="button"
        onClick={onClose}
        className="rounded bg-amber-500 px-2 py-0.5 font-semibold text-zinc-950 hover:bg-amber-400"
      >
        Xong
      </button>
    </div>
  );

  const handleCls = 'absolute h-3 w-3 rounded-sm border border-zinc-950 bg-amber-400 shadow';

  const handlePosClass = (h: FrameHandle) => {
    switch (h) {
      case 'nw':
        return '-top-1.5 -left-1.5 cursor-nwse-resize';
      case 'n':
        return '-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize';
      case 'ne':
        return '-top-1.5 -right-1.5 cursor-nesw-resize';
      case 'e':
        return 'top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize';
      case 'se':
        return '-right-1.5 -bottom-1.5 cursor-nwse-resize';
      case 's':
        return '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize';
      case 'sw':
        return '-bottom-1.5 -left-1.5 cursor-nesw-resize';
      case 'w':
        return 'top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize';
    }
  };

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-20 select-none"
      onPointerMove={onDragMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* Other slots of this scene: click to switch to that frame/photo */}
      {scene?.slots.map((pid, i) => {
        if (i === slotIdx) return null;
        const r = rectFor(i);
        return (
          <button
            key={i}
            type="button"
            title={pid ? `Chọn khung / ảnh ô ${i + 1}` : `Ô ${i + 1} trống`}
            disabled={!pid && layer === 'photo'}
            onClick={() => scene && selectSceneAndSeek(scene.id, i)}
            style={{
              left: box.left + r.x * box.width,
              top: box.top + r.y * box.height,
              width: r.w * box.width,
              height: r.h * box.height,
            }}
            className="absolute rounded-sm border border-dashed border-white/45 hover:border-amber-300 hover:bg-amber-400/10 disabled:cursor-not-allowed"
          >
            <span className="absolute top-1 left-1 rounded-full bg-black/70 px-1.5 text-xs text-white">
              {i + 1}
            </span>
          </button>
        );
      })}

      {layer === 'frame' ? (
        <div
          className="absolute cursor-move border-2 border-amber-400 bg-amber-400/5"
          style={{ left: fx, top: fy, width: fw, height: fh }}
          onPointerDown={beginFrameMove}
          title="Kéo giữa để dời khung • Kéo góc để phóng to/thu nhỏ theo tỷ lệ • Giữ Shift để kéo tự do"
        >
          {FRAME_HANDLES.map((h) => (
            <div
              key={h}
              onPointerDown={beginFrameResize(h)}
              title={
                h.length === 2
                  ? 'Kéo góc: giữ tỷ lệ • Giữ Shift: kéo tự do giống Photoshop'
                  : 'Kéo cạnh để co giãn chiều rộng / chiều cao'
              }
              className={`${handleCls} ${handlePosClass(h)}`}
            />
          ))}
        </div>
      ) : (
        <>
          <div
            className="pointer-events-none absolute border border-amber-300/50"
            style={{ left: fx, top: fy, width: fw, height: fh }}
          />
          {photo ? (
            <div
              className="absolute cursor-move border-2 border-amber-400"
              onPointerDown={beginPhotoDrag('move')}
              style={{
                left: cx - fw / 2,
                top: cy - fh / 2,
                width: fw,
                height: fh,
                transform: `rotate(${xf.rotationDeg}deg) scale(${xf.scale})`,
                transformOrigin: '50% 50%',
              }}
              title="Kéo để di chuyển ảnh • Lăn chuột để phóng to/thu nhỏ"
            >
              {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                <div
                  key={corner}
                  onPointerDown={beginPhotoDrag('scale')}
                  title="Kéo để phóng to / thu nhỏ ảnh bên trong"
                  className={`${handleCls} cursor-nwse-resize ${
                    corner === 'nw'
                      ? '-top-1.5 -left-1.5'
                      : corner === 'ne'
                        ? '-top-1.5 -right-1.5 cursor-nesw-resize'
                        : corner === 'sw'
                          ? '-bottom-1.5 -left-1.5 cursor-nesw-resize'
                          : '-right-1.5 -bottom-1.5'
                  }`}
                  style={{ transform: `scale(${1 / xf.scale})` }}
                />
              ))}
            </div>
          ) : null}

          {photo && (() => {
            const rad = (xf.rotationDeg * Math.PI) / 180;
            const R = 52;
            const rotKnob = { x: gx + Math.sin(rad) * R, y: gy - Math.cos(rad) * R };
            const sclKnob = { x: gx + Math.cos(rad) * R, y: gy + Math.sin(rad) * R };
            return (
              <>
                <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
                  <circle cx={gx} cy={gy} r={R} fill="none" stroke="rgba(251,191,36,0.35)" strokeDasharray="3 4" />
                  <line x1={gx} y1={gy} x2={rotKnob.x} y2={rotKnob.y} stroke="rgb(251,191,36)" />
                  <line x1={gx} y1={gy} x2={sclKnob.x} y2={sclKnob.y} stroke="rgb(251,191,36)" />
                </svg>
                <div
                  onPointerDown={beginPhotoDrag('move')}
                  title="Kéo để di chuyển ảnh"
                  className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border-2 border-amber-400 bg-zinc-950/70"
                  style={{ left: gx, top: gy }}
                />
                <div
                  onPointerDown={beginPhotoDrag('rotate', 'gizmo')}
                  title="Kéo để xoay (giữ Shift: bước 15°)"
                  className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border border-zinc-950 bg-amber-400 shadow"
                  style={{ left: rotKnob.x, top: rotKnob.y }}
                />
                <div
                  onPointerDown={beginPhotoDrag('scale', 'gizmo')}
                  title="Kéo ra xa / lại gần tâm để phóng to / thu nhỏ"
                  className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize rounded-sm border border-zinc-950 bg-amber-400 shadow"
                  style={{ left: sclKnob.x, top: sclKnob.y }}
                />
              </>
            );
          })()}

          {!photo && (
            <div className="absolute inset-x-0 top-1/2 text-center text-xs text-amber-300">
              Ô này chưa có ảnh. Chọn ô có ảnh trên thẻ scene.
            </div>
          )}
        </>
      )}

      {toolSlot ? createPortal(valuePanel, toolSlot) : (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md border border-zinc-700 bg-zinc-950/90 px-2 py-1 shadow-lg">
          {valuePanel}
        </div>
      )}
    </div>
  );
}
