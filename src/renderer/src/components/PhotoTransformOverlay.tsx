import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IDENTITY_PHOTO_TRANSFORM, normalizePhotoTransform, PHOTO_TRANSFORM_LIMITS } from '@engine/photoTransform';
import type { PhotoTransform } from '@shared/types';
import { useAppStore } from '../store/useAppStore';
import { usePhotoEditTarget } from './usePhotoEditTarget';

interface Props {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onClose: () => void;
  /** Slot in the tool strip above the preview; the exact-value fields go there (outside the picture). */
  toolSlot?: HTMLElement | null;
}

type DragMode = 'move' | 'scale' | 'rotate';

interface DragState {
  mode: DragMode;
  startX: number;
  startY: number;
  start: PhotoTransform;
  centerX: number;
  centerY: number;
  startDist: number;
  startAngle: number;
}

/**
 * Lets the user move / scale / rotate the selected photo directly on the preview:
 * drag inside the box to move, drag a corner to scale, drag the round handle to rotate
 * (hold Shift to snap 15°). Numbers below the preview allow exact values.
 */
export function PhotoTransformOverlay({ canvasRef, onClose, toolSlot }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const lastWheelRef = useRef(0);
  const pushUndoPoint = useAppStore((s) => s.pushUndoPoint);
  const selectSceneAndSeek = useAppStore((s) => s.selectSceneAndSeek);
  const keyframeEditPhase = useAppStore((s) => s.keyframeEditPhase);
  const setKeyframeEditPhase = useAppStore((s) => s.setKeyframeEditPhase);
  const { box, scene, slotIdx, photo, editingEnd, setPhotoTransform, xf, rectFor, fx, fy, fw, fh } =
    usePhotoEditTarget(canvasRef, rootRef);
  const cx = fx + fw / 2 + xf.x * fw;
  const cy = fy + fh / 2 + xf.y * fh;

  // Gizmo centre: the photo centre, kept on screen.
  const gx = Math.min(Math.max(cx, box.left + 70), box.left + box.width - 70);
  const gy = Math.min(Math.max(cy, box.top + 70), box.top + box.height - 70);

  const apply = (patch: Partial<PhotoTransform>, history = false) => {
    if (photo) setPhotoTransform(photo.id, { ...xf, ...patch }, history);
  };

  const beginDrag = (mode: DragMode, pivot: 'photo' | 'gizmo' = 'photo') => (e: React.PointerEvent) => {
    if (!photo || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rootRect = rootRef.current?.getBoundingClientRect();
    const centerX = (rootRect?.left ?? 0) + (pivot === 'gizmo' ? gx : cx);
    const centerY = (rootRect?.top ?? 0) + (pivot === 'gizmo' ? gy : cy);
    pushUndoPoint();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
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

  const onDragMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !photo || fw <= 0 || fh <= 0) return;
    if (d.mode === 'move') {
      apply({
        x: d.start.x + (e.clientX - d.startX) / fw,
        y: d.start.y + (e.clientY - d.startY) / fh,
      });
    } else if (d.mode === 'scale') {
      const dist = Math.hypot(e.clientX - d.centerX, e.clientY - d.centerY);
      apply({ scale: d.start.scale * (dist / d.startDist) });
    } else {
      const ang = Math.atan2(e.clientY - d.centerY, e.clientX - d.centerX);
      let deg = d.start.rotationDeg + ((ang - d.startAngle) * 180) / Math.PI;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      apply({ rotationDeg: deg });
    }
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  // Mouse wheel = zoom (handy when the corners sit outside the visible frame).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
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
  }, [photo, editingEnd, pushUndoPoint, setPhotoTransform]);

  const numField = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    step: number,
    suffix: string
  ) => (
    <label className="flex items-center gap-1">
      <span className="text-zinc-400">{label}</span>
      <input
        type="number"
        step={step}
        value={Number(value.toFixed(1))}
        disabled={!photo}
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

  // Exact values: shown in the tool strip above the preview so they never cover the photo.
  const valuePanel = (
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-200">
        <span className="font-semibold text-amber-400">
          Chỉnh ảnh{scene && scene.slots.length > 1 ? ` • ô ${slotIdx + 1}` : ''}
        </span>
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
        {numField('X', xf.x * 100, (v) => apply({ x: v / 100 }), 1, '%')}
        {numField('Y', xf.y * 100, (v) => apply({ y: v / 100 }), 1, '%')}
        {numField(
          'Zoom',
          xf.scale * 100,
          (v) => apply({ scale: v / 100 }),
          5,
          `% (${PHOTO_TRANSFORM_LIMITS.scaleMin * 100}–${PHOTO_TRANSFORM_LIMITS.scaleMax * 100})`
        )}
        {numField('Xoay', xf.rotationDeg, (v) => apply({ rotationDeg: v }), 1, '°')}
        <button
          type="button"
          disabled={!photo}
          onClick={() => photo && setPhotoTransform(photo.id, { ...IDENTITY_PHOTO_TRANSFORM }, true)}
          className="rounded border border-zinc-700 px-1.5 py-0.5 hover:border-amber-400 hover:text-amber-300 disabled:opacity-40"
        >
          Đặt lại
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded bg-amber-500 px-2 py-0.5 font-semibold text-zinc-950 hover:bg-amber-400"
        >
          Xong
        </button>
      </div>
  );

  const handle = 'absolute h-3 w-3 rounded-sm border border-zinc-950 bg-amber-400 shadow';

  return (
    <div ref={rootRef} className="absolute inset-0 z-20 select-none" onPointerMove={onDragMove} onPointerUp={endDrag}>
      {/* Other slots of this scene: click to edit that photo instead */}
      {scene?.slots.map((pid, i) => {
        if (i === slotIdx) return null;
        const r = rectFor(i);
        return (
          <button
            key={i}
            type="button"
            title={pid ? `Chỉnh ảnh ô ${i + 1}` : `Ô ${i + 1} trống`}
            disabled={!pid}
            onClick={() => scene && selectSceneAndSeek(scene.id, i)}
            style={{
              left: box.left + r.x * box.width,
              top: box.top + r.y * box.height,
              width: r.w * box.width,
              height: r.h * box.height,
            }}
            className="absolute rounded-sm border border-dashed border-white/40 hover:border-amber-300 hover:bg-amber-400/10 disabled:cursor-not-allowed"
          >
            <span className="absolute top-1 left-1 rounded-full bg-black/70 px-1.5 text-xs text-white">
              {i + 1}
            </span>
          </button>
        );
      })}

      {/* Frame of the slot being edited (where the photo is clipped) */}
      <div
        className="pointer-events-none absolute border border-amber-300/50"
        style={{ left: fx, top: fy, width: fw, height: fh }}
      />

      {photo ? (
        <div
          className="absolute cursor-move border-2 border-amber-400"
          onPointerDown={beginDrag('move')}
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
              onPointerDown={beginDrag('scale')}
              title="Kéo để phóng to / thu nhỏ"
              className={`${handle} cursor-nwse-resize ${
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
        // Centre gizmo: always on screen even when the photo is larger than the frame.
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
              onPointerDown={beginDrag('move')}
              title="Kéo để di chuyển ảnh"
              className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border-2 border-amber-400 bg-zinc-950/70"
              style={{ left: gx, top: gy }}
            />
            <div
              onPointerDown={beginDrag('rotate', 'gizmo')}
              title="Kéo để xoay (giữ Shift: bước 15°)"
              className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border border-zinc-950 bg-amber-400 shadow"
              style={{ left: rotKnob.x, top: rotKnob.y }}
            />
            <div
              onPointerDown={beginDrag('scale', 'gizmo')}
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

      {toolSlot ? createPortal(valuePanel, toolSlot) : (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md border border-zinc-700 bg-zinc-950/90 px-2 py-1 shadow-lg">
          {valuePanel}
        </div>
      )}
    </div>
  );
}
