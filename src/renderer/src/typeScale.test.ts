import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Đợt 5.3a: every component uses the shared type scale (text-2xs / xs / sm / title), no odd px sizes. */
function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return tsxFiles(p);
    return p.endsWith('.tsx') ? [p] : [];
  });
}

describe('type scale', () => {
  it('no arbitrary text-[Npx] font sizes in components', () => {
    const offenders = tsxFiles(join(__dirname))
      .filter((f) => /text-\[\d+(\.\d+)?px\]/.test(readFileSync(f, 'utf8')))
      .map((f) => f.replace(__dirname, ''));
    expect(offenders).toEqual([]);
  });

  it('fonts are bundled, not loaded from Google Fonts', () => {
    const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
    expect(html).not.toContain('fonts.googleapis.com');
  });
});
