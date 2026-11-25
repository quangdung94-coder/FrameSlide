import { useEffect, useState } from 'react';
import { normalizeTextLook, parseHexColor, TEXT_FONTS, TEXT_LOOK_LIMITS, TEXT_SWATCHES } from '@engine/textLook';
import type { TextLook, TextShadowMode } from '@shared/types';
import { SliderRow } from './ui';

interface Props {
  look: TextLook | undefined;
  disabled?: boolean;
  onChange: (look: TextLook | undefined) => void;
}

const BTN = 'h-8 rounded border text-xs disabled:opacity-40';
const on = 'border-amber-400 bg-amber-500/20 text-amber-200';
const off = 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-amber-400';

const SHADOWS: { id: TextShadowMode | undefined; label: string }[] = [
  { id: undefined, label: 'Theo kiểu' },
  { id: 'none', label: 'Không' },
  { id: 'soft', label: 'Mềm' },
  { id: 'hard', label: 'Đậm' },
];

/** Hex box that only commits a valid colour (typing "#f5e" half-way does not break the text). */
function HexInput({ value, disabled, onCommit }: { value: string; disabled?: boolean; onCommit: (hex: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      type="text"
      value={draft}
      disabled={disabled}
      aria-label="Mã màu hex"
      spellCheck={false}
      onChange={(e) => {
        setDraft(e.target.value);
        const hex = parseHexColor(e.target.value);
        if (hex) onCommit(hex);
      }}
      onBlur={() => setDraft(value)}
      className="h-8 w-20 rounded border border-zinc-700 bg-zinc-900 px-1.5 font-mono text-xs text-zinc-100 uppercase disabled:opacity-40"
    />
  );
}

/**
 * Typography on top of a text style (Đợt 5.4b), like Premiere Essential Graphics / CapCut:
 * font (each name in its own font), size, bold / italic, alignment, letter spacing, colour,
 * outline and shadow. Every control can go back to "what the style does".
 */
export function TextLookEditor({ look, disabled, onChange }: Props) {
  const l = look ?? {};
  const set = (patch: Partial<TextLook>) => onChange(normalizeTextLook({ ...l, ...patch }));
  const unset = (...keys: (keyof TextLook)[]) => {
    const next: TextLook = { ...l };
    for (const k of keys) delete next[k];
    onChange(normalizeTextLook(next));
  };
  const color = l.color ?? '#ffffff';

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col gap-1 text-xs text-zinc-400">
        <span>Font</span>
        <div role="listbox" aria-label="Font chữ" className="max-h-44 overflow-y-auto rounded border border-zinc-700 bg-zinc-950">
          {[{ id: undefined, label: 'Theo kiểu chữ', family: undefined, kind: '' }, ...TEXT_FONTS].map((f) => {
            const active = l.font === f.id;
            return (
              <button
                key={f.id ?? 'style'}
                type="button"
                role="option"
                aria-selected={active}
                disabled={disabled}
                onClick={() => (f.id ? set({ font: f.id }) : unset('font'))}
                className={`flex w-full items-center justify-between px-2 py-1 text-left disabled:opacity-40 ${
                  active ? 'bg-amber-500/20 text-amber-200' : 'text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                <span
                  style={f.family ? { fontFamily: f.family, fontSize: 15 } : undefined}
                  className={`min-w-0 truncate ${f.family ? '' : 'text-xs'}`}
                >
                  {f.label}
                </span>
                <span className="ml-2 shrink-0 text-2xs text-zinc-500">{f.kind}</span>
              </button>
            );
          })}
        </div>
      </div>

      <SliderRow
        label="Cỡ chữ (% so với kiểu)"
        value={l.sizePct ?? 100}
        min={TEXT_LOOK_LIMITS.sizePct[0]}
        max={TEXT_LOOK_LIMITS.sizePct[1]}
        step={5}
        disabled={disabled}
        onChange={(sizePct) => (sizePct === 100 ? unset('sizePct') : set({ sizePct }))}
      />

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          disabled={disabled}
          aria-pressed={l.bold === true}
          title="Đậm (bấm lần nữa: theo kiểu)"
          onClick={() => (l.bold ? unset('bold') : set({ bold: true }))}
          className={`${BTN} w-8 font-bold ${l.bold ? on : off}`}
        >
          B
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-pressed={l.italic === true}
          title="Nghiêng (bấm lần nữa: theo kiểu)"
          onClick={() => (l.italic ? unset('italic') : set({ italic: true }))}
          className={`${BTN} w-8 italic ${l.italic ? on : off}`}
        >
          I
        </button>
        <span className="mx-1 w-px self-stretch bg-zinc-700" />
        {(
          [
            ['left', 'Trái'],
            ['center', 'Giữa'],
            ['right', 'Phải'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            aria-pressed={l.align === id}
            title={`Canh ${label.toLowerCase()} (bấm lần nữa: theo kiểu)`}
            onClick={() => (l.align === id ? unset('align') : set({ align: id }))}
            className={`${BTN} px-2 ${l.align === id ? on : off}`}
          >
            ≡ {label}
          </button>
        ))}
      </div>

      <SliderRow
        label="Khoảng cách chữ"
        value={l.letterSpacing ?? 0}
        min={TEXT_LOOK_LIMITS.letterSpacing[0]}
        max={TEXT_LOOK_LIMITS.letterSpacing[1]}
        step={0.5}
        disabled={disabled}
        onChange={(letterSpacing) => (letterSpacing === 0 ? unset('letterSpacing') : set({ letterSpacing }))}
      />

      <div className="flex flex-col gap-1 text-xs text-zinc-400">
        <span>Màu chữ</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="color"
            value={color}
            disabled={disabled}
            aria-label="Chọn màu chữ"
            onChange={(e) => set({ color: e.target.value })}
            className="h-8 w-8 cursor-pointer rounded border border-zinc-700 bg-zinc-900 p-0.5 disabled:opacity-40"
          />
          <HexInput value={color} disabled={disabled} onCommit={(hex) => set({ color: hex })} />
          <button
            type="button"
            disabled={disabled || !l.color}
            onClick={() => unset('color')}
            className={`${BTN} px-2 ${off}`}
            title="Dùng màu của kiểu chữ"
          >
            Theo kiểu
          </button>
        </div>
        <div className="flex gap-1">
          {TEXT_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              disabled={disabled}
              title={c.toUpperCase()}
              aria-label={`Màu ${c}`}
              onClick={() => set({ color: c })}
              className={`h-6 w-6 rounded border disabled:opacity-40 ${l.color === c ? 'border-amber-400 ring-1 ring-amber-400' : 'border-zinc-600'}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <SliderRow
        label="Viền chữ"
        value={l.outline ?? 0}
        min={TEXT_LOOK_LIMITS.outline[0]}
        max={TEXT_LOOK_LIMITS.outline[1]}
        step={0.5}
        disabled={disabled}
        onChange={(outline) => (outline === 0 ? unset('outline') : set({ outline }))}
      />
      {(l.outline ?? 0) > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span>Màu viền</span>
          <input
            type="color"
            value={l.outlineColor ?? '#000000'}
            disabled={disabled}
            aria-label="Chọn màu viền"
            onChange={(e) => set({ outlineColor: e.target.value })}
            className="h-8 w-8 cursor-pointer rounded border border-zinc-700 bg-zinc-900 p-0.5"
          />
          <HexInput value={l.outlineColor ?? '#000000'} disabled={disabled} onCommit={(hex) => set({ outlineColor: hex })} />
        </div>
      )}

      <div className="flex flex-col gap-1 text-xs text-zinc-400">
        <span>Bóng đổ</span>
        <div className="grid grid-cols-4 overflow-hidden rounded border border-zinc-700">
          {SHADOWS.map((s) => (
            <button
              key={s.label}
              type="button"
              disabled={disabled}
              aria-pressed={l.shadow === s.id}
              onClick={() => (s.id ? set({ shadow: s.id }) : unset('shadow'))}
              className={`h-8 text-xs disabled:opacity-40 ${
                l.shadow === s.id ? 'bg-amber-500 font-semibold text-zinc-950' : 'bg-zinc-900 text-zinc-300 hover:text-amber-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {look && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(undefined)}
          className={`${BTN} w-full ${off}`}
        >
          ⟲ Bỏ hết chỉnh font / màu (theo kiểu chữ)
        </button>
      )}
    </div>
  );
}
