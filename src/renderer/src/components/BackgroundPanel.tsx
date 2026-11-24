import { useState } from 'react';
import {
  BACKGROUND_PATTERN_LABELS,
  BACKGROUND_STYLE_LABELS,
  backgroundCss,
  GRADIENT_PRESETS,
  resolveSceneBackground,
} from '@engine/background';
import type { BackgroundPattern, BackgroundStyle, SceneBackground } from '@shared/types';
import { useAppStore } from '../store/useAppStore';

const STYLE_ORDER: BackgroundStyle[] = [
  'blur',
  'black',
  'paper',
  'studio',
  'solid',
  'gradient',
  'pattern',
];

type Scope = 'project' | 'scene';

interface ColorFieldProps {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (hex: string) => void;
}

function ColorField({ label, value, disabled, onChange }: ColorFieldProps) {
  return (
    <label className="flex items-center gap-1.5 text-[10px] text-zinc-400">
      <input
        type="color"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-8 cursor-pointer rounded border border-zinc-700 bg-zinc-900 p-0.5 disabled:opacity-40"
      />
      <span>{label}</span>
      <span className="font-mono text-zinc-500">{value}</span>
    </label>
  );
}

/**
 * Background behind framed photos (2–4 photo scenes, framed portraits).
 * Can be set for the whole project or only for the selected scene.
 */
export function BackgroundPanel({ disabled }: { disabled: boolean }) {
  const renderParams = useAppStore((s) => s.renderParams);
  const scenes = useAppStore((s) => s.scenes);
  const activeSceneId = useAppStore((s) => s.activeSceneId);
  const setBackgroundStyle = useAppStore((s) => s.setBackgroundStyle);
  const setBackgroundOptions = useAppStore((s) => s.setBackgroundOptions);
  const setSceneBackground = useAppStore((s) => s.setSceneBackground);
  const clearAllSceneBackgrounds = useAppStore((s) => s.clearAllSceneBackgrounds);

  const [scope, setScope] = useState<Scope>('project');

  const activeIdx = scenes.findIndex((sc) => sc.id === activeSceneId);
  const activeScene = activeIdx >= 0 ? scenes[activeIdx] : undefined;
  const effectiveScope: Scope = scope === 'scene' && activeScene ? 'scene' : 'project';
  const projectBg = resolveSceneBackground(renderParams, undefined);
  const current: SceneBackground =
    effectiveScope === 'scene' ? resolveSceneBackground(renderParams, activeScene) : projectBg;
  const ownCount = scenes.filter((sc) => sc.background).length;

  const update = (patch: Partial<SceneBackground>) => {
    if (effectiveScope === 'scene' && activeScene) {
      setSceneBackground(activeScene.id, { ...current, ...patch });
      return;
    }
    const { style, ...opts } = patch;
    if (style) setBackgroundStyle(style);
    if (Object.keys(opts).length > 0) setBackgroundOptions(opts);
  };

  return (
    <div className="space-y-2 rounded-md border border-zinc-800 bg-zinc-900/40 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Nền sau ảnh
        </span>
        <div className="flex overflow-hidden rounded border border-zinc-700 text-[10px]">
          {(
            [
              ['project', 'Cả dự án'],
              ['scene', activeIdx >= 0 ? `Scene ${activeIdx + 1}` : 'Scene'],
            ] as [Scope, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              disabled={disabled || (id === 'scene' && !activeScene)}
              onClick={() => setScope(id)}
              className={`px-2 py-0.5 transition disabled:opacity-40 ${
                effectiveScope === id
                  ? 'bg-amber-500 font-semibold text-zinc-950'
                  : 'bg-zinc-900 text-zinc-300 hover:text-amber-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          className="h-9 w-16 shrink-0 rounded border border-zinc-700"
          style={{ background: backgroundCss(current) }}
          title="Xem nhanh nền"
        />
        <p className="text-[10px] leading-snug text-zinc-500">
          {effectiveScope === 'scene'
            ? activeScene?.background
              ? 'Scene này đang dùng nền riêng.'
              : 'Scene này đang theo nền dự án. Chỉnh bên dưới để tạo nền riêng.'
            : 'Hiện sau scene 2–4 ảnh và ảnh có khung. Ảnh ngang tràn khung không thấy nền.'}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {STYLE_ORDER.map((st) => (
          <button
            key={st}
            type="button"
            disabled={disabled}
            onClick={() => update({ style: st })}
            className={`rounded border px-1 py-1 text-[10px] transition disabled:opacity-40 ${
              current.style === st
                ? 'border-amber-400 bg-amber-500/15 font-semibold text-amber-300'
                : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600'
            }`}
          >
            {BACKGROUND_STYLE_LABELS[st]}
          </button>
        ))}
      </div>

      {current.style === 'solid' && (
        <ColorField
          label="Màu nền"
          value={current.color1}
          disabled={disabled}
          onChange={(color1) => update({ color1 })}
        />
      )}

      {current.style === 'gradient' && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-4 gap-1">
            {GRADIENT_PRESETS.map((g) => (
              <button
                key={g.id}
                type="button"
                disabled={disabled}
                title={g.label}
                onClick={() =>
                  update({ color1: g.color1, color2: g.color2, angleDeg: g.angleDeg })
                }
                className="flex flex-col items-center gap-0.5 rounded border border-zinc-800 p-0.5 text-[9px] text-zinc-400 hover:border-amber-400 hover:text-amber-300 disabled:opacity-40"
              >
                <span
                  className="h-5 w-full rounded-sm"
                  style={{
                    background: `linear-gradient(${g.angleDeg}deg, ${g.color1}, ${g.color2})`,
                  }}
                />
                <span className="truncate">{g.label}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <ColorField
              label="Màu đầu"
              value={current.color1}
              disabled={disabled}
              onChange={(color1) => update({ color1 })}
            />
            <ColorField
              label="Màu cuối"
              value={current.color2}
              disabled={disabled}
              onChange={(color2) => update({ color2 })}
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => update({ color1: current.color2, color2: current.color1 })}
              title="Đảo hai màu"
              className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:border-amber-400 disabled:opacity-40"
            >
              ⇄ Đảo
            </button>
          </div>
          <label className="flex items-center gap-2 text-[10px] text-zinc-400">
            Góc
            <input
              type="range"
              min={0}
              max={360}
              step={5}
              value={current.angleDeg}
              disabled={disabled}
              onChange={(e) => update({ angleDeg: Number(e.target.value) })}
              className="h-1 flex-1 cursor-pointer accent-amber-400"
            />
            <span className="w-9 text-right font-mono text-zinc-300">{current.angleDeg}°</span>
          </label>
        </div>
      )}

      {current.style === 'pattern' && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-4 gap-1">
            {(Object.keys(BACKGROUND_PATTERN_LABELS) as BackgroundPattern[]).map((pt) => (
              <button
                key={pt}
                type="button"
                disabled={disabled}
                onClick={() => update({ pattern: pt })}
                className={`flex flex-col items-center gap-0.5 rounded border p-0.5 text-[9px] disabled:opacity-40 ${
                  current.pattern === pt
                    ? 'border-amber-400 text-amber-300'
                    : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                <span
                  className="h-5 w-full rounded-sm"
                  style={{ background: backgroundCss({ ...current, pattern: pt }) }}
                />
                {BACKGROUND_PATTERN_LABELS[pt]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <ColorField
              label="Nền"
              value={current.color1}
              disabled={disabled}
              onChange={(color1) => update({ color1 })}
            />
            <ColorField
              label="Họa tiết"
              value={current.color2}
              disabled={disabled}
              onChange={(color2) => update({ color2 })}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        {effectiveScope === 'scene' && activeScene?.background && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setSceneBackground(activeScene.id, null)}
            className="rounded border border-zinc-700 px-1.5 py-0.5 text-zinc-300 hover:border-amber-400 hover:text-amber-300 disabled:opacity-40"
          >
            Bỏ nền riêng, theo dự án
          </button>
        )}
        {effectiveScope === 'scene' && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setBackgroundStyle(current.style);
              setBackgroundOptions({
                color1: current.color1,
                color2: current.color2,
                angleDeg: current.angleDeg,
                pattern: current.pattern,
              });
              clearAllSceneBackgrounds();
            }}
            title="Dùng nền này cho tất cả scene (xóa nền riêng của từng scene)"
            className="rounded border border-zinc-700 px-1.5 py-0.5 text-zinc-300 hover:border-amber-400 hover:text-amber-300 disabled:opacity-40"
          >
            Áp cho cả dự án
          </button>
        )}
        {effectiveScope === 'project' && ownCount > 0 && (
          <>
            <span className="text-zinc-500">{ownCount} scene đang có nền riêng.</span>
            <button
              type="button"
              disabled={disabled}
              onClick={clearAllSceneBackgrounds}
              className="rounded border border-zinc-700 px-1.5 py-0.5 text-zinc-300 hover:border-amber-400 hover:text-amber-300 disabled:opacity-40"
            >
              Cho tất cả theo nền dự án
            </button>
          </>
        )}
      </div>
    </div>
  );
}
