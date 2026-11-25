/**
 * App-wide settings saved on this computer (Đợt 5.3b): cache folder and proxy size.
 * Stored as JSON in Electron's userData folder; never inside a project file.
 * No accounts, keys or telemetry (D01).
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { readdir, stat, unlink } from 'fs/promises';
import { join, resolve } from 'path';
import type { AppSettings, CacheStats } from '@shared/types';

export const PROXY_EDGE_CHOICES = [2560, 2880, 3200] as const;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  cacheDir: null,
  proxyMaxEdge: 2880,
};

/** Fill gaps / drop bad values from a settings file (old version, hand edits). */
export function normalizeAppSettings(raw: unknown): AppSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof AppSettings, unknown>>;
  const edge = Number(r.proxyMaxEdge);
  return {
    cacheDir: typeof r.cacheDir === 'string' && r.cacheDir.trim() ? r.cacheDir.trim() : null,
    proxyMaxEdge: (PROXY_EDGE_CHOICES as readonly number[]).includes(edge)
      ? (edge as AppSettings['proxyMaxEdge'])
      : DEFAULT_APP_SETTINGS.proxyMaxEdge,
  };
}

export function readAppSettings(file: string): AppSettings {
  try {
    if (!existsSync(file)) return { ...DEFAULT_APP_SETTINGS };
    return normalizeAppSettings(JSON.parse(readFileSync(file, 'utf-8')));
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

export function writeAppSettings(file: string, settings: AppSettings): AppSettings {
  const clean = normalizeAppSettings(settings);
  writeFileSync(file, JSON.stringify(clean, null, 2), 'utf-8');
  return clean;
}

/** Files the cache owns: proxies and thumbnails at the top level (samples stay). */
function isCacheFile(name: string): boolean {
  return /_(proxy|thumb)\.jpg$/i.test(name);
}

export async function getCacheStats(dir: string): Promise<CacheStats> {
  let bytes = 0;
  let files = 0;
  try {
    for (const name of await readdir(dir)) {
      if (!isCacheFile(name)) continue;
      try {
        bytes += (await stat(join(dir, name))).size;
        files++;
      } catch {
        // file vanished meanwhile
      }
    }
  } catch {
    // folder missing: empty cache
  }
  return { dir, bytes, files };
}

/**
 * Delete cached proxies / thumbnails, except `keepPaths` (files the open project still shows).
 * Returns how many files were removed.
 */
export async function clearCacheFiles(dir: string, keepPaths: readonly string[]): Promise<number> {
  const keep = new Set(keepPaths.map((p) => resolve(p).toLowerCase()));
  let removed = 0;
  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch {
    return 0;
  }
  for (const name of names) {
    if (!isCacheFile(name)) continue;
    const full = join(dir, name);
    if (keep.has(resolve(full).toLowerCase())) continue;
    try {
      await unlink(full);
      removed++;
    } catch {
      // in use or already gone
    }
  }
  return removed;
}
