import { describe, expect, it } from 'vitest';
import { join, resolve } from 'path';
import type { SlideAsset } from '@shared/types';
import { decodeMediaUrl, mergeRegeneratedSlide, parseExifDateMs } from './proxyService';

describe('decodeMediaUrl security boundary', () => {
  it('allows paths strictly inside cacheDir and rejects paths outside', () => {
    // Built from the current OS so the test passes on Windows (CI) and Linux/macOS alike
    const cacheDir = resolve('FrameSlide', 'cache');
    const validFile = join(cacheDir, 'abc123_proxy.jpg');
    const outsideFile = resolve('Windows', 'System32', 'drivers', 'etc', 'hosts');
    const escapeFile = join(cacheDir, '..', 'secret.txt');

    const validUrl = `frameslide-media://file/${Buffer.from(validFile, 'utf-8').toString('base64url')}`;
    const outsideUrl = `frameslide-media://file/${Buffer.from(outsideFile, 'utf-8').toString('base64url')}`;
    const sameDirUrl = `frameslide-media://file/${Buffer.from(cacheDir, 'utf-8').toString('base64url')}`;

    expect(decodeMediaUrl(validUrl, cacheDir)).toBe(validFile);
    expect(decodeMediaUrl(outsideUrl, cacheDir)).toBeNull();
    expect(decodeMediaUrl(sameDirUrl, cacheDir)).toBeNull();
    const escapeUrl = `frameslide-media://file/${Buffer.from(escapeFile, 'utf-8').toString('base64url')}`;
    expect(decodeMediaUrl(escapeUrl, cacheDir)).toBeNull();
    expect(decodeMediaUrl('http://example.com/a.jpg', cacheDir)).toBeNull();
  });

  it('extracts EXIF DateTimeOriginal timestamp from buffer', () => {
    const buf = Buffer.from('Exif\0\0...2025:10:18 16:45:30\0...', 'latin1');
    const ms = parseExifDateMs(buf);
    expect(ms).toBe(Date.parse('2025-10-18T16:45:30'));
    expect(parseExifDateMs(Buffer.from('no-date'))).toBeNull();
  });

  it('keeps user edits when a project slide proxy has to be regenerated', () => {
    const saved: SlideAsset = {
      id: 'old-id',
      name: 'a.jpg',
      originalPath: 'D:/photos/a.jpg',
      proxyUrl: 'frameslide-media://file/old',
      thumbUrl: 'frameslide-media://file/old-thumb',
      width: 2880,
      height: 1920,
      orientation: 'landscape',
      takenAtMs: 1000,
      focalPoint: { x: 0.3, y: 0.7 },
      rotationDeg: 90,
      exposure: 0.5,
      durationSec: 5,
      transitionType: 'film-dissolve',
    };
    const regenerated: SlideAsset = {
      ...saved,
      id: 'new-id',
      proxyUrl: 'frameslide-media://file/new',
      thumbUrl: 'frameslide-media://file/new-thumb',
      focalPoint: { x: 0.5, y: 0.5 },
      rotationDeg: undefined,
      exposure: undefined,
      durationSec: undefined,
      transitionType: undefined,
    };
    const merged = mergeRegeneratedSlide(saved, regenerated);
    expect(merged.id).toBe('old-id');
    expect(merged.proxyUrl).toBe('frameslide-media://file/new');
    expect(merged.thumbUrl).toBe('frameslide-media://file/new-thumb');
    expect(merged.rotationDeg).toBe(90);
    expect(merged.exposure).toBe(0.5);
    expect(merged.focalPoint).toEqual({ x: 0.3, y: 0.7 });
    expect(merged.durationSec).toBe(5);
    expect(merged.transitionType).toBe('film-dissolve');
  });
});
