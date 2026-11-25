import { mkdtempSync, mkdirSync, readdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { clearCacheFiles, getCacheStats, normalizeAppSettings, readAppSettings, writeAppSettings } from './appSettings';

describe('normalizeAppSettings', () => {
  it('fills defaults and drops bad values', () => {
    expect(normalizeAppSettings(null)).toEqual({ cacheDir: null, proxyMaxEdge: 2880 });
    expect(normalizeAppSettings({ cacheDir: '  ', proxyMaxEdge: 999 })).toEqual({ cacheDir: null, proxyMaxEdge: 2880 });
    expect(normalizeAppSettings({ cacheDir: 'D:/cache', proxyMaxEdge: 3200 })).toEqual({ cacheDir: 'D:/cache', proxyMaxEdge: 3200 });
  });
});

describe('settings file and cache', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fs-settings-'));
  it('round-trips the settings file and survives a broken file', () => {
    const file = join(dir, 'settings.json');
    writeAppSettings(file, { cacheDir: null, proxyMaxEdge: 2560 });
    expect(readAppSettings(file).proxyMaxEdge).toBe(2560);
    writeFileSync(file, '{oops');
    expect(readAppSettings(file).proxyMaxEdge).toBe(2880);
  });

  it('counts and clears cache files, keeping the ones in use and the samples', async () => {
    const cache = join(dir, 'cache');
    mkdirSync(join(cache, 'samples'), { recursive: true });
    writeFileSync(join(cache, 'aaa_proxy.jpg'), Buffer.alloc(100));
    writeFileSync(join(cache, 'aaa_thumb.jpg'), Buffer.alloc(10));
    writeFileSync(join(cache, 'bbb_proxy.jpg'), Buffer.alloc(200));
    writeFileSync(join(cache, 'notes.txt'), 'keep');
    const stats = await getCacheStats(cache);
    expect(stats).toMatchObject({ files: 3, bytes: 310 });
    const removed = await clearCacheFiles(cache, [join(cache, 'aaa_proxy.jpg'), join(cache, 'aaa_thumb.jpg')]);
    expect(removed).toBe(1);
    expect(readdirSync(cache).sort()).toEqual(['aaa_proxy.jpg', 'aaa_thumb.jpg', 'notes.txt', 'samples']);
    expect((await getCacheStats(join(dir, 'missing'))).files).toBe(0);
  });
});
