import * as THREE from 'three';
import type { TextLook, TextOverlayConfig } from '@shared/types';
import { hexToRgba, lookAlign, lookFont, normalizeTextLook, textFontFaces, type FaceDefaults } from './textLook';

export interface TextRenderOverrides {
  width?: number;
  height?: number;
  titleOverride?: string;
  dateOverride?: string;
  /** Typewriter: how many characters are visible (title first, then subtitle). */
  revealChars?: number;
}

const chars = (t: string) => Array.from(t);

/** Characters the typewriter types for a style: the date for the date stamp, else title + subtitle. */
export function typewriterCharCount(config: TextOverlayConfig, title: string, date: string): number {
  if (config.style === 'date-stamp-90s') return chars(date).length;
  return chars(title).length + chars(config.subtitle.trim()).length;
}

/** First `n` characters of `text` (whole letters, so Vietnamese accents never split). */
export function revealText(text: string, n: number): string {
  if (!Number.isFinite(n)) return text;
  return chars(text).slice(0, Math.max(0, Math.floor(n))).join('');
}

/** Font faces the text styles and the font picker draw with (bundled with the app, D26 / D28). */
export const TEXT_FONT_FACES: readonly string[] = textFontFaces();

/** Bumped once the text fonts finish loading, so text drawn earlier with a fallback font is redrawn. */
let fontEpoch = 0;
let fontsPromise: Promise<void> | null = null;

/**
 * Load the text fonts before drawing (canvas text does not wait for web fonts).
 * Safe to call many times; resolves even if a font fails or `document.fonts` is missing.
 */
export function loadTextFonts(): Promise<void> {
  if (fontsPromise) return fontsPromise;
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!fonts) return (fontsPromise = Promise.resolve());
  fontsPromise = Promise.all(
    TEXT_FONT_FACES.map((f) => fonts.load(f, 'Ăâêôơư Kỷ niệm 0123').catch(() => []))
  ).then(() => {
    fontEpoch++;
  });
  return fontsPromise;
}

interface StyleShadow {
  color: string;
  /** Blur in px at 1080p. */
  blur: number;
}

/**
 * Draws one line: letter spacing, shadow (the style's own, or the user's none / soft / hard),
 * outline under the fill, then the fill.
 */
function drawStyledLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  def: FaceDefaults,
  look: TextLook | undefined,
  base: number,
  o: {
    align: 'left' | 'center' | 'right';
    x: number;
    y: number;
    baseline: CanvasTextBaseline;
    fill: string;
    shadow?: StyleShadow;
    maxWidth?: number;
  }
): void {
  ctx.save();
  ctx.font = lookFont(def, look, base);
  ctx.textAlign = o.align;
  ctx.textBaseline = o.baseline;
  // Canvas letterSpacing (Chromium / Electron); ignored where unsupported.
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${(look?.letterSpacing ?? 0) * base}px`;

  const mode = look?.shadow;
  if (mode === 'none') {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  } else if (mode === 'soft') {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 18 * base;
  } else if (mode === 'hard') {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 3 * base;
    ctx.shadowOffsetY = 3 * base;
  } else if (o.shadow) {
    ctx.shadowColor = o.shadow.color;
    ctx.shadowBlur = o.shadow.blur * base;
  } else {
    ctx.shadowColor = 'transparent';
  }

  const outline = look?.outline ?? 0;
  if (outline > 0) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = outline * 2 * base;
    ctx.strokeStyle = look?.outlineColor ?? '#000000';
    if (o.maxWidth !== undefined) ctx.strokeText(text, o.x, o.y, o.maxWidth);
    else ctx.strokeText(text, o.x, o.y);
    // The shadow belongs under the outline only, not again under the fill.
    ctx.shadowColor = 'transparent';
  }
  ctx.fillStyle = o.fill;
  // An explicit `undefined` maxWidth would draw nothing, so only pass it when set.
  if (o.maxWidth !== undefined) ctx.fillText(text, o.x, o.y, o.maxWidth);
  else ctx.fillText(text, o.x, o.y);
  ctx.restore();
}

/**
 * Renders Vietnamese-ready minimal titles & 90s film date stamps into a cached CanvasTexture.
 * Supports 16:9, 9:16, 1:1 canvases, per-scene captions, and EXIF auto date stamps.
 * Only redraws when text config/overrides actually change (zero per-frame CPU cost).
 */
export class TextOverlayRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  public readonly texture: THREE.CanvasTexture;
  private lastKey = '';

  constructor() {
    void loadTextFonts();
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1920;
    this.canvas.height = 1080;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.NoColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
  }

  public update(config: TextOverlayConfig, overrides: TextRenderOverrides = {}): boolean {
    const w = Math.max(320, Math.round(overrides.width ?? 1920));
    const h = Math.max(320, Math.round(overrides.height ?? 1080));
    const fullTitle = (overrides.titleOverride ?? config.title).trim();
    const fullDate = (overrides.dateOverride ?? config.dateText).trim() || "'26 11 24";
    const reveal = overrides.revealChars ?? Infinity;
    const isStamp = config.style === 'date-stamp-90s';
    const activeTitle = isStamp ? fullTitle : revealText(fullTitle, reveal);
    const activeDate = isStamp ? revealText(fullDate, reveal) : fullDate;
    const subtitle = isStamp
      ? config.subtitle
      : revealText(config.subtitle.trim(), reveal - chars(fullTitle).length);

    const look = normalizeTextLook(config.look);
    const key = `${fontEpoch}|${w}x${h}|${config.style}|${activeTitle}|${subtitle}|${activeDate}|${config.opacity}|${JSON.stringify(look ?? null)}`;
    if (key === this.lastKey) {
      return config.style !== 'none';
    }
    this.lastKey = key;

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      // The GPU copy uses immutable storage sized at first upload. Free it so Three.js
      // re-allocates at the new size, otherwise preview <-> export resizes fail to upload
      // (GL_INVALID_VALUE: offset overflows texture dimensions) and the text disappears.
      this.texture.dispose();
    }

    const ctx = this.ctx;
    if (!ctx) return false;

    ctx.clearRect(0, 0, w, h);

    if (config.style === 'none' || config.opacity <= 0.001) {
      this.texture.needsUpdate = true;
      return false;
    }

    // Scale typography proportionally for 16:9, 9:16, 1:1
    const base = Math.min(w, h) / 1080;
    const SANS = '"Be Vietnam Pro", "Segoe UI", sans-serif';
    const MONO = '"JetBrains Mono", "Consolas", monospace';
    const SERIF = '"Playfair Display", "Georgia", serif';
    const face = (family: string, weight: number, sizePx: number, italic = false): FaceDefaults => ({
      family,
      weight,
      sizePx,
      italic,
    });
    const softShadow = (alpha: number, blur: number): StyleShadow => ({ color: `rgba(0, 0, 0, ${alpha})`, blur });
    /** One line of text with the user's look (font, size, colour, spacing, outline, shadow). */
    const line = (
      text: string,
      def: FaceDefaults,
      opts: {
        align: 'left' | 'center' | 'right';
        x: number;
        y: number;
        baseline: CanvasTextBaseline;
        fill: string;
        /** Alpha of this line relative to the main colour (subtitles are a little dimmer). */
        colorAlpha?: number;
        shadow?: StyleShadow;
        maxWidth?: number;
        margin?: number;
      }
    ) => {
      if (!text) return;
      const pos = lookAlign(opts.align, opts.x, look, w, opts.margin ?? 72 * base);
      drawStyledLine(ctx, text, def, look, base, {
        ...opts,
        align: pos.align,
        x: pos.x,
        fill: look?.color ? hexToRgba(look.color, opts.colorAlpha ?? 1) : opts.fill,
      });
    };

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, config.opacity));

    switch (config.style) {
      case 'date-stamp-90s': {
        const def = face(MONO, 700, 44);
        const at = { align: 'right' as const, x: w - 72 * base, y: h - 64 * base, baseline: 'bottom' as const };
        if (look?.color || look?.shadow) {
          line(activeDate, def, { ...at, fill: '#ffb56b', shadow: { color: 'rgba(255, 85, 10, 0.9)', blur: 18 } });
        } else {
          // The glowing orange LED look: a blurred pass under a sharp one.
          line(activeDate, def, { ...at, fill: '#ff6d1f', shadow: { color: 'rgba(255, 85, 10, 0.9)', blur: 18 } });
          line(activeDate, def, { ...at, fill: '#ffb56b', shadow: { color: 'rgba(255, 85, 10, 0.9)', blur: 4 } });
        }
        break;
      }

      case 'minimal-fade': {
        line(activeTitle, face(SANS, 300, 60), {
          align: 'center', x: w * 0.5, y: h * 0.47, baseline: 'middle', fill: '#f8f6f2',
          shadow: softShadow(0.55, 16), maxWidth: w * 0.86,
        });
        if (subtitle.trim()) {
          line(subtitle.trim().toUpperCase(), face(SANS, 400, 26), {
            align: 'center', x: w * 0.5, y: h * 0.54, baseline: 'middle', fill: 'rgba(244, 240, 232, 0.85)',
            colorAlpha: 0.85, shadow: softShadow(0.55, 16), maxWidth: w * 0.86,
          });
        }
        break;
      }

      case 'editorial-serif': {
        line(activeTitle, face(SERIF, 500, 72, true), {
          align: 'center', x: w * 0.5, y: h * 0.46, baseline: 'middle', fill: '#fbf7ef',
          shadow: softShadow(0.5, 18), maxWidth: w * 0.86,
        });

        const rule = lookAlign('center', w * 0.5, look, w, 72 * base);
        const half = w * 0.07;
        const cx = rule.align === 'left' ? rule.x + half : rule.align === 'right' ? rule.x - half : rule.x;
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = look?.color ? hexToRgba(look.color, 0.55) : 'rgba(251, 247, 239, 0.55)';
        ctx.lineWidth = Math.max(1.5, 2 * base);
        ctx.beginPath();
        ctx.moveTo(cx - half, h * 0.52);
        ctx.lineTo(cx + half, h * 0.52);
        ctx.stroke();
        ctx.restore();

        if (subtitle.trim()) {
          line(subtitle.trim(), face(SANS, 400, 24), {
            align: 'center', x: w * 0.5, y: h * 0.565, baseline: 'middle', fill: 'rgba(251, 247, 239, 0.88)',
            colorAlpha: 0.88, shadow: softShadow(0.5, 18), maxWidth: w * 0.86,
          });
        }
        break;
      }

      case 'filmstrip-label': {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(255, 224, 150, 0.82)';
        ctx.font = `600 ${Math.round(22 * base)}px ${MONO}`;
        ctx.fillText(`KODAK 50D  •  ${activeDate}`, 56 * base, 42 * base);

        line(activeTitle, face(SANS, 400, 24), {
          align: 'left', x: 56 * base, y: h - 42 * base, baseline: 'bottom', fill: 'rgba(255, 245, 225, 0.82)',
          colorAlpha: 0.82, maxWidth: w * 0.85, margin: 56 * base,
        });
        break;
      }

      case 'lower-third': {
        const padX = 72 * base;
        const baseY = h - 98 * base;
        const pos = lookAlign('left', padX, look, w, padX);
        const barX = pos.align === 'right' ? w - padX - Math.max(4, 5 * base) : pos.align === 'center' ? -1 : padX;
        if (barX >= 0) {
          ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
          ctx.fillRect(barX, baseY - 42 * base, Math.max(4, 5 * base), 72 * base);
        }
        const textX = pos.align === 'left' ? padX + 22 * base : pos.align === 'right' ? w - padX - 22 * base : w / 2;
        const at = { align: pos.align, x: textX, margin: padX + 22 * base, maxWidth: w - padX * 2 };
        line(activeTitle, face(SANS, 600, 38), {
          ...at, y: baseY - 44 * base, baseline: 'top', fill: '#faf8f5', shadow: softShadow(0.65, 12),
        });
        if (subtitle.trim()) {
          line(subtitle.trim(), face(SANS, 400, 23), {
            ...at, y: baseY + 6 * base, baseline: 'top', fill: 'rgba(235, 230, 220, 0.85)', colorAlpha: 0.85,
            shadow: softShadow(0.65, 12),
          });
        }
        break;
      }
    }

    ctx.restore();
    this.texture.needsUpdate = true;
    return true;
  }

  public invalidate(): void {
    this.lastKey = '';
    this.texture.needsUpdate = true;
  }

  public dispose(): void {
    this.texture.dispose();
  }
}
