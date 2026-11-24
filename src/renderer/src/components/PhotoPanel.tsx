import { getExportResolution } from '@engine/capabilities';
import { KEYFRAME_EASE_LABELS, KEYFRAME_EASES } from '@engine/photoKeyframes';
import { IDENTITY_PHOTO_TRANSFORM, normalizePhotoTransform } from '@engine/photoTransform';
import type { PhotoKeyframeEase, PhotoTransform, SlideAsset } from '@shared/types';
import { useAppStore } from '../store/useAppStore';
import { Group, SliderRow } from './ui';

const BTN =
  'h-8 rounded border border-zinc-700 bg-zinc-800 px-2 text-xs text-zinc-100 hover:border-amber-400 disabled:opacity-40';

/** Small picture of the photo at one keyframe (approximation: move / zoom / rotate of the thumbnail). */
function KeyframeMini({
  photo,
  xf,
  label,
  active,
  aspect,
  disabled,
  onClick,
}: {
  photo: SlideAsset;
  xf: PhotoTransform;
  label: string;
  active: boolean;
  aspect: number;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={`Chỉnh tư thế ${label.toLowerCase()} trên khung xem`}
      className={`flex flex-1 flex-col gap-1 rounded border p-1 text-xs transition disabled:opacity-40 ${
        active ? 'border-amber-400 bg-amber-500/10 text-amber-300' : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600'
      }`}
    >
      <div className="relative w-full overflow-hidden rounded-sm bg-zinc-950" style={{ aspectRatio: String(aspect) }}>
        <img
          src={photo.thumbUrl}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            transform: `translate(${xf.x * 100}%, ${xf.y * 100}%) scale(${xf.scale}) rotate(${xf.rotationDeg}deg)`,
          }}
        />
      </div>
      <span className="text-center font-semibold">{label}</span>
    </button>
  );
}

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
  const keyframeEditPhase = useAppStore((s) => s.keyframeEditPhase);
  const setKeyframeEditPhase = useAppStore((s) => s.setKeyframeEditPhase);
  const enablePhotoKeyframes = useAppStore((s) => s.enablePhotoKeyframes);
  const setPhotoTransformEnd = useAppStore((s) => s.setPhotoTransformEnd);
  const setPhotoKeyframeEase = useAppStore((s) => s.setPhotoKeyframeEase);
  const swapPhotoKeyframes = useAppStore((s) => s.swapPhotoKeyframes);
  const copyPhotoKeyframe = useAppStore((s) => s.copyPhotoKeyframe);
  const chainFromPrevious = useAppStore((s) => s.chainPhotoKeyframeFromPrevious);
  const outputAspect = useAppStore((s) => s.renderParams.outputAspect);
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

      <Group
        id="photo-keyframes"
        title="Chuyển động Đầu → Cuối"
        defaultOpen={false}
        disabled={disabled}
        enabled={Boolean(photo.transformEnd)}
        onToggle={(on) => {
          if (on) {
            enablePhotoKeyframes(photo.id);
            setKeyframeEditPhase('end');
          } else {
            setPhotoTransformEnd(photo.id, null);
            setKeyframeEditPhase('start');
          }
        }}
        onReset={() => setPhotoTransformEnd(photo.id, null)}
        resetTitle="Tắt chuyển động Đầu → Cuối của ảnh này"
      >
        {photo.transformEnd ? (
          (() => {
            const res = getExportResolution(outputAspect);
            const aspect = res.width / res.height;
            const startXf = normalizePhotoTransform(photo.transform);
            const endXf = normalizePhotoTransform(photo.transformEnd);
            const pick = (phase: 'start' | 'end') => {
              setKeyframeEditPhase(phase);
              onStartTransformEdit();
            };
            return (
              <>
                <div className="flex gap-2">
                  <KeyframeMini photo={photo} xf={startXf} label="Đầu" aspect={aspect} active={keyframeEditPhase === 'start'} disabled={disabled} onClick={() => pick('start')} />
                  <KeyframeMini photo={photo} xf={endXf} label="Cuối" aspect={aspect} active={keyframeEditPhase === 'end'} disabled={disabled} onClick={() => pick('end')} />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button type="button" disabled={disabled} onClick={() => swapPhotoKeyframes(photo.id)} className={BTN} title="Đổi chỗ tư thế Đầu và Cuối">
                    ⇄ Đổi chiều
                  </button>
                  <button type="button" disabled={disabled} onClick={() => copyPhotoKeyframe(photo.id, 'start')} className={BTN} title="Cho tư thế Cuối giống tư thế Đầu">
                    Đầu → Cuối
                  </button>
                  <button
                    type="button"
                    disabled={disabled || !activeSceneId}
                    onClick={() => activeSceneId && chainFromPrevious(activeSceneId, activeSlotIndex)}
                    className={`${BTN} col-span-2`}
                    title="Lấy tư thế Cuối của ảnh ở scene trước làm tư thế Đầu, để chuyển động liền mạch"
                  >
                    ⤺ Nối với scene trước
                  </button>
                </div>
                <label className="flex flex-col gap-1 text-xs text-zinc-400">
                  Kiểu làm mượt
                  <select
                    value={photo.keyframeEase ?? 'smooth'}
                    disabled={disabled}
                    onChange={(e) => setPhotoKeyframeEase(photo.id, e.target.value as PhotoKeyframeEase)}
                    className="h-8 w-full rounded border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100 disabled:opacity-40"
                  >
                    {KEYFRAME_EASES.map((id) => (
                      <option key={id} value={id}>
                        {KEYFRAME_EASE_LABELS[id]}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-xs text-zinc-500">
                  Chuyển động này cộng thêm vào chuyển động của template. Muốn chỉ dùng Đầu → Cuối, đặt hướng chuyển động của scene là "Đứng yên".
                </p>
              </>
            );
          })()
        ) : (
          <p className="text-xs text-zinc-500">
            Bật công tắc để tự đạo diễn chuyển động của ảnh: chọn tư thế Đầu và Cuối (vị trí, phóng to, xoay), ảnh sẽ trôi từ Đầu sang Cuối trong suốt scene.
          </p>
        )}
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
