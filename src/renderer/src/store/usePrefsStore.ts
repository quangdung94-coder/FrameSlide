import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ExportCodec, OutputAspectId, SupportedFps } from '@shared/types';

/**
 * Working preferences of this computer (Đợt 5.3b, "⚙ Cài đặt"): defaults for a new project and
 * autosave. Saved in localStorage like the panel layout, not in the project file.
 */
export interface WorkPrefs {
  defaultFps: SupportedFps;
  defaultAspect: OutputAspectId;
  defaultSceneSec: number;
  /** Film look on when the app opens (D19: on by default). */
  filmLookOnStart: boolean;
  /** Autosave every N seconds (0 = off). */
  autosaveSec: 0 | 30 | 60 | 120;
  /** Đợt 6.1: folder exports go to ('' = the Videos folder) and the last format picked. */
  exportFolder: string;
  exportCodec: ExportCodec;
  openFolderAfterExport: boolean;
}

export const DEFAULT_PREFS: WorkPrefs = {
  defaultFps: 30,
  defaultAspect: '16:9',
  defaultSceneSec: 3.5,
  filmLookOnStart: true,
  autosaveSec: 30,
  exportFolder: '',
  exportCodec: 'h264',
  openFolderAfterExport: false,
};

const CODECS: readonly ExportCodec[] = ['h264', 'dnxhr_hq', 'prores422'];

const FPS: readonly SupportedFps[] = [23.976, 24, 25, 30];
const ASPECTS: readonly OutputAspectId[] = ['16:9', '9:16', '1:1'];
const AUTOSAVE: readonly WorkPrefs['autosaveSec'][] = [0, 30, 60, 120];

export function normalizePrefs(raw: unknown): WorkPrefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof WorkPrefs, unknown>>;
  const sec = Number(r.defaultSceneSec);
  return {
    defaultFps: FPS.includes(r.defaultFps as SupportedFps) ? (r.defaultFps as SupportedFps) : DEFAULT_PREFS.defaultFps,
    defaultAspect: ASPECTS.includes(r.defaultAspect as OutputAspectId)
      ? (r.defaultAspect as OutputAspectId)
      : DEFAULT_PREFS.defaultAspect,
    defaultSceneSec: Number.isFinite(sec) && sec >= 1 && sec <= 15 ? Math.round(sec * 10) / 10 : DEFAULT_PREFS.defaultSceneSec,
    filmLookOnStart: typeof r.filmLookOnStart === 'boolean' ? r.filmLookOnStart : DEFAULT_PREFS.filmLookOnStart,
    autosaveSec: AUTOSAVE.includes(r.autosaveSec as WorkPrefs['autosaveSec'])
      ? (r.autosaveSec as WorkPrefs['autosaveSec'])
      : DEFAULT_PREFS.autosaveSec,
    exportFolder: typeof r.exportFolder === 'string' ? r.exportFolder.slice(0, 1000) : DEFAULT_PREFS.exportFolder,
    exportCodec: CODECS.includes(r.exportCodec as ExportCodec) ? (r.exportCodec as ExportCodec) : DEFAULT_PREFS.exportCodec,
    openFolderAfterExport:
      typeof r.openFolderAfterExport === 'boolean' ? r.openFolderAfterExport : DEFAULT_PREFS.openFolderAfterExport,
  };
}

interface PrefsState extends WorkPrefs {
  setPrefs: (patch: Partial<WorkPrefs>) => void;
  resetPrefs: () => void;
}

const safeStorage = createJSONStorage<Partial<WorkPrefs>>(() => {
  try {
    const probe = '__frameslide_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
  }
});

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_PREFS,
      setPrefs: (patch) => {
        const { setPrefs: _a, resetPrefs: _b, ...current } = get();
        set(normalizePrefs({ ...current, ...patch }));
      },
      // Export folder / format are not "defaults for a new project": keep them.
      resetPrefs: () => set((s) => ({ ...DEFAULT_PREFS, exportFolder: s.exportFolder, exportCodec: s.exportCodec, openFolderAfterExport: s.openFolderAfterExport })),
    }),
    {
      name: 'frameslide.prefs.v1',
      storage: safeStorage,
      partialize: ({ setPrefs: _a, resetPrefs: _b, ...prefs }) => prefs,
      merge: (persisted, current) => ({ ...current, ...normalizePrefs(persisted) }),
    }
  )
);
