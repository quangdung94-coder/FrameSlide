import { useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { SortOrder } from '@shared/types';

interface PhotoBinProps {
  disabled: boolean;
}

type PhotoFilter = 'all' | 'unused' | 'portrait' | 'landscape';

export function PhotoBin({ disabled }: PhotoBinProps) {
  const slides = useAppStore((s) => s.slides);
  const scenes = useAppStore((s) => s.scenes);
  const selectedPhotoId = useAppStore((s) => s.selectedPhotoId);
  const selectedPhotoIds = useAppStore((s) => s.selectedPhotoIds);
  const setPhotoSelection = useAppStore((s) => s.setPhotoSelection);
  const appendScenesForPhotos = useAppStore((s) => s.appendScenesForPhotos);
  const selectSceneAndSeek = useAppStore((s) => s.selectSceneAndSeek);
  const removePhoto = useAppStore((s) => s.removePhoto);
  const sortSlides = useAppStore((s) => s.sortSlides);

  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState<PhotoFilter>('all');
  const anchorIdRef = useRef<string | null>(null);

  const usageMap = useMemo(() => {
    const map = new Map<string, string[]>();
    scenes.forEach((sc, idx) => {
      sc.slots.forEach((pid) => {
        if (!pid) return;
        const arr = map.get(pid) ?? [];
        const label = `S${idx + 1}`;
        if (!arr.includes(label)) arr.push(label);
        map.set(pid, arr);
      });
    });
    return map;
  }, [scenes]);

  const filteredSlides = useMemo(() => {
    return slides.filter((p) => {
      if (filter === 'unused') return (usageMap.get(p.id)?.length ?? 0) === 0;
      if (filter === 'portrait') return p.orientation === 'portrait';
      if (filter === 'landscape') return p.orientation !== 'portrait';
      return true;
    });
  }, [slides, filter, usageMap]);

  const selectedSet = useMemo(() => new Set(selectedPhotoIds), [selectedPhotoIds]);
  const unusedIds = useMemo(
    () => slides.filter((p) => (usageMap.get(p.id)?.length ?? 0) === 0).map((p) => p.id),
    [slides, usageMap]
  );

  const handlePhotoClick = (e: React.MouseEvent, photoId: string) => {
    if (e.shiftKey && anchorIdRef.current) {
      const order = filteredSlides.map((p) => p.id);
      const a = order.indexOf(anchorIdRef.current);
      const b = order.indexOf(photoId);
      if (a >= 0 && b >= 0) {
        const [from, to] = a <= b ? [a, b] : [b, a];
        setPhotoSelection(order.slice(from, to + 1), photoId);
        return;
      }
    }
    anchorIdRef.current = photoId;
    if (e.ctrlKey || e.metaKey) {
      if (selectedSet.has(photoId)) {
        const rest = selectedPhotoIds.filter((id) => id !== photoId);
        setPhotoSelection(rest, rest.length === 1 ? rest[0] : null);
      } else {
        setPhotoSelection([...selectedPhotoIds, photoId], photoId);
      }
      return;
    }
    const onlyThis = selectedPhotoIds.length === 1 && selectedPhotoIds[0] === photoId;
    setPhotoSelection(onlyThis ? [] : [photoId], onlyThis ? null : photoId);
  };

  const addToTimeline = (photoIds: string[]) => {
    const before = useAppStore.getState().scenes.length;
    const added = appendScenesForPhotos(photoIds);
    if (added === 0) return;
    const firstNew = useAppStore.getState().scenes[before];
    if (firstNew) selectSceneAndSeek(firstNew.id);
    setPhotoSelection([], null);
  };

  if (collapsed) {
    return (
      <aside className="flex w-9 shrink-0 flex-col items-center border-r border-zinc-800 bg-[#141419] py-2.5 text-xs">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title="Mở rộng Khay ảnh"
          className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-[11px] text-zinc-300 hover:border-amber-400 hover:text-amber-300"
        >
          ▶
        </button>
        <div
          className="mt-4 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase"
          style={{ writingMode: 'vertical-rl' }}
        >
          Khay ảnh ({slides.length})
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-[#141419] text-xs">
      <div className="border-b border-zinc-800 bg-[#16161b] px-2.5 py-2">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              title="Thu gọn Khay ảnh để rộng màn hình Preview"
              className="rounded border border-zinc-800 px-1 py-0.5 text-[10px] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            >
              ◀
            </button>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
              Khay ảnh ({slides.length})
            </span>
          </div>
          <select
            disabled={disabled || slides.length < 2}
            defaultValue="manual"
            onChange={(e) => {
              sortSlides(e.target.value as SortOrder);
              e.target.value = 'manual';
            }}
            className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-[10px] text-zinc-300"
          >
            <option value="manual" disabled>
              Sắp xếp
            </option>
            <option value="date-asc">Ngày ↑</option>
            <option value="date-desc">Ngày ↓</option>
            <option value="name-asc">Tên A-Z</option>
            <option value="name-desc">Tên Z-A</option>
          </select>
        </div>

        {/* Filter Pills */}
        <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
          {(
            [
              ['all', `Tất cả (${slides.length})`],
              ['unused', `Chưa dùng (${unusedIds.length})`],
              ['portrait', 'Dọc'],
              ['landscape', 'Ngang'],
            ] as [PhotoFilter, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded px-1.5 py-0.5 transition ${
                filter === id
                  ? 'bg-amber-500 font-semibold text-zinc-950'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid flex-1 grid-cols-2 content-start gap-2 overflow-y-auto p-2.5">
        {filteredSlides.length === 0 && (
          <div className="col-span-2 py-6 text-center text-[11px] text-zinc-500">
            {slides.length === 0 ? 'Chưa có ảnh nào.' : 'Không có ảnh khớp bộ lọc.'}
          </div>
        )}

        {filteredSlides.map((p) => {
          const usedIn = usageMap.get(p.id) ?? [];
          const isSelected = selectedSet.has(p.id) || selectedPhotoId === p.id;
          const rot = p.rotationDeg ?? 0;
          const exp = p.exposure ?? 0;

          return (
            <div
              key={p.id}
              draggable={!disabled}
              onClick={(e) => handlePhotoClick(e, p.id)}
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  'application/x-frameslide',
                  JSON.stringify({ kind: 'bin-photo', photoId: p.id })
                );
              }}
              title={`${p.name} (${p.width}×${p.height})`}
              className={`group relative cursor-grab overflow-hidden rounded border transition ${
                isSelected
                  ? 'border-amber-400 ring-1 ring-amber-400 bg-zinc-800'
                  : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
              }`}
            >
              <img
                src={p.thumbUrl}
                alt={p.name}
                draggable={false}
                style={rot ? { transform: `rotate(${rot}deg)` } : undefined}
                className="aspect-[4/3] w-full object-cover bg-zinc-950"
              />
              <div className="flex items-center justify-between px-1.5 py-1 text-[10px]">
                <span className="truncate text-zinc-300">{p.name}</span>
                <span className="ml-1 shrink-0 text-zinc-500">
                  {p.orientation === 'portrait' ? 'Dọc' : 'Ngang'}
                </span>
              </div>

              {usedIn.length > 0 ? (
                <span className="absolute top-1 left-1 rounded bg-emerald-500 px-1 text-[9px] font-bold text-zinc-950">
                  {usedIn.join(',')}
                </span>
              ) : (
                <span className="absolute top-1 left-1 rounded bg-black/75 px-1 text-[9px] text-zinc-300">
                  Chưa dùng
                </span>
              )}

              {(rot !== 0 || Math.abs(exp) > 0.05) && (
                <span className="absolute bottom-6 left-1 rounded bg-amber-500/90 px-1 text-[8px] font-bold text-zinc-950">
                  {rot ? `${rot}°` : ''}
                  {rot && Math.abs(exp) > 0.05 ? ' ' : ''}
                  {Math.abs(exp) > 0.05 ? `${exp > 0 ? '+' : ''}${exp.toFixed(1)}EV` : ''}
                </span>
              )}

              {!disabled && (
                <button
                  type="button"
                  title="Xóa ảnh khỏi khay"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePhoto(p.id);
                  }}
                  className="absolute top-1 right-1 hidden h-4 w-4 items-center justify-center rounded bg-black/80 text-[10px] text-zinc-300 hover:bg-red-500 hover:text-white group-hover:flex"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-1.5 border-t border-zinc-800 bg-[#16161b] p-2">
        <button
          type="button"
          disabled={disabled || selectedPhotoIds.length === 0}
          onClick={() => addToTimeline(selectedPhotoIds)}
          title="Đưa các ảnh đang chọn lên cuối timeline (giữ Ctrl để chọn nhiều, Shift để chọn một dãy)"
          className="rounded bg-amber-500 px-2 py-1.5 text-[11px] font-semibold text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Thêm ảnh đã chọn{selectedPhotoIds.length > 0 ? ` (${selectedPhotoIds.length})` : ''}
        </button>
        <button
          type="button"
          disabled={disabled || unusedIds.length === 0}
          onClick={() => addToTimeline(unusedIds)}
          title={
            unusedIds.length === 0
              ? 'Mọi ảnh trong khay đều đã có trên timeline'
              : 'Đưa tất cả ảnh chưa dùng trong khay lên cuối timeline'
          }
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[11px] font-medium text-zinc-200 hover:border-amber-400 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Thêm cả thư mục{unusedIds.length > 0 ? ` (${unusedIds.length})` : ''}
        </button>
      </div>
    </aside>
  );
}
