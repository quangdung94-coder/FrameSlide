import { IDENTITY_PHOTO_TRANSFORM } from '@engine/photoTransform';
import type { SlideAsset } from '@shared/types';
import { useAppStore } from '../store/useAppStore';
import { Group, SliderRow } from './ui';

const BTN =
  'h-8 rounded border border-zinc-700 bg-zinc-800 px-2 text-xs text-zinc-100 hover:border-amber-400 disabled:opacity-40';

interface PhotoPanelProps {
  photo: SlideAsset | null;
  disabled: boolean;
  focalPickMode: boolean;
  onToggleFocalPick: () => void;
  onStartTransformEdit: () => void;
  focalSuffix: string;
}

/** Right-hand panel for the selected photo (rescue, position/zoom on the preview, removal). */
export function PhotoPanel({
  photo,
  disabled,
  focalPickMode,
  onToggleFocalPick,
  onStartTransformEdit,
  focalSuffix,
}: PhotoPanelProps) {
  const rotatePhoto90 = useAppStore((s) => s.rotatePhoto90);
  const setPhotoExposure = useAppStore((s) => s.setPhotoExposure);
  const setPhotoTransform = useAppStore((s) => s.setPhotoTransform);
  const activeSceneId = useAppStore((s) => s.activeSceneId);
  const activeSlotIndex = useAppStore((s) => s.activeSlotIndex);
  const assignPhotoToSlot = useAppStore((s) => s.assignPhotoToSlot);
  const inSlot = useAppStore((s) => {
    const sc = s.scenes.find((x) => x.id === s.activeSceneId);
    return Boolean(photo && sc && sc.slots[s.activeSlotIndex] === photo.id);
  });

  if (!photo) {
    return (
      <p className="text-xs text-zinc-500">
        Chưa chọn ảnh. Bấm một ảnh trong khay hoặc trong ô của scene để chỉnh riêng ảnh đó.
      </p>
    );
  }

  return (
    <>
      <Group
        id="photo-rescue"
        title="Cứu ảnh nhanh"
        accent
        disabled={disabled}
        onReset={() => setPhotoExposure(photo.id, 0)}
        resetTitle="Đặt độ sáng ảnh về 0"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-zinc-400" title={photo.name}>
            {photo.name}
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => rotatePhoto90(photo.id)}
            title="Xoay ảnh 90° theo chiều kim đồng hồ"
            className={`${BTN} shrink-0`}
          >
            ↻ Xoay 90° ({photo.rotationDeg ?? 0}°)
          </button>
        </div>
        <SliderRow
          label="Độ sáng ảnh (Exposure EV)"
          value={photo.exposure ?? 0}
          min={-1.5}
          max={1.5}
          step={0.05}
          disabled={disabled}
          onChange={(v) => setPhotoExposure(photo.id, v)}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={onToggleFocalPick}
          className={`h-8 w-full rounded border px-2 text-xs font-medium ${
            focalPickMode
              ? 'border-amber-400 bg-amber-500/20 text-amber-300'
              : 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
          }`}
        >
          {focalPickMode
            ? `Đang chọn tâm${focalSuffix}: bấm lên khung xem…`
            : `Tâm điểm${focalSuffix} (${Math.round(photo.focalPoint.x * 100)}%, ${Math.round(photo.focalPoint.y * 100)}%)`}
        </button>
      </Group>

      <Group
        id="photo-transform"
        title="Vị trí, phóng to, xoay"
        disabled={disabled}
        onReset={() => setPhotoTransform(photo.id, { ...IDENTITY_PHOTO_TRANSFORM }, true)}
        resetTitle="Đưa ảnh về đúng chỗ ban đầu"
      >
        <button type="button" disabled={disabled} onClick={onStartTransformEdit} className={`${BTN} w-full`}>
          ✥ Chỉnh trực tiếp trên khung xem
        </button>
        <p className="text-xs text-zinc-500">
          Kéo để di chuyển, tay nắm tròn để xoay, tay nắm vuông hoặc lăn chuột để phóng to.
        </p>
      </Group>

      {inSlot && activeSceneId && (
        <Group id="photo-slot" title={`Ô ${activeSlotIndex + 1} của scene`} defaultOpen={false}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => assignPhotoToSlot(activeSceneId, activeSlotIndex, null)}
            className="h-8 w-full rounded border border-red-500/40 bg-red-950/30 px-2 text-xs text-red-300 hover:bg-red-950/60 disabled:opacity-40"
          >
            Gỡ ảnh khỏi ô này
          </button>
        </Group>
      )}
    </>
  );
}
