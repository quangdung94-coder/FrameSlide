import { DEFAULT_OWN_TEXT_STYLE } from '@engine/sceneText';
import { resolveCaptionWindow } from '@engine/textAnimation';
import type { SceneTextOverride, TextStyleId } from '@shared/types';
import { getSceneTimeRange, useAppStore } from '../store/useAppStore';
import { TEXT_ANIMATION_OPTIONS, TEXT_STYLE_OPTIONS } from './inspector/textOptions';
import { Group, SelectField, SliderRow, TextField } from './ui';

const FIELD = 'h-8 w-full rounded border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100 disabled:opacity-40';
const SMALL_BTN =
  'h-8 rounded border border-zinc-700 px-2 text-xs text-zinc-300 hover:border-amber-400 disabled:opacity-40';

type Mode = 'project' | SceneTextOverride['mode'];

const MODES: { id: Mode; label: string; title: string }[] = [
  { id: 'project', label: 'Theo dự án', title: 'Dùng chữ của dự án (tab Chữ)' },
  { id: 'own', label: 'Riêng', title: 'Kiểu chữ, chuyển động và nội dung riêng cho scene này' },
  { id: 'off', label: 'Tắt chữ', title: 'Scene này không hiện chữ' },
];

const OWN_STYLE_OPTIONS = TEXT_STYLE_OPTIONS.filter((o) => o.value !== 'none') as {
  value: Exclude<TextStyleId, 'none'>;
  label: string;
}[];

/**
 * Scene › Chữ (Đợt 5.4a): the scene follows the project text, has its own text (style, animation,
 * title, subtitle) or shows none. Own text and per-scene captions get their own timing / position.
 */
export function SceneTextGroup({ sceneId, disabled }: { sceneId: string; disabled: boolean }) {
  const scenes = useAppStore((s) => s.scenes);
  const renderParams = useAppStore((s) => s.renderParams);
  const setSceneCaption = useAppStore((s) => s.setSceneCaption);
  const setSceneCaptionTiming = useAppStore((s) => s.setSceneCaptionTiming);
  const setSceneCaptionOffset = useAppStore((s) => s.setSceneCaptionOffset);
  const setSceneTextMode = useAppStore((s) => s.setSceneTextMode);
  const updateSceneText = useAppStore((s) => s.updateSceneText);
  const updateTextOverlay = useAppStore((s) => s.updateTextOverlay);

  const idx = scenes.findIndex((sc) => sc.id === sceneId);
  const scene = idx >= 0 ? scenes[idx] : null;
  if (!scene) return null;

  const text = renderParams.textOverlay;
  const mode: Mode = scene.text?.mode ?? 'project';
  const own = scene.text?.mode === 'own' ? scene.text : null;
  const captionActive = text.style !== 'none' && text.timing === 'per-scene';
  const showTiming = own !== null || (mode === 'project' && captionActive);

  const timingBlock = (() => {
    const dur = getSceneTimeRange({ scenes, renderParams }, idx).durationSec;
    const [inSec, outSec] = resolveCaptionWindow(scene.captionTiming, dur);
    return (
      <>
        <SliderRow
          label="Chữ hiện từ giây"
          value={inSec}
          min={0}
          max={Math.max(0.1, dur - 0.2)}
          step={0.1}
          disabled={disabled}
          onChange={(v) => setSceneCaptionTiming(scene.id, { inSec: v, outSec: Math.max(outSec, v + 0.2) })}
        />
        <SliderRow
          label="Chữ ẩn lúc giây"
          value={outSec}
          min={0.2}
          max={Math.max(0.2, dur)}
          step={0.1}
          disabled={disabled}
          onChange={(v) => setSceneCaptionTiming(scene.id, { inSec: Math.min(inSec, v - 0.2), outSec: v })}
        />
        <div className="flex flex-wrap gap-1.5">
          {scene.captionTiming && (
            <button type="button" disabled={disabled} onClick={() => setSceneCaptionTiming(scene.id, null)} className={SMALL_BTN}>
              ⟲ Hiện suốt scene
            </button>
          )}
          {scene.captionOffset && (
            <button type="button" disabled={disabled} onClick={() => setSceneCaptionOffset(scene.id, null)} className={SMALL_BTN}>
              ⟲ Vị trí theo dự án
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-500">
          Kéo chữ trên khung xem bằng nút "✥ Kéo chữ" ở tab Chữ; vị trí kéo khi đang ở scene này chỉ áp cho scene này.
        </p>
      </>
    );
  })();

  return (
    <Group
      id="scene-caption"
      title="Chữ của scene"
      defaultOpen={false}
      disabled={disabled}
      onReset={() => {
        setSceneTextMode(scene.id, 'project');
        setSceneCaption(scene.id, '');
      }}
      resetTitle="Về chữ theo dự án và xóa chú thích của scene"
    >
      <div className="grid grid-cols-3 overflow-hidden rounded border border-zinc-700" role="radiogroup" aria-label="Chữ của scene">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={mode === m.id}
            title={m.title}
            disabled={disabled}
            onClick={() => mode !== m.id && setSceneTextMode(scene.id, m.id)}
            className={`h-8 text-xs disabled:opacity-40 ${
              mode === m.id ? 'bg-amber-500 font-semibold text-zinc-950' : 'bg-zinc-900 text-zinc-300 hover:text-amber-300'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'off' && <p className="text-xs text-zinc-400">Scene này không hiện chữ, kể cả chữ của dự án.</p>}

      {own && (
        <>
          <SelectField
            label="Kiểu chữ"
            value={own.style ?? DEFAULT_OWN_TEXT_STYLE}
            options={OWN_STYLE_OPTIONS}
            disabled={disabled}
            onChange={(style) => updateSceneText(scene.id, { style })}
          />
          <SelectField
            label="Chuyển động khi chữ hiện ra"
            value={own.animation ?? text.animation ?? 'fade'}
            options={TEXT_ANIMATION_OPTIONS}
            disabled={disabled}
            onChange={(animation) => updateSceneText(scene.id, { animation })}
          />
          <TextField
            label="Tiêu đề"
            value={own.title ?? ''}
            disabled={disabled}
            placeholder="Ví dụ: Lễ vu quy"
            onChange={(title) => updateSceneText(scene.id, { title })}
          />
          <TextField
            label="Phụ đề / Địa điểm"
            value={own.subtitle ?? ''}
            disabled={disabled}
            onChange={(subtitle) => updateSceneText(scene.id, { subtitle })}
          />
        </>
      )}

      {mode === 'project' && (
        <>
          <input
            type="text"
            value={scene.caption ?? ''}
            disabled={disabled || !captionActive}
            onChange={(e) => setSceneCaption(scene.id, e.target.value)}
            placeholder="Nhập chú thích cho scene này…"
            aria-label="Chú thích của scene"
            className={FIELD}
          />
          {!captionActive && (
            <div className="space-y-1.5 rounded border border-zinc-800 bg-zinc-900/60 p-2 text-xs text-zinc-400">
              <p>
                Chú thích chỉ hiện khi chữ dự án đang bật và thời điểm là "Chú thích riêng từng Scene". Muốn chữ chỉ cho
                scene này, chọn "Riêng".
              </p>
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  updateTextOverlay({
                    style: text.style === 'none' ? 'minimal-fade' : text.style,
                    timing: 'per-scene',
                  })
                }
                className="h-8 rounded border border-zinc-700 bg-zinc-800 px-2 text-zinc-100 hover:border-amber-400 disabled:opacity-40"
              >
                Bật chú thích riêng từng scene
              </button>
            </div>
          )}
        </>
      )}

      {showTiming && timingBlock}
    </Group>
  );
}
