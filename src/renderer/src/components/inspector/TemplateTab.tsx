import { useEffect, useState } from 'react';
import { MOTION_TEMPLATE_PRESETS } from '@engine/presets/motionTemplates';
import { TRANSITION_PRESETS } from '@engine/presets/transitions';
import { computeProjectDurationSec } from '@engine/timeline';
import { formatSecondsClock, parseDurationInput } from '@engine/timecode';
import type {
  CardFitMode,
  DurationMode,
  FrameBorderStyle,
  OutputAspectId,
  PortraitMode,
  TransitionType,
} from '@shared/types';
import { useAppStore } from '../../store/useAppStore';
import { BackgroundPanel } from '../BackgroundPanel';
import { Group, SelectField, SliderRow, type SelectOption } from '../ui';
import { TemplateThumb } from './PresetThumb';

const HANDLES_OPTIONS: SelectOption<number>[] = [0, 0.5, 1.0].map((h) => ({
  value: h,
  label: h === 0 ? 'Không (0s)' : `+${h}s mỗi đầu`,
}));
const ASPECT_OPTIONS: SelectOption<OutputAspectId>[] = [
  { value: '16:9', label: '16:9 FHD' },
  { value: '9:16', label: '9:16 Reels' },
  { value: '1:1', label: '1:1 Vuông' },
];
const BORDER_OPTIONS: SelectOption<FrameBorderStyle>[] = [
  { value: 'auto', label: 'Tự động' },
  { value: 'none', label: 'Không viền' },
  { value: 'thin', label: 'Viền mỏng' },
  { value: 'polaroid', label: 'Polaroid' },
];
const FIT_MODE_OPTIONS: SelectOption<CardFitMode>[] = [
  { value: 'fit', label: 'Ôm trọn ảnh (Không cắt)' },
  { value: 'cover', label: 'Lấp đầy ô (Cắt đều)' },
];
const DURATION_MODE_OPTIONS: SelectOption<DurationMode>[] = [
  { value: 'per-slide', label: 'Theo từng Scene' },
  { value: 'fixed-total', label: 'Cố định tổng' },
];
const QUICK_TOTAL_SECS = [
  { label: '30s', sec: 30 },
  { label: '1p', sec: 60 },
  { label: '1p30', sec: 90 },
  { label: '2p', sec: 120 },
  { label: '3p', sec: 180 },
];
const PORTRAIT_OPTIONS: SelectOption<PortraitMode>[] = [
  { value: 'smart-pairing', label: 'Smart Pairing' },
  { value: 'matte-framed', label: 'Matte / Framed' },
  { value: 'safe-top-third', label: 'Focal Point Crop' },
];
const TRANSITION_OPTIONS: SelectOption<TransitionType>[] = TRANSITION_PRESETS.map((tr) => ({
  value: tr.id,
  label: `[${tr.group}] ${tr.name}`,
}));

interface Props {
  disabled: boolean;
  onNotice: (msg: string) => void;
}

/** Project › Template tab: motion templates, timing, background, user presets. */
export function TemplateTab({ disabled, onNotice }: Props) {
  const renderParams = useAppStore((s) => s.renderParams);
  const scenes = useAppStore((s) => s.scenes);
  const userPresets = useAppStore((s) => s.userPresets);
  const applyMotionTemplate = useAppStore((s) => s.applyMotionTemplate);
  const setMotionIntensity = useAppStore((s) => s.setMotionIntensity);
  const setFrameBorderStyle = useAppStore((s) => s.setFrameBorderStyle);
  const setCardFitMode = useAppStore((s) => s.setCardFitMode);
  const setOutputAspect = useAppStore((s) => s.setOutputAspect);
  const setDurationMode = useAppStore((s) => s.setDurationMode);
  const setTotalDurationSec = useAppStore((s) => s.setTotalDurationSec);
  const setDefaultSlideDurationSec = useAppStore((s) => s.setDefaultSlideDurationSec);
  const applyDurationToAllScenes = useAppStore((s) => s.applyDurationToAllScenes);
  const setHandlesSec = useAppStore((s) => s.setHandlesSec);
  const setTransitionType = useAppStore((s) => s.setTransitionType);
  const setTransitionDurationSec = useAppStore((s) => s.setTransitionDurationSec);
  const setPortraitMode = useAppStore((s) => s.setPortraitMode);
  const saveUserPreset = useAppStore((s) => s.saveUserPreset);
  const deleteUserPreset = useAppStore((s) => s.deleteUserPreset);
  const applyUserPreset = useAppStore((s) => s.applyUserPreset);
  const [presetNameDraft, setPresetNameDraft] = useState('');
  const [hoveredTpl, setHoveredTpl] = useState<string | null>(null);
  const [totalDraft, setTotalDraft] = useState(() => String(renderParams.totalDurationSec));
  const [allSceneDraft, setAllSceneDraft] = useState(() => String(renderParams.defaultSlideDurationSec));

  useEffect(() => {
    setTotalDraft(String(renderParams.totalDurationSec));
  }, [renderParams.totalDurationSec]);

  useEffect(() => {
    setAllSceneDraft(String(renderParams.defaultSlideDurationSec));
  }, [renderParams.defaultSlideDurationSec]);

  const commitTotalDraft = () => {
    const parsed = parseDurationInput(totalDraft);
    if (parsed !== null) {
      setTotalDurationSec(parsed);
    } else {
      setTotalDraft(String(renderParams.totalDurationSec));
    }
  };

  const commitAllSceneDraft = () => {
    const v = Number(allSceneDraft);
    if (Number.isFinite(v) && v >= 0.5) {
      const clamped = Math.max(0.5, Math.min(30, Math.round(v * 10) / 10));
      setDefaultSlideDurationSec(clamped);
      setAllSceneDraft(String(clamped));
    } else {
      setAllSceneDraft(String(renderParams.defaultSlideDurationSec));
    }
  };

  const projectTotalSec = computeProjectDurationSec(scenes, renderParams);

  return (
    <>
      <Group id="tpl-templates" title="7 Motion Templates (2D / 2.5D / 3D)" accent>
        <div className="grid grid-cols-2 gap-1.5" onMouseLeave={() => setHoveredTpl(null)}>
          {MOTION_TEMPLATE_PRESETS.map((tpl) => {
            const active = renderParams.motionTemplate === tpl.id;
            const is3d = tpl.id === 'gallery-3d' || tpl.id === 'wall-3d';
            return (
              <button
                key={tpl.id}
                disabled={disabled}
                title={`${tpl.name}: ${tpl.desc}`}
                onMouseEnter={() => setHoveredTpl(tpl.id)}
                onFocus={() => setHoveredTpl(tpl.id)}
                onBlur={() => setHoveredTpl(null)}
                onClick={() => {
                  applyMotionTemplate(tpl.id, true);
                  onNotice(`Đã áp template: ${tpl.name}`);
                }}
                className={`rounded border p-1 text-left transition ${
                  active
                    ? 'border-amber-400 bg-amber-500/10'
                    : 'border-zinc-800 bg-zinc-900/80 hover:border-zinc-600'
                }`}
              >
                <TemplateThumb layouts={tpl.layoutPattern} hovered={hoveredTpl === tpl.id} />
                <div className="mt-1 flex items-center justify-between gap-1 px-0.5">
                  <span className="truncate text-xs font-medium text-zinc-100">{tpl.name}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {is3d && (
                      <span className="rounded bg-amber-500/20 px-1 text-2xs font-bold text-amber-300">3D</span>
                    )}
                    <span className="rounded bg-zinc-800 px-1 text-2xs text-zinc-400">
                      {tpl.heavyLevel === 'light' ? 'Nhẹ' : 'Vừa'}
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-zinc-500">Rê chuột lên ô để xem bố cục chạy thử; bấm để áp cho cả dự án.</p>
      </Group>

      <Group id="tpl-motion" title="Chuyển động, Nền, Viền & Tỷ lệ">
        <div className="grid grid-cols-2 gap-1.5">
          <SelectField
            label="Tỷ lệ xuất"
            value={renderParams.outputAspect}
            options={ASPECT_OPTIONS}
            disabled={disabled}
            onChange={setOutputAspect}
          />
          <SelectField
            label="Viền khung"
            value={renderParams.frameBorderStyle}
            options={BORDER_OPTIONS}
            disabled={disabled}
            onChange={setFrameBorderStyle}
          />
        </div>

        <BackgroundPanel disabled={disabled} fixedScope="project" />

        <SliderRow
          label="Biên độ chuyển động (Motion Intensity)"
          value={renderParams.motionIntensity}
          min={0}
          max={1.5}
          step={0.05}
          disabled={disabled}
          onChange={setMotionIntensity}
        />

        <SliderRow
          label="Thời lượng chuyển cảnh (giây)"
          value={renderParams.transitionDurationSec}
          min={0.2}
          max={2.2}
          step={0.05}
          disabled={disabled}
          onChange={setTransitionDurationSec}
        />

        <div className="space-y-2 rounded border border-zinc-800/80 bg-zinc-900/40 p-2">
          <SelectField
            label="Chế độ thời lượng"
            value={renderParams.durationMode}
            options={DURATION_MODE_OPTIONS}
            disabled={disabled}
            onChange={setDurationMode}
          />
          {renderParams.durationMode === 'fixed-total' ? (
            <div className="space-y-1.5">
              <div className="flex items-end gap-1.5">
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-zinc-400">
                  Tổng thời lượng (giây hoặc phút:giây)
                  <input
                    type="text"
                    value={totalDraft}
                    disabled={disabled}
                    placeholder="VD: 90 hoặc 1:30"
                    onChange={(e) => setTotalDraft(e.target.value)}
                    onBlur={commitTotalDraft}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        commitTotalDraft();
                        e.currentTarget.blur();
                      }
                    }}
                    className="h-8 rounded border border-zinc-700 bg-zinc-900 px-2 font-mono text-xs text-zinc-100"
                  />
                </label>
                <span className="pb-1.5 font-mono text-2xs text-zinc-400">
                  ≈ {(renderParams.totalDurationSec / Math.max(1, scenes.length)).toFixed(1)}s/sc
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {QUICK_TOTAL_SECS.map((q) => (
                  <button
                    key={q.sec}
                    type="button"
                    disabled={disabled}
                    onClick={() => setTotalDurationSec(q.sec)}
                    className={`rounded border px-2 py-0.5 text-2xs transition disabled:opacity-40 ${
                      Math.abs(renderParams.totalDurationSec - q.sec) < 0.2
                        ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-amber-400'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-end gap-1.5">
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-zinc-400">
                  Mỗi Scene (giây)
                  <input
                    type="number"
                    min={0.5}
                    max={30}
                    step={0.5}
                    value={allSceneDraft}
                    disabled={disabled}
                    onChange={(e) => {
                      setAllSceneDraft(e.target.value);
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v >= 0.5) {
                        setDefaultSlideDurationSec(Math.min(30, v));
                      }
                    }}
                    onBlur={commitAllSceneDraft}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        commitAllSceneDraft();
                        e.currentTarget.blur();
                      }
                    }}
                    className="h-8 rounded border border-zinc-700 bg-zinc-900 px-2 font-mono text-xs text-zinc-100"
                  />
                </label>
                <button
                  type="button"
                  disabled={disabled || scenes.length === 0}
                  onClick={() => {
                    const v = Number(allSceneDraft);
                    if (!Number.isFinite(v) || v < 0.5) return;
                    const clamped = Math.max(0.5, Math.min(30, Math.round(v * 10) / 10));
                    applyDurationToAllScenes(clamped);
                    setAllSceneDraft(String(clamped));
                    onNotice(`Đã áp ${clamped.toFixed(1)}s cho toàn bộ ${scenes.length} scene.`);
                  }}
                  title="Đặt thời lượng này cho tất cả scene đang có trên Timeline"
                  className="h-8 shrink-0 rounded bg-amber-500 px-2.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
                >
                  Áp tất cả
                </button>
              </div>
              <div className="text-2xs text-zinc-400">
                Tổng hiện tại: <strong className="font-mono text-zinc-200">{formatSecondsClock(projectTotalSec)}</strong> ({scenes.length} scene)
              </div>
            </div>
          )}
        </div>

        <SelectField
          label="Khung ảnh (nhiều ảnh)"
          value={renderParams.cardFitMode ?? 'fit'}
          options={FIT_MODE_OPTIONS}
          disabled={disabled}
          onChange={setCardFitMode}
        />

        <div className="grid grid-cols-2 gap-2">
          <SelectField
            label="Handles (đầu/cuối)"
            value={renderParams.handlesSec}
            options={HANDLES_OPTIONS}
            disabled={disabled}
            onChange={setHandlesSec}
          />
          <SelectField
            label="Ảnh dọc (1 ảnh)"
            value={renderParams.portraitMode}
            options={PORTRAIT_OPTIONS}
            disabled={disabled}
            onChange={setPortraitMode}
          />
        </div>

        <SelectField
          label="Áp Transition cho tất cả Scene (20 kiểu)"
          value={renderParams.transitionType}
          options={TRANSITION_OPTIONS}
          disabled={disabled}
          onChange={setTransitionType}
        />
      </Group>

      <Group id="tpl-presets" title="Preset cá nhân (My Presets)">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={presetNameDraft}
            disabled={disabled}
            onChange={(e) => setPresetNameDraft(e.target.value)}
            placeholder="Tên preset (VD: Tiệc cưới ấm)"
            className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 h-8 text-xs text-zinc-100"
          />
          <button
            type="button"
            disabled={disabled || !presetNameDraft.trim()}
            onClick={() => {
              saveUserPreset(presetNameDraft);
              onNotice(`Đã lưu preset: ${presetNameDraft.trim()}`);
              setPresetNameDraft('');
            }}
            className="rounded bg-amber-500 px-2.5 py-1 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
          >
            Lưu
          </button>
        </div>
        {userPresets.length > 0 && (
          <div className="space-y-1">
            {userPresets.map((up) => (
              <div
                key={up.id}
                className="flex items-center justify-between gap-1 rounded border border-zinc-800 bg-zinc-900/90 px-2 h-8 text-xs"
              >
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    applyUserPreset(up.id);
                    onNotice(`Đã áp preset: ${up.name}`);
                  }}
                  className="flex-1 truncate text-left text-zinc-200 hover:text-amber-300"
                >
                  ★ {up.name}
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => deleteUserPreset(up.id)}
                  title="Xóa preset"
                  className="text-zinc-500 hover:text-red-400"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </Group>
    </>
  );
}
