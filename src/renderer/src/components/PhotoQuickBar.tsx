import { IDENTITY_PHOTO_TRANSFORM } from '@engine/photoTransform';
import type { SlideAsset } from '@shared/types';
import { useAppStore } from '../store/useAppStore';

interface Props {
  photo: SlideAsset | null;
  /** 1-based number of the photo in the tray, shown before its name. */
  photoNumber: number | null;
  disabled: boolean;
  focalPickMode: boolean;
  editMode: boolean;
  cropMode: boolean;
  onEdit: () => void;
  onCrop: () => void;
  onToggleFocalPick: () => void;
  /** While editing, the photo editor puts its exact-value fields into this slot of the strip. */
  onToolSlot: (el: HTMLDivElement | null) => void;
}

/**
 * Tool strip above the preview (Đợt 5.3c): it sits outside the picture so it never covers the
 * photo. Shows which photo is selected and quick edits for it: edit, focal point, rotate,
 * exposure, reset. Keeps its height when nothing is selected so the preview does not jump.
 */
export function PhotoQuickBar({ photo, photoNumber, disabled, focalPickMode, editMode, cropMode, onEdit, onCrop, onToggleFocalPick, onToolSlot }: Props) {
  const rotatePhoto90 = useAppStore((s) => s.rotatePhoto90);
  const setPhotoExposure = useAppStore((s) => s.setPhotoExposure);
  const setPhotoTransform = useAppStore((s) => s.setPhotoTransform);

  if (!photo) {
    return (
      <div className="flex h-10 shrink-0 items-center px-1 text-xs text-zinc-500">
        Chọn một ảnh trên thẻ scene hoặc khay ảnh để chỉnh nhanh.
      </div>
    );
  }

  const ev = photo.exposure ?? 0;

  return (
    <div
      role="toolbar"
      aria-label="Chỉnh nhanh ảnh đang chọn"
      className="flex h-10 shrink-0 items-center gap-1 text-sm text-zinc-200"
    >
      <span className="mr-1 min-w-0 truncate text-xs text-zinc-400" title={photo.name}>
        {photoNumber !== null && <span className="font-semibold text-zinc-200">Ảnh {photoNumber}</span>}
        {photoNumber !== null && ' · '}
        {photo.name}
      </span>
      {(editMode || cropMode) && <div ref={onToolSlot} className="ml-auto flex shrink-0 items-center gap-2 text-xs" />}
      <div className={`ml-auto flex shrink-0 items-center gap-1 ${editMode || cropMode ? 'hidden' : ''}`}>
      {(
        [
          {
            key: 'edit',
            label: '✥ Chỉnh',
            title: editMode
              ? 'Đang chỉnh ảnh trên khung xem • bấm lại để xong'
              : 'Kéo trực tiếp trên khung xem để di chuyển, phóng to, xoay ảnh',
            active: editMode,
            onClick: onEdit,
          },
          {
            key: 'crop',
            label: '⬚ Crop',
            title: 'Cắt khung kiểu Photoshop: lưới một phần ba, kéo góc để cắt, kéo ngoài khung để xoay, Làm thẳng',
            active: cropMode,
            onClick: onCrop,
          },
          {
            key: 'focal',
            label: '◎ Tâm',
            title: 'Bấm lên khung xem để đặt tâm điểm (phần quan trọng của ảnh)',
            active: focalPickMode,
            onClick: onToggleFocalPick,
          },
          {
            key: 'rot',
            label: '↻ 90°',
            title: 'Xoay ảnh 90° theo chiều kim đồng hồ',
            active: false,
            onClick: () => rotatePhoto90(photo.id),
          },
          {
            key: 'dark',
            label: '☀−',
            title: 'Tối đi 0.25 EV',
            active: false,
            onClick: () =>
              setPhotoExposure(
                photo.id,
                Math.max(-1.5, (photo.exposure ?? 0) - 0.25)
              ),
          },
          {
            key: 'bright',
            label: '☀+',
            title: 'Sáng lên 0.25 EV',
            active: false,
            onClick: () =>
              setPhotoExposure(
                photo.id,
                Math.min(1.5, (photo.exposure ?? 0) + 0.25)
              ),
          },
          {
            key: 'reset',
            label: '⟲',
            title: 'Đặt lại vị trí, phóng to, xoay tự do và độ sáng của ảnh này',
            active: false,
            onClick: () => {
              setPhotoExposure(photo.id, 0);
              setPhotoTransform(photo.id, { ...IDENTITY_PHOTO_TRANSFORM }, true);
            },
          },
        ] as const
      ).map((b) => (
        <button
          key={b.key}
          type="button"
          disabled={disabled}
          title={b.title}
          onClick={b.onClick}
          className={`h-8 rounded border px-3 font-medium transition disabled:opacity-40 ${
            b.active
              ? 'border-amber-400 bg-amber-500/20 text-amber-300'
              : 'border-zinc-700 bg-zinc-900 hover:border-amber-400 hover:text-amber-300'
          }`}
        >
          {b.label}
        </button>
      ))}
        <span
          className="w-14 text-right font-mono text-xs text-zinc-400"
          title="Độ sáng riêng của ảnh này (EV)"
        >
          {ev === 0 ? '0 EV' : `${ev > 0 ? '+' : ''}${ev.toFixed(2)}`}
        </span>
      </div>
    </div>
  );
}
