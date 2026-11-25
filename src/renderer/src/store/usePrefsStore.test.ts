import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, normalizePrefs } from './usePrefsStore';

describe('normalizePrefs', () => {
  it('keeps valid values', () => {
    const p = { defaultFps: 25, defaultAspect: '9:16', defaultSceneSec: 4.25, filmLookOnStart: false, autosaveSec: 60,
      exportFolder: 'D:\\Xuat', exportCodec: 'prores422', openFolderAfterExport: true };
    expect(normalizePrefs(p)).toEqual({ ...p, defaultSceneSec: 4.3 });
  });
  it('falls back to defaults (film look on) for missing or bad values', () => {
    expect(normalizePrefs(undefined)).toEqual(DEFAULT_PREFS);
    expect(normalizePrefs({ defaultFps: 60, defaultAspect: '4:3', defaultSceneSec: 99, autosaveSec: 5 })).toEqual(DEFAULT_PREFS);
    expect(DEFAULT_PREFS.filmLookOnStart).toBe(true);
    expect(normalizePrefs({ exportFolder: 3, exportCodec: 'webm', openFolderAfterExport: 'yes' })).toEqual(DEFAULT_PREFS);
  });
});
