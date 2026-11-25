import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Open/closed state of inspector groups is remembered per machine (not in the project file). */
const GROUPS_KEY = 'frameslide.groups.v1';

function readOpenMap(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(GROUPS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function writeOpen(id: string, open: boolean): void {
  try {
    const map = readOpenMap();
    map[id] = open;
    window.localStorage.setItem(GROUPS_KEY, JSON.stringify(map));
  } catch {
    // Storage unavailable (private mode etc.): the group simply won't be remembered.
  }
}

export interface GroupProps {
  /** Stable id used to remember whether the group is open. */
  id: string;
  title: ReactNode;
  defaultOpen?: boolean;
  /** Highlight colour for the title (amber for the primary group of a tab). */
  accent?: boolean;
  /** When both `enabled` and `onToggle` are given, a switch is shown in the header. */
  enabled?: boolean;
  onToggle?: (next: boolean) => void;
  /** Shows a ⟲ button in the header that restores this group's defaults. */
  onReset?: () => void;
  resetTitle?: string;
  disabled?: boolean;
  children: ReactNode;
}

/** Collapsible inspector group: 32px header, optional on/off switch and reset button. */
export function Group({
  id,
  title,
  defaultOpen = true,
  accent,
  enabled,
  onToggle,
  onReset,
  resetTitle,
  disabled,
  children,
}: GroupProps) {
  const [open, setOpen] = useState<boolean>(() => {
    const stored = readOpenMap()[id];
    return stored === undefined ? defaultOpen : stored;
  });

  useEffect(() => {
    writeOpen(id, open);
  }, [id, open]);

  return (
    <section className="rounded-md border border-zinc-800/80 bg-zinc-900/30">
      <div className="flex h-8 items-center gap-1 pr-1.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`flex h-8 min-w-0 flex-1 items-center gap-1.5 px-2 text-left text-xs font-semibold uppercase tracking-wide hover:text-white ${
            accent ? 'text-amber-400' : 'text-zinc-300'
          }`}
        >
          <span className="w-3 shrink-0 text-[10px] text-zinc-500">{open ? '▾' : '▸'}</span>
          <span className="truncate">{title}</span>
        </button>
        {onToggle && enabled !== undefined && (
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={disabled}
            onClick={() => onToggle(!enabled)}
            title={enabled ? 'Đang bật — bấm để tắt' : 'Đang tắt — bấm để bật'}
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
              enabled ? 'bg-amber-500' : 'bg-zinc-700'
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                enabled ? 'left-[18px]' : 'left-0.5'
              }`}
            />
          </button>
        )}
        {onReset && (
          <button
            type="button"
            disabled={disabled}
            onClick={onReset}
            title={resetTitle ?? 'Đặt lại nhóm này về mặc định'}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-sm text-zinc-400 hover:bg-zinc-800 hover:text-amber-300 disabled:opacity-40"
          >
            ⟲
          </button>
        )}
      </div>
      {open && <div className="space-y-2.5 border-t border-zinc-800/80 p-2.5">{children}</div>}
    </section>
  );
}

export interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}

function decimalsOf(step: number): number {
  const s = String(step);
  const dot = s.indexOf('.');
  return dot < 0 ? 0 : Math.min(3, s.length - dot - 1);
}

/** Figma-style row: label on top, then slider + a number box you can type into. */
export function SliderRow({ label, value, min, max, step, disabled, onChange }: SliderRowProps) {
  const decimals = decimalsOf(step);
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);

  const commit = (text: string) => {
    setDraft(null);
    const n = Number(text.replace(',', '.'));
    if (text.trim() === '' || !Number.isFinite(n)) return;
    onChange(Math.min(max, Math.max(min, n)));
  };

  return (
    <div className="flex flex-col gap-1">
      <span className={`text-xs ${disabled ? 'text-zinc-600' : 'text-zinc-300'}`}>{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="slider-thick h-7 min-w-0 flex-1 cursor-pointer accent-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
        />
        <input
          type="text"
          inputMode="decimal"
          value={draft ?? value.toFixed(decimals)}
          disabled={disabled}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => {
            if (cancelled.current) {
              cancelled.current = false;
              setDraft(null);
            } else if (draft !== null) commit(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              cancelled.current = true;
              e.currentTarget.blur();
            }
          }}
          className="h-7 w-14 shrink-0 rounded border border-zinc-700 bg-zinc-900 px-1.5 text-right font-mono text-xs text-zinc-200 focus:border-amber-400 focus:outline-none disabled:opacity-40"
        />
      </div>
    </div>
  );
}

const FIELD_CLASS =
  'h-8 rounded border border-zinc-700 bg-zinc-900 px-2 text-zinc-100 disabled:opacity-40';

export interface SelectOption<T extends string | number> {
  value: T;
  label: ReactNode;
}

export interface SelectFieldProps<T extends string | number> {
  label: ReactNode;
  value: T;
  options: readonly SelectOption<T>[];
  disabled?: boolean;
  onChange: (v: T) => void;
}

/** Label on top + dropdown. Numeric option values come back as numbers. */
export function SelectField<T extends string | number>({
  label,
  value,
  options,
  disabled,
  onChange,
}: SelectFieldProps<T>) {
  return (
    <label className="flex flex-col gap-1 text-xs text-zinc-400">
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const picked = options.find((o) => String(o.value) === e.target.value);
          if (picked) onChange(picked.value);
        }}
        className={FIELD_CLASS}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export interface TextFieldProps {
  label: ReactNode;
  value: string;
  disabled?: boolean;
  mono?: boolean;
  placeholder?: string;
  onChange: (v: string) => void;
}

/** Label on top + single-line text box. */
export function TextField({ label, value, disabled, mono, placeholder, onChange }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-xs text-zinc-400">
      {label}
      <input
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${FIELD_CLASS} ${mono ? 'font-mono' : ''}`}
      />
    </label>
  );
}

export interface CheckFieldProps {
  label: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}

/** Checkbox with its label to the right. */
export function CheckField({ label, checked, disabled, onChange }: CheckFieldProps) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-amber-400"
      />
      {label}
    </label>
  );
}

export interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  /** Tailwind max-width class of the dialog box. */
  widthClass?: string;
  closeTitle?: string;
  ariaLabel?: string;
  children: ReactNode;
}

/** Dimmed full-screen backdrop + centred dialog with a title bar and ✕ button. Click outside closes. */
export function Modal({ title, onClose, widthClass = 'max-w-md', closeTitle, ariaLabel, children }: ModalProps) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
    >
      <div
        role="dialog"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[90vh] w-full ${widthClass} flex-col rounded-lg border border-zinc-700 bg-[#18181f] text-xs shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
          <span className="text-sm font-semibold text-amber-400">{title}</span>
          <button
            type="button"
            onClick={onClose}
            title={closeTitle ?? 'Đóng (Esc)'}
            className="h-8 w-8 rounded text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
