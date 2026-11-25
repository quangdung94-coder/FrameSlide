import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  applyCropBox,
  coverSourceRect,
  FULL_CROP_BOX,
  normalizeCropBox,
  resizeCropBox,
  rotatePhotoAbout,
  straightenDelta,
  type CropBox,
} from '@engine/photoTransform';
import type { PhotoTransform, SlideAsset } from '@shared/types';
import { classifyKeyTarget } from '../hooks/keyTarget';
import { usePhotoEditTarget } from './usePhotoEditTarget';

interface Props {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onClose: () => void;
  /** Slot in the tool strip above the preview, for the grid / straighten / apply buttons. */
  toolSlot?: HTMLElement | null;
}

export type CropGrid = 'thirds' | 'grid' | 'diagonal' | 'golden';

const GRIDS: { id: CropGrid; label: string; title: string }[] = [
  { id: 'thirds', label: '⅓', title: 'Một phần ba' },
  { id: 'grid', label: '#', title: 'Lưới ô vuông' },
  { id: 'diagonal', label: '╳', title: 'Đường chéo' },
  { id: 'golden', label: 'φ', title: 'Tỷ lệ vàng' },
];

/** How much smaller the crop view shows the picture than the normal preview. */
const CROP_VIEW_SCALE = 0.72;

type Handle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

type Drag =
  | { kind: 'move'; sx: number; sy: number; start: CropBox }
  | { kind: 'resize'; handle: Handle }
  | { kind: 'rotate'; startAngle: number; start: PhotoTransform; cx: number; cy: number }
  | { kind: 'straighten'; x1: number; y1: number; x2: number; y2: number };

/** Grid lines (0..1 box units) for the chosen overlay. */
function gridLines(grid: CropGrid): [number, number, number, number][] {
  if (grid === 'diagonal') {
    return [
      [0, 0, 1, 1],
      [1, 0, 0, 1],
    ];
  }
  const at = grid === 'thirds' ? [1 / 3, 2 / 3] : grid === 'golden' ? [0.382, 0.618] : [1, 2, 3, 4, 5].map((k) => k / 6);
  return at.flatMap((v) => [
    [v, 0, v, 1] as [number, number, number, number],
    [0, v, 1, v] as [number, number, number, number],
  ]);
}

/**
 * Draws the part of the photo the slot shows (cover fit around the focal point, after the 90°
 * turns), so the crop tool can show it whole, also where it reaches past the slot frame.
 */
function usePhotoPicture(photo: SlideAsset | undefined, frameAspect: number) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null);
    if (!photo || !Number.isFinite(frameAspect) || frameAspect <= 0) return;
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      const q = (((Math.round((photo.rotationDeg ?? 0) / 90) % 4) + 4) % 4) as 0 | 1 | 2 | 3;
      const rw = q % 2 ? img.naturalHeight : img.naturalWidth;
      const rh = q % 2 ? img.naturalWidth : img.naturalHeight;
      const src = coverSourceRect(rw, rh, frameAspect, photo.focalPoint);
      const outW = Math.min(1600, Math.round(src.w * rw));
      const outH = Math.max(1, Math.round(outW / frameAspect));
      const c = document.createElement('canvas');
      c.width = outW;
      c.height = outH;
      const g = c.getContext('2d');
      if (!g) return;
      // Map the rotated-image source rect onto the output, then draw the turned image.
      const k = outW / (src.w * rw);
      g.scale(k, k);
      g.translate(-src.x * rw, -src.y * rh);
      g.translate(rw / 2, rh / 2);
      g.rotate((q * Math.PI) / 2);
      g.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      setUrl(c.toDataURL('image/jpeg', 0.9));
    };
    img.src = photo.proxyUrl || photo.thumbUrl;
    return () => {
      alive = false;
    };
  }, [photo?.id, photo?.proxyUrl, photo?.thumbUrl, photo?.rotationDeg, photo?.focalPoint.x, photo?.focalPoint.y, frameAspect]); // eslint-disable-line react-hooks/exhaustive-deps
  return url;
}

/**
 * Photoshop-style crop on the preview (Đợt 5.3d): the whole photo shows with the outside dimmed,
 * the crop box is locked to the slot's shape. Drag edges / corners to resize, inside to move,
 * outside the box to rotate; "Làm thẳng" levels a line you draw. Enter applies, Esc cancels.
 * The result is stored in the photo's existing move / zoom / rotate transform.
 */
export function PhotoCropOverlay({ canvasRef, onClose, toolSlot }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const t = usePhotoEditTarget(canvasRef, rootRef);
  const { scene, slotIdx, photo, editingEnd, setPhotoTransform, xf } = t;
  // The crop view is zoomed out around the preview centre so the photo can be seen (and the box
  // grabbed) past the edges of the slot, with room around it to rotate.
  const pcx = t.box.left + t.box.width / 2;
  const pcy = t.box.top + t.box.height / 2;
  const fx = pcx + (t.fx - pcx) * CROP_VIEW_SCALE;
  const fy = pcy + (t.fy - pcy) * CROP_VIEW_SCALE;
  const fw = t.fw * CROP_VIEW_SCALE;
  const fh = t.fh * CROP_VIEW_SCALE;
  const frameAspect = fw > 0 && fh > 0 ? fw / fh : 16 / 9;
  const picture = usePhotoPicture(photo, frameAspect);

  const [draft, setDraft] = useState<PhotoTransform>(xf);
  const [crop, setCrop] = useState<CropBox>(FULL_CROP_BOX);
  const [grid, setGrid] = useState<CropGrid>('thirds');
  const [straighten, setStraighten] = useState(false);
  const [line, setLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // A different photo (or Start/End pose) starts a fresh crop.
  useEffect(() => {
    setDraft(xf);
    setCrop(FULL_CROP_BOX);
  }, [photo?.id, editingEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = () => {
    if (photo) setPhotoTransform(photo.id, applyCropBox(draft, crop), true);
    onClose();
  };
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || classifyKeyTarget(e.target as HTMLElement | null) === 'typing') return;
      e.preventDefault();
      applyRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Screen position of the frame centre, and frame-unit helpers.
  const ox = fx + fw / 2;
  const oy = fy + fh / 2;
  const local = (e: { clientX: number; clientY: number }) => {
    const r = rootRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };
  const toFrame = (p: { x: number; y: number }) => ({ x: (p.x - ox) / fw, y: (p.y - oy) / fh });

  const c = normalizeCropBox(crop);
  const bx = ox + (c.x - c.size / 2) * fw;
  const by = oy + (c.y - c.size / 2) * fh;
  const bw = c.size * fw;
  const bh = c.size * fh;
  const bcx = bx + bw / 2;
  const bcy = by + bh / 2;

  const start = (d: Drag) => (e: React.PointerEvent) => {
    if (!photo || e.button !== 0 || fw <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    rootRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = d;
  };

  const onRootDown = (e: React.PointerEvent) => {
    const p = local(e);
    if (straighten) {
      start({ kind: 'straighten', x1: p.x, y1: p.y, x2: p.x, y2: p.y })(e);
      setLine({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
      return;
    }
    // Outside the box: rotate the photo around the box centre.
    start({ kind: 'rotate', startAngle: Math.atan2(p.y - bcy, p.x - bcx), start: draft, cx: bcx, cy: bcy })(e);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const p = local(e);
    if (d.kind === 'move') {
      setCrop({ ...d.start, x: d.start.x + (p.x - d.sx) / fw, y: d.start.y + (p.y - d.sy) / fh });
    } else if (d.kind === 'resize') {
      const f = toFrame(p);
      setCrop((cur) => resizeCropBox(cur, d.handle, f.x, f.y));
    } else if (d.kind === 'rotate') {
      let deg = ((Math.atan2(p.y - d.cy, p.x - d.cx) - d.startAngle) * 180) / Math.PI;
      if (e.shiftKey) deg = Math.round((d.start.rotationDeg + deg) / 15) * 15 - d.start.rotationDeg;
      setDraft(rotatePhotoAbout(d.start, { x: c.x, y: c.y }, deg, frameAspect));
    } else {
      d.x2 = p.x;
      d.y2 = p.y;
      setLine({ x1: d.x1, y1: d.y1, x2: p.x, y2: p.y });
    }
  };

  const onUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.kind === 'straighten') {
      const delta = straightenDelta(d.x1, d.y1, d.x2, d.y2);
      if (delta !== 0) setDraft((cur) => rotatePhotoAbout(cur, { x: c.x, y: c.y }, delta, frameAspect));
      setLine(null);
      setStraighten(false);
    }
  };

  // React events from a portal still bubble to this overlay: keep toolbar clicks from starting a rotate drag.
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-200" onPointerDown={(e) => e.stopPropagation()}>
      <span className="font-semibold text-amber-400">
        Crop{scene && scene.slots.length > 1 ? ` • ô ${slotIdx + 1}` : ''}
        {editingEnd ? ' • Cuối' : ''}
      </span>
      <span className="text-zinc-400">Lưới</span>
      <div className="flex overflow-hidden rounded border border-zinc-700" role="radiogroup" aria-label="Lưới crop">
        {GRIDS.map((g) => (
          <button
            key={g.id}
            type="button"
            role="radio"
            aria-checked={grid === g.id}
            title={g.title}
            onClick={() => setGrid(g.id)}
            className={`h-7 w-7 font-mono ${
              grid === g.id ? 'bg-amber-500 font-semibold text-zinc-950' : 'bg-zinc-900 text-zinc-300 hover:text-amber-300'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setStraighten((v) => !v)}
        title="Kéo một đường dọc theo đường chân trời hoặc cạnh tường, ảnh sẽ xoay cho thẳng"
        className={`h-7 rounded border px-2 ${
          straighten ? 'border-amber-400 bg-amber-500/20 text-amber-300' : 'border-zinc-700 bg-zinc-900 hover:border-amber-400 hover:text-amber-300'
        }`}
      >
        📐 Làm thẳng
      </button>
      <span className="w-14 text-right font-mono text-zinc-400" title="Góc xoay hiện tại">
        {draft.rotationDeg.toFixed(1)}°
      </span>
      <button
        type="button"
        onClick={() => {
          setCrop(FULL_CROP_BOX);
          setDraft(xf);
        }}
        title="Bỏ thay đổi trong lần crop này"
        className="h-7 rounded border border-zinc-700 bg-zinc-900 px-2 hover:border-amber-400 hover:text-amber-300"
      >
        Đặt lại
      </button>
      <button
        type="button"
        onClick={onClose}
        title="Hủy (Esc)"
        className="h-7 rounded border border-zinc-700 bg-zinc-900 px-2 hover:border-amber-400 hover:text-amber-300"
      >
        Hủy
      </button>
      <button
        type="button"
        onClick={apply}
        disabled={!photo}
        title="Áp dụng (Enter)"
        className="h-7 rounded bg-amber-500 px-3 font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
      >
        ✓ Áp dụng
      </button>
    </div>
  );

  const handleCls = 'absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-zinc-950 bg-white shadow';
  const handlePos: Record<Handle, [number, number, string]> = {
    nw: [0, 0, 'cursor-nwse-resize'],
    n: [0.5, 0, 'cursor-ns-resize'],
    ne: [1, 0, 'cursor-nesw-resize'],
    e: [1, 0.5, 'cursor-ew-resize'],
    se: [1, 1, 'cursor-nwse-resize'],
    s: [0.5, 1, 'cursor-ns-resize'],
    sw: [0, 1, 'cursor-nesw-resize'],
    w: [0, 0.5, 'cursor-ew-resize'],
  };

  return (
    <div
      ref={rootRef}
      data-testid="crop-overlay"
      className={`absolute inset-0 z-20 overflow-hidden bg-zinc-950 select-none ${straighten ? 'cursor-crosshair' : 'cursor-alias'}`}
      onPointerDown={onRootDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {/* The photo as the slot shows it, whole (also past the slot frame) */}
      {photo && fw > 0 && (
        <div
          className="pointer-events-none absolute bg-zinc-800"
          style={{
            left: ox + draft.x * fw - fw / 2,
            top: oy + draft.y * fh - fh / 2,
            width: fw,
            height: fh,
            transform: `rotate(${draft.rotationDeg}deg) scale(${draft.scale})`,
            transformOrigin: '50% 50%',
            backgroundImage: picture ? `url(${picture})` : undefined,
            backgroundSize: '100% 100%',
          }}
        />
      )}

      {/* Slot frame: where the photo will be shown */}
      <div
        className="pointer-events-none absolute border border-dashed border-white/30"
        style={{ left: fx, top: fy, width: fw, height: fh }}
      />

      {photo && fw > 0 && (
        <div
          className={`absolute border border-white ${straighten ? 'pointer-events-none' : 'cursor-move'}`}
          style={{ left: bx, top: by, width: bw, height: bh, boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)' }}
          onPointerDown={(e) => {
            const p = local(e);
            start({ kind: 'move', sx: p.x, sy: p.y, start: c })(e);
          }}
          title="Kéo để dời khung • kéo cạnh/góc để đổi cỡ • kéo bên ngoài khung để xoay ảnh"
        >
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">
            {gridLines(grid).map(([x1, y1, x2, y2], i) => (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(255,255,255,0.55)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          {!straighten &&
            HANDLES.map((h) => {
              const [u, v, cursor] = handlePos[h];
              return (
                <div
                  key={h}
                  data-handle={h}
                  className={`${handleCls} ${cursor}`}
                  style={{ left: `${u * 100}%`, top: `${v * 100}%` }}
                  onPointerDown={start({ kind: 'resize', handle: h })}
                />
              );
            })}
        </div>
      )}

      {line && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="rgb(251,191,36)" strokeWidth={2} />
        </svg>
      )}

      {!photo && (
        <div className="absolute inset-x-0 top-1/2 text-center text-xs text-amber-300">
          Ô này chưa có ảnh. Chọn ô có ảnh trên thẻ scene.
        </div>
      )}

      {toolSlot ? (
        createPortal(toolbar, toolSlot)
      ) : (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md border border-zinc-700 bg-zinc-950/90 px-2 py-1">
          {toolbar}
        </div>
      )}
    </div>
  );
}
