import { createHash } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { readdir, stat } from 'fs/promises';
import { basename, extname, join, relative, resolve } from 'path';
import sharp from 'sharp';
import type { ImageOrientation, SlideAsset } from '@shared/types';

const PROXY_MAX_EDGE = 2880;
const THUMB_WIDTH = 320;
const SUPPORTED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff']);

function detectOrientation(width: number, height: number): ImageOrientation {
  if (width > height * 1.05) return 'landscape';
  if (height > width * 1.05) return 'portrait';
  return 'square';
}

function defaultFocalFor(orientation: ImageOrientation): { x: number; y: number } {
  return orientation === 'portrait' ? { x: 0.5, y: 0.36 } : { x: 0.5, y: 0.5 };
}

/**
 * Extracts EXIF DateTimeOriginal (YYYY:MM:DD HH:MM:SS) from raw EXIF buffer if available.
 */
export function parseExifDateMs(exifBuffer?: Buffer): number | null {
  if (!exifBuffer || exifBuffer.length < 19) return null;
  const ascii = exifBuffer.toString('latin1');
  const match = ascii.match(/(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, m, d, hh, mm, ss] = match;
  const parsed = Date.parse(`${y}-${m}-${d}T${hh}:${mm}:${ss}`);
  return Number.isNaN(parsed) ? null : parsed;
}

function toMediaUrl(filePath: string): string {
  const encoded = Buffer.from(filePath, 'utf-8').toString('base64url');
  return `frameslide-media://file/${encoded}`;
}

export function decodeMediaUrl(url: string, allowedRootDir?: string): string | null {
  const prefix = 'frameslide-media://file/';
  if (!url.startsWith(prefix)) return null;
  const encoded = url.slice(prefix.length).split('?')[0];
  if (!encoded) return null;
  try {
    const decoded = resolve(Buffer.from(encoded, 'base64url').toString('utf-8'));
    if (allowedRootDir) {
      const root = resolve(allowedRootDir);
      const rel = relative(root, decoded);
      if (rel.startsWith('..') || rel === '' || rel.includes(':')) {
        return null;
      }
    }
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Merges a freshly regenerated proxy into a slide loaded from a saved project:
 * only the cache-related fields change, every user edit (rotation, exposure, focal
 * point, per-slide duration/transition...) and the original id are kept.
 */
export function mergeRegeneratedSlide(saved: SlideAsset, regenerated: SlideAsset): SlideAsset {
  return {
    ...saved,
    proxyUrl: regenerated.proxyUrl,
    thumbUrl: regenerated.thumbUrl,
    width: regenerated.width,
    height: regenerated.height,
    orientation: regenerated.orientation,
    takenAtMs: saved.takenAtMs ?? regenerated.takenAtMs,
    focalPoint: saved.focalPoint ?? regenerated.focalPoint,
  };
}

export async function collectImagePaths(inputPaths: string[], maxDepth = 2): Promise<string[]> {
  const collected: string[] = [];

  async function walk(target: string, depth: number): Promise<void> {
    try {
      const st = await stat(target);
      if (st.isFile()) {
        if (SUPPORTED_EXTS.has(extname(target).toLowerCase())) {
          collected.push(target);
        }
        return;
      }
      if (st.isDirectory() && depth <= maxDepth) {
        const entries = await readdir(target, { withFileTypes: true });
        for (const entry of entries) {
          await walk(join(target, entry.name), depth + 1);
        }
      }
    } catch {
      // Ignore unreadable paths
    }
  }

  for (const p of inputPaths) {
    await walk(p, 0);
  }
  return collected;
}

export async function createImageProxy(
  originalPath: string,
  cacheDir: string
): Promise<SlideAsset> {
  mkdirSync(cacheDir, { recursive: true });

  const fileStat = await stat(originalPath);
  const hashInput = `${originalPath}|${fileStat.size}|${Math.round(fileStat.mtimeMs)}`;
  const id = createHash('sha1').update(hashInput).digest('hex').slice(0, 12);
  const proxyPath = join(cacheDir, `${id}_proxy.jpg`);
  const thumbPath = join(cacheDir, `${id}_thumb.jpg`);

  const rawMeta = await sharp(originalPath).metadata();
  const takenAtMs = parseExifDateMs(rawMeta.exif) ?? Math.round(fileStat.mtimeMs);

  // Reuse cached proxy/thumb if unchanged on disk
  if (existsSync(proxyPath) && existsSync(thumbPath)) {
    const meta = await sharp(proxyPath).metadata();
    const w = meta.width ?? 1920;
    const h = meta.height ?? 1080;
    const orientation = detectOrientation(w, h);
    return {
      id,
      name: basename(originalPath),
      originalPath,
      proxyUrl: toMediaUrl(proxyPath),
      thumbUrl: toMediaUrl(thumbPath),
      width: w,
      height: h,
      orientation,
      takenAtMs,
      focalPoint: defaultFocalFor(orientation),
    };
  }

  const base = sharp(originalPath).rotate();
  const proxyInfo = await base
    .clone()
    .resize({
      width: PROXY_MAX_EDGE,
      height: PROXY_MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(proxyPath);

  await base
    .clone()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(thumbPath);

  const orientation = detectOrientation(proxyInfo.width, proxyInfo.height);
  return {
    id,
    name: basename(originalPath),
    originalPath,
    proxyUrl: toMediaUrl(proxyPath),
    thumbUrl: toMediaUrl(thumbPath),
    width: proxyInfo.width,
    height: proxyInfo.height,
    orientation,
    takenAtMs,
    focalPoint: defaultFocalFor(orientation),
  };
}

export async function createImageProxiesBatch(
  paths: string[],
  cacheDir: string,
  concurrency = 4
): Promise<{ assets: SlideAsset[]; failedFiles: string[] }> {
  const assets: (SlideAsset | null)[] = new Array(paths.length).fill(null);
  const failedFiles: string[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < paths.length) {
      const idx = cursor++;
      const filePath = paths[idx];
      try {
        assets[idx] = await createImageProxy(filePath, cacheDir);
      } catch {
        failedFiles.push(basename(filePath));
      }
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), paths.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return {
    assets: assets.filter((item): item is SlideAsset => item !== null),
    failedFiles,
  };
}

export async function ensureSamplePhotos(cacheDir: string): Promise<SlideAsset[]> {
  const sampleDir = join(cacheDir, 'samples');
  mkdirSync(sampleDir, { recursive: true });

  const specs: { filename: string; width: number; height: number; svg: string }[] = [
    {
      filename: 'sample_01_golden_hour_landscape.jpg',
      width: 2400,
      height: 1600,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1600" viewBox="0 0 2400 1600">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1b2440"/>
            <stop offset="48%" stop-color="#6b3d4a"/>
            <stop offset="78%" stop-color="#d97f43"/>
            <stop offset="100%" stop-color="#2b1e1b"/>
          </linearGradient>
          <radialGradient id="sun" cx="68%" cy="42%" r="34%">
            <stop offset="0%" stop-color="#fffdf5"/>
            <stop offset="18%" stop-color="#ffdfa0"/>
            <stop offset="45%" stop-color="#ff8c42" stop-opacity="0.7"/>
            <stop offset="100%" stop-color="#ff8c42" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="2400" height="1600" fill="url(#sky)"/>
        <rect width="2400" height="1600" fill="url(#sun)"/>
        <circle cx="1632" cy="672" r="108" fill="#ffffff"/>
        <path d="M0 1120 Q520 960 1100 1090 T2400 1020 L2400 1600 L0 1600 Z" fill="#181316"/>
        <path d="M0 1240 Q700 1110 1480 1230 T2400 1180 L2400 1600 L0 1600 Z" fill="#0d0a0c"/>
        <circle cx="940" cy="1080" r="34" fill="#181316"/>
        <rect x="916" y="1114" width="48" height="150" rx="18" fill="#181316"/>
        <circle cx="1015" cy="1095" r="31" fill="#181316"/>
        <path d="M988 1126 L1042 1126 L1068 1280 L964 1280 Z" fill="#181316"/>
      </svg>`,
    },
    {
      filename: 'sample_02_wedding_portrait.jpg',
      width: 1600,
      height: 2400,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="2400" viewBox="0 0 1600 2400">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#2e382f"/>
            <stop offset="55%" stop-color="#5d5142"/>
            <stop offset="100%" stop-color="#1e1b18"/>
          </linearGradient>
          <radialGradient id="lamp" cx="25%" cy="22%" r="36%">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="25%" stop-color="#ffe7ba"/>
            <stop offset="100%" stop-color="#ffe7ba" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="1600" height="2400" fill="url(#bg)"/>
        <rect width="1600" height="2400" fill="url(#lamp)"/>
        <circle cx="400" cy="528" r="78" fill="#fffef8"/>
        <circle cx="800" cy="690" r="145" fill="#e6c8b0"/>
        <path d="M655 690 Q800 500 945 690 Q910 560 800 555 Q690 560 655 690 Z" fill="#2b211b"/>
        <path d="M560 920 Q800 840 1040 920 L1140 2400 L460 2400 Z" fill="#f3eee6"/>
        <rect x="110" y="110" width="1380" height="2180" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="6"/>
      </svg>`,
    },
    {
      filename: 'sample_03_bride_portrait.jpg',
      width: 1600,
      height: 2400,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="2400" viewBox="0 0 1600 2400">
        <defs>
          <linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3c2f2f"/>
            <stop offset="50%" stop-color="#7c5c4c"/>
            <stop offset="100%" stop-color="#201917"/>
          </linearGradient>
          <radialGradient id="glow2" cx="72%" cy="24%" r="38%">
            <stop offset="0%" stop-color="#fffef5"/>
            <stop offset="30%" stop-color="#ffd599"/>
            <stop offset="100%" stop-color="#ffd599" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="1600" height="2400" fill="url(#bg2)"/>
        <rect width="1600" height="2400" fill="url(#glow2)"/>
        <circle cx="1152" cy="576" r="72" fill="#ffffff"/>
        <circle cx="760" cy="720" r="138" fill="#ebd0bc"/>
        <path d="M530 950 Q760 870 990 950 L1120 2400 L400 2400 Z" fill="#faf6f0"/>
      </svg>`,
    },
    {
      filename: 'sample_04_evening_lights_landscape.jpg',
      width: 2400,
      height: 1600,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1600" viewBox="0 0 2400 1600">
        <defs>
          <linearGradient id="night" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0d1526"/>
            <stop offset="65%" stop-color="#1f2c3f"/>
            <stop offset="100%" stop-color="#141112"/>
          </linearGradient>
          <radialGradient id="bokeh" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#fffef5"/>
            <stop offset="45%" stop-color="#ffcf77" stop-opacity="0.85"/>
            <stop offset="100%" stop-color="#ff8c3a" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="2400" height="1600" fill="url(#night)"/>
        <circle cx="420" cy="460" r="120" fill="url(#bokeh)"/>
        <circle cx="780" cy="390" r="85" fill="url(#bokeh)"/>
        <circle cx="1180" cy="450" r="140" fill="url(#bokeh)"/>
        <circle cx="1580" cy="380" r="95" fill="url(#bokeh)"/>
        <circle cx="1960" cy="470" r="125" fill="url(#bokeh)"/>
        <circle cx="1180" cy="450" r="46" fill="#ffffff"/>
        <circle cx="420" cy="460" r="36" fill="#ffffff"/>
        <circle cx="1960" cy="470" r="38" fill="#ffffff"/>
        <rect x="0" y="1080" width="2400" height="520" fill="#171210"/>
        <rect x="340" y="1020" width="1720" height="60" rx="8" fill="#d8cbb8" fill-opacity="0.22"/>
      </svg>`,
    },
  ];

  const assets: SlideAsset[] = [];
  for (const spec of specs) {
    const rawPath = join(sampleDir, spec.filename);
    if (!existsSync(rawPath)) {
      await sharp(Buffer.from(spec.svg))
        .jpeg({ quality: 95, mozjpeg: true })
        .toFile(rawPath);
    }
    const asset = await createImageProxy(rawPath, cacheDir);
    assets.push(asset);
  }
  return assets;
}
