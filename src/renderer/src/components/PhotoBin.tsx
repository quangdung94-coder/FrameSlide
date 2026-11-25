import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { buildPhotoTree, flattenPhotoTree, type TrayRow } from './photoTree';
import { useContextMenu, type MenuItem } from './ContextMenu';
import { useAppStore } from '../store/useAppStore';
import type { SlideAsset, SortOrder } from '@shared/types';

interface PhotoBinProps {
  disabled: boolean;
  /** Tray width in px (resizable, saved with the layout). */
  width?: number;
  /** Drag handle shown on the right edge while the tray is expanded. */
  resizeHandle?: React.ReactNode;
}

type PhotoFilter = 'all' | 'unused' | 'portrait' | 'landscape';

const GRID_PAD = 8;
const GRID_GAP = 8;
const FOLDER_ROW_H = 28;
const CARD_LABEL_H = 22;
const MIN_CARD_W = 92;
const OVERSCAN_PX = 400;

interface PhotoCardProps {
  photo: SlideAsset;
  width: number;
  usedIn: string[] | undefined;
  isSelected: boolean;
  disabled: boolean;
  onClick: (e: React.MouseEvent, photoId: string) => void;
  onContextMenu: (e: React.MouseEvent, photoId: string) => void;
  onRemove: (photoId: string) => void;
}

const PhotoCard = memo(function PhotoCard({
  photo: p,
  width,
  usedIn,
  isSelected,
  disabled,
  onClick,
  onContextMenu,
  onRemove,
}: PhotoCardProps) {
  const rot = p.rotationDeg ?? 0;
  const exp = p.exposure ?? 0;
  const used = usedIn ?? [];
  return (
    <div
      draggable={!disabled}
      onClick={(e) => onClick(e, p.id)}
      onContextMenu={(e) => onContextMenu(e, p.id)}
      onDragStart={(e) => {
        e.dataTransfer.setData(
          'application/x-frameslide',
          JSON.stringify({ kind: 'bin-photo', photoId: p.id })
        );
      }}
      title={`${p.name} (${p.width}×${p.height})`}
      style={{ width }}
      className={`group relative shrink-0 cursor-grab overflow-hidden rounded border transition ${
        isSelected
          ? 'border-amber-400 ring-1 ring-amber-400 bg-zinc-800'
          : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
      }`}
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-zinc-950">
        <img
          src={p.thumbUrl}
          alt={p.name}
          draggable={false}
          loading="lazy"
          decoding="async"
          style={rot ? { transform: `rotate(${rot}deg)` } : undefined}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex items-center justify-between px-1.5 py-1 text-xs">
        <span className="truncate text-zinc-300">{p.name}</span>
        <span className="ml-1 shrink-0 text-zinc-500">
          {p.orientation === 'portrait' ? 'Dọc' : 'Ngang'}
        </span>
      </div>

      {used.length > 0 ? (
        <span className="absolute top-1 left-1 max-w-[80%] truncate rounded bg-emerald-500 px-1 text-xs font-bold text-zinc-950">
          {used.join(',')}
        </span>
      ) : (
        <span className="absolute top-1 left-1 rounded bg-black/75 px-1 text-xs text-zinc-300">
          Chưa dùng
        </span>
      )}

      {(rot !== 0 || Math.abs(exp) > 0.05) && (
        <span className="absolute bottom-6 left-1 rounded bg-amber-500/90 px-1 text-2xs font-bold text-zinc-950">
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
            onRemove(p.id);
          }}
          className="absolute top-1 right-1 hidden h-4 w-4 items-center justify-center rounded bg-black/80 text-xs text-zinc-300 hover:bg-red-500 hover:text-white group-hover:flex"
        >
          ×
        </button>
      )}
    </div>
  );
});

export function PhotoBin({ disabled, width = 224, resizeHandle }: PhotoBinProps) {
  const slides = useAppStore((s) => s.slides);
  const scenes = useAppStore((s) => s.scenes);
  const selectedPhotoId = useAppStore((s) => s.selectedPhotoId);
  const selectedPhotoIds = useAppStore((s) => s.selectedPhotoIds);
  const setPhotoSelection = useAppStore((s) => s.setPhotoSelection);
  const setInspectorScope = useAppStore((s) => s.setInspectorScope);
  const appendScenesForPhotos = useAppStore((s) => s.appendScenesForPhotos);
  const selectSceneAndSeek = useAppStore((s) => s.selectSceneAndSeek);
  const removePhoto = useAppStore((s) => s.removePhoto);
  const sortSlides = useAppStore((s) => s.sortSlides);
  const assignPhotoToSlot = useAppStore((s) => s.assignPhotoToSlot);
  const rotatePhoto90 = useAppStore((s) => s.rotatePhoto90);
  const { menu, openAt } = useContextMenu();

  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState<PhotoFilter>('all');
  const anchorIdRef = useRef<string | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => new Set());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 224, height: 600 });
  const [scrollTop, setScrollTop] = useState(0);

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

  const tree = useMemo(() => buildPhotoTree(filteredSlides), [filteredSlides]);
  const showFolders = tree.length > 1 || (tree[0]?.children.length ?? 0) > 0;

  // Layout of the virtual grid: how many thumbnails fit per row at the current tray width.
  const innerW = Math.max(60, viewport.width - GRID_PAD * 2);
  const cols = Math.max(1, Math.floor((innerW + GRID_GAP) / (MIN_CARD_W + GRID_GAP)));
  const cardW = Math.floor((innerW - GRID_GAP * (cols - 1)) / cols);
  const photoRowH = Math.round((cardW * 3) / 4) + CARD_LABEL_H + 2 + GRID_GAP;

  const rows: TrayRow[] = useMemo(() => {
    if (showFolders) return flattenPhotoTree(tree, collapsedFolders, cols);
    const flat: TrayRow[] = [];
    for (let i = 0; i < filteredSlides.length; i += cols) {
      flat.push({ kind: 'photos', photos: filteredSlides.slice(i, i + cols), depth: 0 });
    }
    return flat;
  }, [showFolders, tree, collapsedFolders, cols, filteredSlides]);

  const rowOffsets = useMemo(() => {
    const offs = new Array<number>(rows.length + 1);
    offs[0] = 0;
    rows.forEach((r, i) => {
      offs[i + 1] = offs[i] + (r.kind === 'folder' ? FOLDER_ROW_H : photoRowH);
    });
    return offs;
  }, [rows, photoRowH]);
  const totalH = rowOffsets[rows.length] ?? 0;

  // Only rows near the visible area are mounted, so 500+ photos stay smooth.
  const [firstRow, lastRow] = useMemo(() => {
    const top = Math.max(0, scrollTop - OVERSCAN_PX);
    const bottom = scrollTop + viewport.height + OVERSCAN_PX;
    let lo = 0;
    let hi = rows.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (rowOffsets[mid + 1] <= top) lo = mid + 1;
      else hi = mid;
    }
    let end = lo;
    while (end < rows.length && rowOffsets[end] < bottom) end++;
    return [lo, end];
  }, [rows.length, rowOffsets, scrollTop, viewport.height]);

  /** Photo order as shown on screen (used for Shift+click ranges). */
  const visualOrder = useMemo(
    () => (showFolders ? tree.flatMap((n) => n.allPhotoIds) : filteredSlides.map((p) => p.id)),
    [showFolders, tree, filteredSlides]
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewport({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [collapsed]);

  const toggleFolder = (key: string) =>
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const selectedSet = useMemo(() => new Set(selectedPhotoIds), [selectedPhotoIds]);
  const unusedIds = useMemo(
    () => slides.filter((p) => (usageMap.get(p.id)?.length ?? 0) === 0).map((p) => p.id),
    [slides, usageMap]
  );

  const handlePhotoClick = (e: React.MouseEvent, photoId: string) => {
    if (e.shiftKey && anchorIdRef.current) {
      const order = visualOrder;
      const a = order.indexOf(anchorIdRef.current);
      const b = order.indexOf(photoId);
      if (a >= 0 && b >= 0) {
        const [from, to] = a <= b ? [a, b] : [b, a];
        setPhotoSelection(order.slice(from, to + 1), photoId);
        setInspectorScope('photo');
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
      setInspectorScope('photo');
      return;
    }
    const onlyThis = selectedPhotoIds.length === 1 && selectedPhotoIds[0] === photoId;
    setPhotoSelection(onlyThis ? [] : [photoId], onlyThis ? null : photoId);
    setInspectorScope(onlyThis ? 'scene' : 'photo');
  };

  const handlePhotoContext = (e: React.MouseEvent, photoId: string) => {
    // Right-clicking a photo outside the current selection selects just that photo.
    const inSelection = selectedSet.has(photoId);
    const ids = inSelection ? selectedPhotoIds : [photoId];
    if (!inSelection) {
      anchorIdRef.current = photoId;
      setPhotoSelection([photoId], photoId);
    }
    const st = useAppStore.getState();
    const photo = st.slides.find((x) => x.id === photoId);
    const many = ids.length > 1;
    const items: MenuItem[] = [
      {
        label: many ? `Thêm ${ids.length} ảnh vào cuối timeline` : 'Thêm vào cuối timeline',
        onClick: () => addToTimeline(ids),
        disabled,
      },
      {
        label: 'Thêm vào scene đang chọn',
        onClick: () => {
          const cur = useAppStore.getState();
          if (cur.activeSceneId) assignPhotoToSlot(cur.activeSceneId, cur.activeSlotIndex, photoId);
        },
        disabled: disabled || !st.activeSceneId,
      },
      { separator: true, label: '' },
      { label: 'Xoay 90°', onClick: () => rotatePhoto90(photoId), disabled },
      {
        label: 'Mở thư mục chứa ảnh',
        onClick: () => {
          if (photo?.originalPath) void window.frameSlideAPI?.revealInFolder(photo.originalPath);
        },
        disabled: !window.frameSlideAPI || !photo?.originalPath,
      },
      { separator: true, label: '' },
      {
        label: many ? `Xóa ${ids.length} ảnh khỏi khay` : 'Xóa ảnh khỏi khay',
        danger: true,
        onClick: () => ids.forEach((id) => removePhoto(id)),
        disabled,
      },
    ];
    openAt(e, items);
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
          className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-xs text-zinc-300 hover:border-amber-400 hover:text-amber-300"
        >
          ▶
        </button>
        <div
          className="mt-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase"
          style={{ writingMode: 'vertical-rl' }}
        >
          Khay ảnh ({slides.length})
        </div>
      </aside>
    );
  }

  return (
    <>
    <aside
      className="flex shrink-0 flex-col bg-[#141419] text-xs"
      style={{ width }}
    >
      <div className="border-b border-zinc-800 bg-[#16161b] px-2.5 py-2">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              title="Thu gọn Khay ảnh để rộng màn hình Preview"
              className="rounded border border-zinc-800 px-1 py-0.5 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            >
              ◀
            </button>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
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
            className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-xs text-zinc-300"
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
        <div className="mt-1.5 flex flex-wrap gap-1 text-xs">
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

      <div
        ref={scrollRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="relative flex-1 overflow-y-auto"
      >
        {filteredSlides.length === 0 ? (
          <div className="py-6 text-center text-xs text-zinc-500">
            {slides.length === 0 ? 'Chưa có ảnh nào.' : 'Không có ảnh khớp bộ lọc.'}
          </div>
        ) : (
          <div style={{ height: totalH + GRID_PAD * 2, position: 'relative' }}>
            {rows.slice(firstRow, lastRow).map((row, i) => {
              const rowIdx = firstRow + i;
              const top = rowOffsets[rowIdx] + GRID_PAD;
              if (row.kind === 'folder') {
                const n = row.node;
                const unusedInFolder = n.allPhotoIds.filter(
                  (id) => (usageMap.get(id)?.length ?? 0) === 0
                );
                return (
                  <div
                    key={`f:${n.key}`}
                    style={{
                      top,
                      height: FOLDER_ROW_H - 4,
                      left: GRID_PAD + Math.min(n.depth, 5) * 10,
                      right: GRID_PAD,
                    }}
                    className="group absolute flex items-center gap-1 rounded bg-zinc-900/80 pr-1 text-xs text-zinc-300 hover:bg-zinc-800"
                  >
                    <button
                      type="button"
                      onClick={() => toggleFolder(n.key)}
                      title={row.collapsed ? 'Mở thư mục' : 'Thu thư mục'}
                      className="flex min-w-0 flex-1 items-center gap-1 px-1 py-0.5 text-left"
                    >
                      <span className="w-3 shrink-0 text-xs text-zinc-500">
                        {row.collapsed ? '▶' : '▼'}
                      </span>
                      <span className="shrink-0">📁</span>
                      <span className="truncate font-medium" title={n.label}>
                        {n.label}
                      </span>
                      <span className="shrink-0 text-xs text-zinc-500">
                        ({n.allPhotoIds.length})
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={disabled || unusedInFolder.length === 0}
                      onClick={() => addToTimeline(unusedInFolder)}
                      title={
                        unusedInFolder.length === 0
                          ? 'Mọi ảnh trong thư mục này đã có trên timeline'
                          : `Đưa ${unusedInFolder.length} ảnh chưa dùng của thư mục này lên cuối timeline`
                      }
                      className="shrink-0 rounded border border-zinc-700 px-1 text-xs text-zinc-300 hover:border-amber-400 hover:text-amber-300 disabled:opacity-30"
                    >
                      + Thêm
                    </button>
                  </div>
                );
              }
              return (
                <div
                  key={`p:${row.photos[0]?.id ?? rowIdx}`}
                  style={{ top, left: GRID_PAD, right: GRID_PAD, gap: GRID_GAP }}
                  className="absolute flex"
                >
                  {row.photos.map((p) => (
                    <PhotoCard
                      key={p.id}
                      photo={p}
                      width={cardW}
                      usedIn={usageMap.get(p.id)}
                      isSelected={selectedSet.has(p.id) || selectedPhotoId === p.id}
                      disabled={disabled}
                      onClick={handlePhotoClick}
                      onContextMenu={handlePhotoContext}
                      onRemove={removePhoto}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-zinc-800 bg-[#16161b] p-2">
        <button
          type="button"
          disabled={disabled || selectedPhotoIds.length === 0}
          onClick={() => addToTimeline(selectedPhotoIds)}
          title="Đưa các ảnh đang chọn lên cuối timeline (giữ Ctrl để chọn nhiều, Shift để chọn một dãy)"
          className="rounded bg-amber-500 px-2 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
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
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs font-medium text-zinc-200 hover:border-amber-400 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Thêm cả thư mục{unusedIds.length > 0 ? ` (${unusedIds.length})` : ''}
        </button>
      </div>
    </aside>
    {resizeHandle}
      {menu}
    </>
  );
}
