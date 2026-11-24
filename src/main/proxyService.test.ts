import { describe, expect, it } from 'vitest';
import { join } from 'path';
import { decodeMediaUrl, parseExifDateMs } from './proxyService';

describe('decodeMediaUrl security boundary', () => {
  it('allows paths strictly inside cacheDir and rejects paths outside', () => {
    const cacheDir = 'D:\\FrameSlide\\cache';
    const validFile = join(cacheDir, 'abc123_proxy.jpg');
    const outsideFile = 'C:\\Windows\\System32\\drivers\\etc\\hosts';

    const validUrl = `frameslide-media://file/${Buffer.from(validFile, 'utf-8').toString('base64url')}`;
    const outsideUrl = `frameslide-media://file/${Buffer.from(outsideFile, 'utf-8').toString('base64url')}`;
    const sameDirUrl = `frameslide-media://file/${Buffer.from(cacheDir, 'utf-8').toString('base64url')}`;

    expect(decodeMediaUrl(validUrl, cacheDir)).toBe(validFile);
    expect(decodeMediaUrl(outsideUrl, cacheDir)).toBeNull();
    expect(decodeMediaUrl(sameDirUrl, cacheDir)).toBeNull();
    expect(decodeMediaUrl('http://example.com/a.jpg', cacheDir)).toBeNull();
  });

  it('extracts EXIF DateTimeOriginal timestamp from buffer', () => {
    const buf = Buffer.from('Exif\0\0...2025:10:18 16:45:30\0...', 'latin1');
    const ms = parseExifDateMs(buf);
    expect(ms).toBe(Date.parse('2025-10-18T16:45:30'));
    expect(parseExifDateMs(Buffer.from('no-date'))).toBeNull();
  });
});
