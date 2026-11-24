import * as THREE from 'three';
import type { TextOverlayConfig } from '@shared/types';

export interface TextRenderOverrides {
  width?: number;
  height?: number;
  titleOverride?: string;
  dateOverride?: string;
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
    const activeTitle = (overrides.titleOverride ?? config.title).trim();
    const activeDate = (overrides.dateOverride ?? config.dateText).trim() || "'26 11 24";

    const key = `${w}x${h}|${config.style}|${activeTitle}|${config.subtitle}|${activeDate}|${config.opacity}`;
    if (key === this.lastKey) {
      return config.style !== 'none';
    }
    this.lastKey = key;

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
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

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, config.opacity));

    switch (config.style) {
      case 'date-stamp-90s': {
        ctx.font = `700 ${Math.round(44 * base)}px "JetBrains Mono", "Consolas", monospace`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = 'rgba(255, 85, 10, 0.9)';
        ctx.shadowBlur = 18 * base;
        ctx.fillStyle = '#ff6d1f';
        ctx.fillText(activeDate, w - 72 * base, h - 64 * base);
        ctx.shadowBlur = 4 * base;
        ctx.fillStyle = '#ffb56b';
        ctx.fillText(activeDate, w - 72 * base, h - 64 * base);
        break;
      }

      case 'minimal-fade': {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
        ctx.shadowBlur = 16 * base;
        ctx.fillStyle = '#f8f6f2';
        ctx.font = `300 ${Math.round(60 * base)}px "Be Vietnam Pro", "Segoe UI", sans-serif`;
        ctx.fillText(activeTitle, w * 0.5, h * 0.47, w * 0.86);

        if (config.subtitle.trim()) {
          ctx.fillStyle = 'rgba(244, 240, 232, 0.85)';
          ctx.font = `400 ${Math.round(26 * base)}px "Be Vietnam Pro", "Segoe UI", sans-serif`;
          ctx.fillText(config.subtitle.trim().toUpperCase(), w * 0.5, h * 0.54, w * 0.86);
        }
        break;
      }

      case 'editorial-serif': {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 18 * base;
        ctx.fillStyle = '#fbf7ef';
        ctx.font = `italic 500 ${Math.round(72 * base)}px "Playfair Display", "Georgia", serif`;
        ctx.fillText(activeTitle, w * 0.5, h * 0.46, w * 0.86);

        ctx.strokeStyle = 'rgba(251, 247, 239, 0.55)';
        ctx.lineWidth = Math.max(1.5, 2 * base);
        ctx.beginPath();
        ctx.moveTo(w * 0.43, h * 0.52);
        ctx.lineTo(w * 0.57, h * 0.52);
        ctx.stroke();

        if (config.subtitle.trim()) {
          ctx.fillStyle = 'rgba(251, 247, 239, 0.88)';
          ctx.font = `400 ${Math.round(24 * base)}px "Be Vietnam Pro", "Segoe UI", sans-serif`;
          ctx.fillText(config.subtitle.trim(), w * 0.5, h * 0.565, w * 0.86);
        }
        break;
      }

      case 'filmstrip-label': {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(255, 224, 150, 0.82)';
        ctx.font = `600 ${Math.round(22 * base)}px "JetBrains Mono", "Consolas", monospace`;
        const topLabel = `KODAK 50D  •  ${activeDate}`;
        ctx.fillText(topLabel, 56 * base, 42 * base);

        if (activeTitle) {
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = 'rgba(255, 245, 225, 0.82)';
          ctx.font = `400 ${Math.round(24 * base)}px "Be Vietnam Pro", "Segoe UI", sans-serif`;
          ctx.fillText(activeTitle, 56 * base, h - 42 * base, w * 0.85);
        }
        break;
      }

      case 'lower-third': {
        const padX = 72 * base;
        const baseY = h - 98 * base;
        ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
        ctx.fillRect(padX, baseY - 42 * base, Math.max(4, 5 * base), 72 * base);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
        ctx.shadowBlur = 12 * base;
        ctx.fillStyle = '#faf8f5';
        ctx.font = `600 ${Math.round(38 * base)}px "Be Vietnam Pro", "Segoe UI", sans-serif`;
        ctx.fillText(activeTitle, padX + 22 * base, baseY - 44 * base, w - padX * 2);

        if (config.subtitle.trim()) {
          ctx.fillStyle = 'rgba(235, 230, 220, 0.85)';
          ctx.font = `400 ${Math.round(23 * base)}px "Be Vietnam Pro", "Segoe UI", sans-serif`;
          ctx.fillText(config.subtitle.trim(), padX + 22 * base, baseY + 6 * base, w - padX * 2);
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
