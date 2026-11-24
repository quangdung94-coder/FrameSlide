import { getMotionTemplate, MOTION_TEMPLATE_PRESETS } from '@engine/presets/motionTemplates';
import { TRANSITION_PRESETS } from '@engine/presets/transitions';
import { LAYOUT_LABELS } from '@engine/sceneBuilder';
import { SCENE_SETTING_PARTS } from '@engine/sceneSettings';
import type { MotionDirection, MotionTemplateId, SceneLayoutId } from '@shared/types';
import { useAppStore } from '../store/useAppStore';
import { BackgroundPanel } from './BackgroundPanel';
import { Group, SliderRow } from './ui';

const FIELD =
  'h-8 w-full rounded border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100 disabled:opacity-40';

const LAYOUTS: SceneLayoutId[] = ['single', 'diptych', 'triptych', 'mosaic4'];

/** Right-hand panel for the selected scene (layout, duration, motion, background, transition, caption). */
export function ScenePanel({ disabled, onNotice }: { disabled: boolean; onNotice: (msg: string) => void }) {
  const scenes = useAppStore((s) => s.scenes);
  const activeSceneId = useAppStore((s) => s.activeSceneId);
  const renderParams = useAppStore((s) => s.renderParams);
  const hasClipboard = useAppStore((s) => s.sceneClipboard !== null);
  const setSceneLayout = useAppStore((s) => s.setSceneLayout);
  const setSceneDuration = useAppStore((s) => s.setSceneDuration);
  const setSceneMotionDirection = useAppStore((s) => s.setSceneMotionDirection);
  const setSceneMotionTemplate = useAppStore((s) => s.setSceneMotionTemplate);
  const setSceneTransition = useAppStore((s) => s.setSceneTransition);
  const setSceneFilmLookOff = useAppStore((s) => s.setSceneFilmLookOff);
  const setSceneTransitionDuration = useAppStore((s) => s.setSceneTransitionDuration);
  const setSceneCaption = useAppStore((s) => s.setSceneCaption);
  const setSceneBackground = useAppStore((s) => s.setSceneBackground);
  const updateTextOverlay = useAppStore((s) => s.updateTextOverlay);
  const copySceneSettings = useAppStore((s) => s.copySceneSettings);
  const pasteSceneSettings = useAppStore((s) => s.pasteSceneSettings);

  const idx = scenes.findIndex((sc) => sc.id === activeSceneId);
  const scene = idx >= 0 ? scenes[idx] : null;
  if (!scene) {
    return <p className="text-xs text-zinc-500">Chưa có scene nào. Thêm scene ở dải Scene bên dưới.</p>;
  }
  const isLast = idx === scenes.length - 1;
  const text = renderParams.textOverlay;
  const captionActive = text.style !== 'none' && text.timing === 'per-scene';

  return (
    <>
      <Group id="scene-layout" title="Bố cục & thời lượng" accent>
        <div className="grid grid-cols-4 gap-1">
          {LAYOUTS.map((lay, i) => (
            <button
              key={lay}
              type="button"
              disabled={disabled}
              title={LAYOUT_LABELS[lay]}
              onClick={() => setSceneLayout(scene.id, lay)}
              className={`h-8 rounded border text-xs transition disabled:opacity-40 ${
                scene.layout === lay
                  ? 'border-amber-400 bg-amber-500/15 font-semibold text-amber-300'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600'
              }`}
            >
              {i + 1} ảnh
            </button>
          ))}
        </div>
        <SliderRow
          label="Thời lượng scene (giây)"
          value={scene.durationSec}
          min={0.5}
          max={20}
          step={0.5}
          disabled={disabled}
          onChange={(v) => setSceneDuration(scene.id, v)}
        />
      </Group>

      <Group
        id="scene-motion"
        title="Chuyển động"
        disabled={disabled}
        onReset={() => {
          setSceneMotionDirection(scene.id, 'auto');
          setSceneMotionTemplate(scene.id, null);
        }}
        resetTitle="Về Tự động và theo template của dự án"
      >
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Motion Template của scene
          <select
            value={scene.motionTemplate ?? ''}
            disabled={disabled}
            onChange={(e) =>
              setSceneMotionTemplate(scene.id, (e.target.value || null) as MotionTemplateId | null)
            }
            className={FIELD}
          >
            <option value="">Theo dự án ({getMotionTemplate(renderParams.motionTemplate).name})</option>
            {MOTION_TEMPLATE_PRESETS.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Hướng chuyển động riêng
          <select
            value={scene.motionDirection ?? 'auto'}
            disabled={disabled}
            onChange={(e) => setSceneMotionDirection(scene.id, e.target.value as MotionDirection)}
            className={FIELD}
          >
            <option value="auto">Tự động (Auto)</option>
            <option value="zoom-in">Zoom In (Tiến gần)</option>
            <option value="zoom-out">Zoom Out (Lùi xa)</option>
            <option value="pan-left">Lướt sang Trái</option>
            <option value="pan-right">Lướt sang Phải</option>
            <option value="tilt-3d">Nghiêng 3D (Perspective)</option>
            <option value="static">Đứng yên (Tĩnh)</option>
          </select>
        </label>
      </Group>

      <Group
        id="scene-look"
        title="Film Look cho scene này"
        defaultOpen={false}
        disabled={disabled}
        enabled={!scene.filmLookOff}
        onToggle={(on) => setSceneFilmLookOff(scene.id, !on)}
      >
        <p className="text-xs text-zinc-500">
          Tắt công tắc để scene này hiện màu sạch (không Film Look, không LUT). Chuyển cảnh sang scene khác vẫn mượt.
          {renderParams.super8.enabled ? '' : ' Hiện Film Look của cả dự án đang tắt.'}
        </p>
      </Group>

      <Group
        id="scene-bg"
        title="Nền sau ảnh"
        defaultOpen={false}
        disabled={disabled}
        onReset={() => setSceneBackground(scene.id, null)}
        resetTitle="Cho scene này theo nền dự án"
      >
        <BackgroundPanel disabled={disabled} fixedScope="scene" />
      </Group>

      {!isLast && (
        <Group
          id="scene-transition"
          title={`Chuyển cảnh S${idx + 1} → S${idx + 2}`}
          defaultOpen={false}
          disabled={disabled}
          onReset={() => {
            setSceneTransition(scene.id, renderParams.transitionType);
            setSceneTransitionDuration(scene.id, null);
          }}
          resetTitle="Về kiểu và thời lượng chuyển cảnh mặc định của dự án"
        >
          <select
            value={scene.transitionType}
            disabled={disabled}
            onChange={(e) => setSceneTransition(scene.id, e.target.value as typeof scene.transitionType)}
            className={FIELD}
          >
            {TRANSITION_PRESETS.map((tr) => (
              <option key={tr.id} value={tr.id}>
                [{tr.group}] {tr.name}
              </option>
            ))}
          </select>
          <SliderRow
            label={
              scene.transitionDurationSec === undefined
                ? `Thời lượng chuyển cảnh (đang theo dự án: ${renderParams.transitionDurationSec.toFixed(2)}s)`
                : 'Thời lượng chuyển cảnh (giây)'
            }
            value={scene.transitionDurationSec ?? renderParams.transitionDurationSec}
            min={0.2}
            max={2.5}
            step={0.05}
            disabled={disabled}
            onChange={(v) => setSceneTransitionDuration(scene.id, v)}
          />
        </Group>
      )}

      <Group
        id="scene-caption"
        title="Chữ riêng của scene"
        defaultOpen={false}
        disabled={disabled}
        onReset={() => setSceneCaption(scene.id, '')}
        resetTitle="Xóa chữ của scene"
      >
        <input
          type="text"
          value={scene.caption ?? ''}
          disabled={disabled}
          onChange={(e) => setSceneCaption(scene.id, e.target.value)}
          placeholder="Nhập chữ riêng cho scene này…"
          className={FIELD}
        />
        {!captionActive && (
          <div className="space-y-1.5 rounded border border-zinc-800 bg-zinc-900/60 p-2 text-xs text-zinc-400">
            <p>Chữ riêng chỉ hiện khi kiểu chữ đang bật và thời điểm là "Chú thích riêng từng Scene".</p>
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
      </Group>

      <Group id="scene-copy" title="Sao chép thiết lập" defaultOpen={false}>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (copySceneSettings(scene.id)) onNotice('Đã sao chép thiết lập scene.');
            }}
            className="h-8 flex-1 rounded border border-zinc-700 bg-zinc-800 text-xs text-zinc-100 hover:border-amber-400 disabled:opacity-40"
          >
            Sao chép
          </button>
          <button
            type="button"
            disabled={disabled || !hasClipboard}
            onClick={() => {
              if (pasteSceneSettings(scene.id, SCENE_SETTING_PARTS.map((p) => p.id))) {
                onNotice('Đã dán thiết lập vào scene đang chọn.');
              }
            }}
            className="h-8 flex-1 rounded border border-zinc-700 bg-zinc-800 text-xs text-zinc-100 hover:border-amber-400 disabled:opacity-40"
          >
            Dán tất cả
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          Dán từng phần (chỉ nền, chỉ chuyển cảnh…): bấm chuột phải vào thẻ scene.
        </p>
      </Group>
    </>
  );
}
