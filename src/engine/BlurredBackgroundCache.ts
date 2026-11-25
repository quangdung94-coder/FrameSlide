import * as THREE from 'three';
import type { BackgroundBlurKind } from '@shared/types';
import { BLUR_TEXTURE_EDGE, blurCacheKey, blurRecipe } from './backgroundBlur';

type Drawable = CanvasImageSource & { width: number; height: number };

/**
 * Small blurred copies of photos for the "Ảnh mờ" background (D29). Each copy is made once per
 * photo + blur type + strength with canvas drawing (GPU-accelerated, no per-frame work), kept
 * in a small LRU and read once by the shader. Grain uses a fixed seed, so it never changes
 * between preview and export.
 */
export class BlurredBackgroundCache {
  private readonly cache = new Map<string, THREE.CanvasTexture>();

  constructor(private readonly maxEntries = 16) {}

  public get(url: string, image: unknown, kind: BackgroundBlurKind, amount: number): THREE.Texture | null {
    const key = blurCacheKey(url, kind, amount);
    const hit = this.cache.get(key);
    if (hit) {
      this.cache.delete(key);
      this.cache.set(key, hit);
      return hit;
    }
    const img = image as Drawable | null;
    if (!img || typeof document === 'undefined' || !(img.width > 0) || !(img.height > 0)) return null;
    const canvas = makeBlurredCopy(img, kind, amount);
    if (!canvas) return null;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    this.cache.set(key, tex);
    while (this.cache.size > this.maxEntries) {
      const oldest = this.cache.keys().next().value as string;
      this.cache.get(oldest)?.dispose();
      this.cache.delete(oldest);
    }
    return tex;
  }

  public clear(): void {
    for (const t of this.cache.values()) t.dispose();
    this.cache.clear();
  }
}

function makeBlurredCopy(img: Drawable, kind: BackgroundBlurKind, amount: number): HTMLCanvasElement | null {
  const k = BLUR_TEXTURE_EDGE / Math.max(img.width, img.height);
  const w = Math.max(8, Math.round(img.width * k));
  const h = Math.max(8, Math.round(img.height * k));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const recipe = blurRecipe(kind, amount);
  // Draw a little larger than the canvas so the blur does not pull dark edges in.
  const pad = recipe.filterPx * 2;
  ctx.filter = recipe.filterPx > 0.05 ? `blur(${recipe.filterPx.toFixed(2)}px)` : 'none';
  for (const p of recipe.passes) {
    ctx.globalAlpha = p.alpha;
    const pw = (w + pad * 2) * p.scale;
    const ph = (h + pad * 2) * p.scale;
    ctx.drawImage(img, (w - pw) / 2 + p.dx * w, (h - ph) / 2, pw, ph);
  }
  ctx.filter = 'none';
  ctx.globalAlpha = 1;

  if (recipe.noise > 0) {
    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;
    // Fixed-seed xorshift: the same grain every time.
    let s = 0x9e3779b9;
    for (let i = 0; i < px.length; i += 4) {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      const n = ((s >>> 0) / 4294967296 - 0.5) * 2 * recipe.noise * 255;
      px[i] = Math.max(0, Math.min(255, px[i] + n));
      px[i + 1] = Math.max(0, Math.min(255, px[i + 1] + n));
      px[i + 2] = Math.max(0, Math.min(255, px[i + 2] + n));
    }
    ctx.putImageData(data, 0, 0);
  }
  return canvas;
}
