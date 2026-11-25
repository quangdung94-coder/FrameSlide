import { TEXT_ANIMATIONS } from '@engine/textAnimation';
import type { TextAnimationId, TextStyleId, TextTimingMode } from '@shared/types';
import { useAppStore } from '../../store/useAppStore';
import { CheckField, Group, SelectField, SliderRow, TextField, type SelectOption } from '../ui';

const STYLE_OPTIONS: SelectOption<TextStyleId>[] = [
  { value: 'none', label: 'Tắt chữ' },
  { value: 'date-stamp-90s', label: 'Date Stamp 90s (Cam điện tử)' },
  { value: 'minimal-fade', label: 'Minimal Title (Hiện đại)' },
  { value: 'editorial-serif', label: 'Editorial Serif (Phim cưới)' },
  { value: 'filmstrip-label', label: 'Filmstrip Label (Viền phim)' },
  { value: 'lower-third', label: 'Lower Third (Góc trái dưới)' },
];

const TIMING_OPTIONS: SelectOption<TextTimingMode>[] = [
  { value: 'always', label: 'Suốt clip (Hợp Date Stamp)' },
  { value: 'intro', label: 'Chỉ Scene đầu (Intro + Fade)' },
  { value: 'outro', label: 'Chỉ Scene cuối (Outro + Fade)' },
  { value: 'per-scene', label: 'Chú thích riêng từng Scene' },
];

const ANIMATION_OPTIONS: SelectOption<TextAnimationId>[] = TEXT_ANIMATIONS.map((a) => ({ value: a.id, label: a.label }));

interface Props {
  disabled: boolean;
  textDragMode: boolean;
  onToggleTextDrag: () => void;
}

/** Project › Chữ tab: title / subtitle / date stamp overlay, entry animation and position. */
export function TextTab({ disabled, textDragMode, onToggleTextDrag }: Props) {
  const textOverlay = useAppStore((s) => s.renderParams.textOverlay);
  const updateTextOverlay = useAppStore((s) => s.updateTextOverlay);
  const setInspectorScope = useAppStore((s) => s.setInspectorScope);
  const textOff = textOverlay.style === 'none' || disabled;

  return (
    <Group id="text-main" title="Chữ & Date Stamp (Tiếng Việt)" accent>
      <SelectField
        label="Kiểu hiển thị"
        value={textOverlay.style}
        options={STYLE_OPTIONS}
        disabled={disabled}
        onChange={(style) => updateTextOverlay({ style })}
      />

      <SelectField
        label="Thời điểm hiện chữ (có Fade mượt)"
        value={textOverlay.timing ?? 'always'}
        options={TIMING_OPTIONS}
        disabled={textOff}
        onChange={(timing) => updateTextOverlay({ timing })}
      />

      <SelectField
        label="Chuyển động khi chữ hiện ra"
        value={textOverlay.animation ?? 'fade'}
        options={ANIMATION_OPTIONS}
        disabled={textOff}
        onChange={(animation) => updateTextOverlay({ animation })}
      />

      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={textOff}
          onClick={onToggleTextDrag}
          title="Kéo chữ trực tiếp trên khung xem"
          className={`h-8 flex-1 rounded border px-2 text-xs disabled:opacity-40 ${
            textDragMode
              ? 'border-amber-400 bg-amber-500/20 text-amber-200'
              : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-amber-400'
          }`}
        >
          ✥ Kéo chữ trên khung xem
        </button>
        {textOverlay.offset && (textOverlay.offset.x !== 0 || textOverlay.offset.y !== 0) && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateTextOverlay({ offset: undefined })}
            title="Trả chữ về vị trí gốc của kiểu chữ"
            className="h-8 rounded border border-zinc-700 px-2 text-xs text-zinc-300 hover:border-amber-400 disabled:opacity-40"
          >
            ⟲ Vị trí
          </button>
        )}
      </div>

      {textOverlay.timing === 'per-scene' ? (
        <div className="flex items-center justify-between gap-2 rounded border border-amber-500/40 bg-amber-950/20 p-2 text-xs text-amber-200">
          <span>Chữ riêng từng scene được nhập ở bảng Scene.</span>
          <button
            type="button"
            onClick={() => setInspectorScope('scene')}
            className="h-8 shrink-0 rounded border border-amber-500/50 px-2 hover:bg-amber-500/20"
          >
            Mở bảng Scene
          </button>
        </div>
      ) : (
        <TextField
          label="Tiêu đề chính"
          value={textOverlay.title}
          disabled={textOff}
          onChange={(title) => updateTextOverlay({ title })}
        />
      )}

      <TextField
        label="Phụ đề / Địa điểm"
        value={textOverlay.subtitle}
        disabled={textOff}
        onChange={(subtitle) => updateTextOverlay({ subtitle })}
      />

      <CheckField
        label="Tự lấy ngày chụp EXIF theo từng Scene"
        checked={Boolean(textOverlay.autoExifDate)}
        disabled={textOff}
        onChange={(autoExifDate) => updateTextOverlay({ autoExifDate })}
      />

      <TextField
        label="Ngày tháng thủ công (Date Stamp)"
        value={textOverlay.dateText}
        mono
        disabled={textOff || Boolean(textOverlay.autoExifDate)}
        onChange={(dateText) => updateTextOverlay({ dateText })}
      />

      <SliderRow
        label="Độ rõ chữ (Opacity)"
        value={textOverlay.opacity}
        min={0.1}
        max={1}
        step={0.05}
        disabled={textOff}
        onChange={(opacity) => updateTextOverlay({ opacity })}
      />
    </Group>
  );
}
