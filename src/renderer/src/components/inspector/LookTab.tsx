import { FILM_LOOK_PRESETS } from '@engine/presets/filmLookPresets';
import type { AspectMaskId, FilmLookParams } from '@shared/types';
import { useAppStore } from '../../store/useAppStore';
import { CheckField, Group, SelectField, SliderRow, type SelectOption } from '../ui';

type LookNumberKey = {
  [K in keyof FilmLookParams]: FilmLookParams[K] extends number ? K : never;
}[keyof FilmLookParams];

interface LookSlider {
  key: LookNumberKey;
  label: string;
  min: number;
  max: number;
}

/** Slider groups of the Film Look tuner (all step 0.02). */
const LOOK_GROUPS: { id: string; title: string; sliders: LookSlider[] }[] = [
  {
    id: 'look-color',
    title: 'Màu',
    sliders: [
      { key: 'intensity', label: 'Cường độ tổng', min: 0, max: 1 },
      { key: 'contrast', label: 'Contrast (Tương phản)', min: 0.75, max: 1.45 },
      { key: 'saturation', label: 'Saturation (Bão hòa)', min: 0, max: 1.4 },
      { key: 'fade', label: 'Fade (Bạc màu tối)', min: 0, max: 0.25 },
    ],
  },
  {
    id: 'look-light',
    title: 'Ánh sáng',
    sliders: [
      { key: 'halation', label: 'Halation (Đỏ cam)', min: 0, max: 1 },
      { key: 'bloom', label: 'Bloom (Tỏa sáng)', min: 0, max: 1 },
      { key: 'vignette', label: 'Vignette (Viền tối)', min: 0, max: 1 },
      { key: 'ambientLeak', label: 'Lóe sáng nền (Ambient Leak)', min: 0, max: 1 },
    ],
  },
  {
    id: 'look-grain',
    title: 'Hạt & Bụi',
    sliders: [
      { key: 'grain', label: 'Film Grain (Hạt)', min: 0, max: 1 },
      { key: 'bokeh', label: 'Bokeh / Bụi sáng bay', min: 0, max: 1 },
      { key: 'dustScratches', label: 'Bụi & Xước phim nhựa', min: 0, max: 1 },
    ],
  },
  {
    id: 'look-weave',
    title: 'Rung & Nháy',
    sliders: [
      { key: 'gateWeave', label: 'Gate Weave (Rung)', min: 0, max: 1 },
      { key: 'flicker', label: 'Flicker (Nhấp nháy)', min: 0, max: 1 },
    ],
  },
  { id: 'look-frame', title: 'Khung phim', sliders: [] },
];

const ASPECT_MASK_OPTIONS: SelectOption<AspectMaskId>[] = [
  { value: 'none', label: 'Không (Đầy khung)' },
  { value: '2.39', label: '2.39:1 Cinemascope' },
  { value: '2.00', label: '2.00:1 Univisium' },
  { value: '4:3', label: '4:3 Cổ điển' },
];

interface Props {
  disabled: boolean;
  onNotice: (msg: string) => void;
  onPickLut: () => void;
  onClearLut: () => void;
}

/** Project › Look/LUT tab: 12 Film Look presets, fine tuning and .cube LUT. */
export function LookTab({ disabled, onNotice, onPickLut, onClearLut }: Props) {
  const look = useAppStore((s) => s.renderParams.super8);
  const lutIntensity = useAppStore((s) => s.renderParams.lutIntensity);
  const customLut = useAppStore((s) => s.customLut);
  const applyFilmLookPreset = useAppStore((s) => s.applyFilmLookPreset);
  const updateSuper8 = useAppStore((s) => s.updateSuper8);
  const setLutIntensity = useAppStore((s) => s.setLutIntensity);
  const tuneDisabled = !look.enabled || disabled;

  return (
    <>
      <Group id="look-presets" title="12 Film Look Presets + Clean" accent>
        <div className="grid grid-cols-2 gap-1.5">
          {FILM_LOOK_PRESETS.map((preset) => {
            const active = look.presetId === preset.id;
            return (
              <button
                key={preset.id}
                disabled={disabled}
                onClick={() => {
                  applyFilmLookPreset(preset.id);
                  onNotice(`Film Look: ${preset.name}`);
                }}
                title={preset.desc}
                className={`rounded border px-2 h-8 text-left transition ${
                  active
                    ? 'border-amber-400 bg-amber-500/15 text-amber-200'
                    : 'border-zinc-800 bg-zinc-900/90 text-zinc-300 hover:border-zinc-600'
                }`}
              >
                <div className="truncate text-xs font-medium">{preset.name}</div>
              </button>
            );
          })}
        </div>
      </Group>

      <Group
        id="look-tune"
        title="Tinh chỉnh Film Look"
        accent
        enabled={look.enabled}
        disabled={disabled}
        onToggle={(v) => updateSuper8({ enabled: v })}
        onReset={() => applyFilmLookPreset(look.presetId)}
        resetTitle="Đặt các thanh về đúng mẫu Film Look đang chọn"
      >
        {LOOK_GROUPS.map((g) => (
          <Group key={g.id} id={g.id} title={g.title} disabled={tuneDisabled}>
            {g.sliders.map((sl) => (
              <SliderRow
                key={sl.key}
                label={sl.label}
                value={look[sl.key] ?? 0}
                min={sl.min}
                max={sl.max}
                step={0.02}
                disabled={tuneDisabled}
                onChange={(v) => updateSuper8({ [sl.key]: v })}
              />
            ))}
            {g.id === 'look-weave' && (
              <CheckField
                label="Giả lập nhịp 18fps Super 8"
                checked={look.simulate18fps}
                disabled={tuneDisabled}
                onChange={(v) => updateSuper8({ simulate18fps: v })}
              />
            )}
            {g.id === 'look-frame' && (
              <>
                <SelectField
                  label="Khung điện ảnh (Letterbox)"
                  value={look.aspectMask ?? 'none'}
                  options={ASPECT_MASK_OPTIONS}
                  disabled={disabled}
                  onChange={(v) => updateSuper8({ aspectMask: v })}
                />
                <CheckField
                  label="Viền lỗ răng cưa (Sprocket)"
                  checked={look.sprockets}
                  disabled={tuneDisabled}
                  onChange={(v) => updateSuper8({ sprockets: v })}
                />
              </>
            )}
          </Group>
        ))}
      </Group>

      <Group id="look-lut" title="3D LUT (.cube từ DaVinci Resolve)">
        <div className="flex gap-2">
          <button
            onClick={onPickLut}
            disabled={!window.frameSlideAPI || disabled}
            className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
          >
            Nạp file .cube
          </button>
          {customLut && (
            <button
              onClick={onClearLut}
              disabled={disabled}
              className="rounded border border-zinc-700 px-2.5 py-1.5 text-xs text-red-400 hover:bg-zinc-800"
            >
              Gỡ
            </button>
          )}
        </div>
        {customLut && (
          <div className="rounded border border-zinc-800 bg-zinc-900 p-2 text-xs text-emerald-300">
            {customLut.name} ({customLut.size}³)
          </div>
        )}
        <SliderRow
          label="Độ mạnh LUT"
          value={lutIntensity}
          min={0}
          max={1}
          step={0.02}
          disabled={!customLut || disabled}
          onChange={setLutIntensity}
        />
      </Group>
    </>
  );
}
