import { IDENTITY_PHOTO_TRANSFORM } from '@engine/photoTransform';
import type { SlideAsset } from '@shared/types';
import { useAppStore } from '../store/useAppStore';

interface Props {
  photo: SlideAsset;
  disabled: boolean;
  focalPickMode: boolean;
  onEdit: () => void;
  onToggleFocalPick: () => void;
}

/** Floating bar on the preview for the selected photo: edit, focal point, rotate, exposure, reset. */
export function PhotoQuickBar({ photo, disabled, focalPickMode, onEdit, onToggleFocalPick }: Props) {
  const rotatePhoto90 = useAppStore((s) => s.rotatePhoto90);
  const setPhotoExposure = useAppStore((s) => s.setPhotoExposure);
  const setPhotoTransform = useAppStore((s) => s.setPhotoTransform);

  return (
    <div
      role="toolbar"
      aria-label="Chỉnh nhanh ảnh đang chọn"
      className="absolute top-2.5 right-2.5 z-20 flex items-center gap-0.5 rounded-md border border-zinc-700 bg-black/80 p-0.5 text-xs text-zinc-200 shadow-lg backdrop-blur-sm"
    >
      {(
        [
          {
            key: 'edit',
            label: '✥ Chỉnh',
            title: 'Kéo trực tiếp trên khung xem để di chuyển, phóng to, xoay ảnh',
            active: false,
            onClick: onEdit,
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
          className={`h-8 rounded px-2.5 font-medium transition disabled:opacity-40 ${
            b.active
              ? 'bg-amber-500/25 text-amber-300'
              : 'hover:bg-zinc-800 hover:text-amber-300'
          }`}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
