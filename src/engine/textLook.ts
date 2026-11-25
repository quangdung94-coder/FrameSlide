import type { TextFontId, TextLook, TextShadowMode } from '@shared/types';
import { clamp } from './num';

/** Bundled Vietnamese-ready OFL fonts for titles (D28). `family` is a CSS font-family list. */
export const TEXT_FONTS: readonly { id: TextFontId; label: string; family: string; kind: string }[] = [
  { id: 'be-vietnam-pro', label: 'Be Vietnam Pro', family: '"Be Vietnam Pro", "Segoe UI", sans-serif', kind: 'Không chân' },
  { id: 'montserrat', label: 'Montserrat', family: '"Montserrat", "Segoe UI", sans-serif', kind: 'Không chân' },
  { id: 'playfair-display', label: 'Playfair Display', family: '"Playfair Display", Georgia, serif', kind: 'Có chân' },
  { id: 'lora', label: 'Lora', family: '"Lora", Georgia, serif', kind: 'Có chân' },
  { id: 'dancing-script', label: 'Dancing Script', family: '"Dancing Script", cursive', kind: 'Viết tay' },
  { id: 'great-vibes', label: 'Great Vibes', family: '"Great Vibes", cursive', kind: 'Viết tay' },
  { id: 'jetbrains-mono', label: 'JetBrains Mono', family: '"JetBrains Mono", Consolas, monospace', kind: 'Đơn cách' },
];

export const TEXT_SWATCHES = ['#ffffff', '#f5e6c8', '#fbbf24', '#f97316', '#e11d48', '#a7f3d0', '#93c5fd', '#111111'] as const;

export const TEXT_LOOK_LIMITS = {
  sizePct: [40, 250],
  letterSpacing: [-5, 30],
  outline: [0, 10],
} as const;

const HEX = /^#[0-9a-f]{6}$/i;

export function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && HEX.test(v);
}

/** Accepts "#abc", "abc", "#aabbcc" → "#aabbcc" (lower case); anything else → null. */
export function parseHexColor(input: string): string | null {
  let v = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(v)) v = v.replace(/(.)/g, '$1$1');
  return /^[0-9a-f]{6}$/i.test(v) ? `#${v.toLowerCase()}` : null;
}

export function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${clamp(alpha, 0, 1)})`;
}

/** Drops invalid fields and clamps numbers; returns undefined when nothing is left. */
export function normalizeTextLook(raw: unknown): TextLook | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const out: TextLook = {};
  if (TEXT_FONTS.some((f) => f.id === r.font)) out.font = r.font as TextFontId;
  const num = (v: unknown, [lo, hi]: readonly [number, number]) =>
    typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : undefined;
  const size = num(r.sizePct, TEXT_LOOK_LIMITS.sizePct);
  if (size !== undefined) out.sizePct = size;
  if (typeof r.bold === 'boolean') out.bold = r.bold;
  if (typeof r.italic === 'boolean') out.italic = r.italic;
  if (r.align === 'left' || r.align === 'center' || r.align === 'right') out.align = r.align;
  const ls = num(r.letterSpacing, TEXT_LOOK_LIMITS.letterSpacing);
  if (ls !== undefined) out.letterSpacing = ls;
  if (isHexColor(r.color)) out.color = r.color.toLowerCase();
  const ol = num(r.outline, TEXT_LOOK_LIMITS.outline);
  if (ol !== undefined) out.outline = ol;
  if (isHexColor(r.outlineColor)) out.outlineColor = r.outlineColor.toLowerCase();
  if (r.shadow === 'none' || r.shadow === 'soft' || r.shadow === 'hard') out.shadow = r.shadow as TextShadowMode;
  return Object.keys(out).length ? out : undefined;
}

export interface FaceDefaults {
  family: string;
  weight: number;
  italic: boolean;
  /** Size in px at 1080p. */
  sizePx: number;
}

/** CSS font string for one line of a style with the user's look applied. `base` = min(w, h) / 1080. */
export function lookFont(def: FaceDefaults, look: TextLook | undefined, base: number): string {
  const weight = look?.bold === undefined ? def.weight : look.bold ? 700 : Math.min(def.weight, 400);
  const italic = look?.italic ?? def.italic;
  const family = look?.font ? (TEXT_FONTS.find((f) => f.id === look.font)?.family ?? def.family) : def.family;
  const size = Math.max(1, Math.round(def.sizePx * base * ((look?.sizePct ?? 100) / 100)));
  return `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`;
}

/** Text alignment and anchor x for a line whose style aligns it `defaultAlign` at `defaultX`. */
export function lookAlign(
  defaultAlign: 'left' | 'center' | 'right',
  defaultX: number,
  look: TextLook | undefined,
  w: number,
  margin: number
): { align: 'left' | 'center' | 'right'; x: number } {
  const align = look?.align ?? defaultAlign;
  if (align === defaultAlign) return { align, x: defaultX };
  return { align, x: align === 'left' ? margin : align === 'right' ? w - margin : w / 2 };
}

/** Faces to preload for canvas text (canvas drawing does not wait for web fonts). */
export function textFontFaces(): string[] {
  const out: string[] = [];
  for (const f of TEXT_FONTS) {
    for (const style of ['', 'italic ']) {
      for (const weight of [300, 400, 500, 600, 700]) out.push(`${style}${weight} 40px ${f.family}`);
    }
  }
  return out;
}
