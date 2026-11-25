/**
 * How a focused element should share the keyboard with the editor's global shortcuts.
 *
 * - `typing`: a real text field (text/number input, textarea, contenteditable). Every editing
 *   shortcut is ignored so the user can type freely.
 * - `control`: a slider, dropdown, checkbox or button. It keeps its own arrow / Home / End / digit
 *   keys, but transport keys (Space, J/K/L, F) still drive playback. Before this, a scrubber that
 *   kept focus after a drag swallowed Space, so playback needed a click on "Phát".
 * - `none`: nothing focusable; every shortcut applies.
 */
export type KeyTargetKind = 'typing' | 'control' | 'none';

export interface KeyTargetLike {
  tagName?: string;
  type?: string;
  isContentEditable?: boolean;
}

/** Input types that do not take typed text (everything else counts as a text field). */
const NON_TEXT_INPUT_TYPES = new Set([
  'range',
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'color',
  'file',
  'image',
]);

export function classifyKeyTarget(el: KeyTargetLike | null | undefined): KeyTargetKind {
  if (!el || !el.tagName) return 'none';
  if (el.isContentEditable) return 'typing';
  const tag = el.tagName.toUpperCase();
  if (tag === 'TEXTAREA') return 'typing';
  if (tag === 'INPUT') {
    const type = (el.type ?? 'text').toLowerCase();
    return NON_TEXT_INPUT_TYPES.has(type) ? 'control' : 'typing';
  }
  if (tag === 'SELECT' || tag === 'BUTTON') return 'control';
  return 'none';
}
