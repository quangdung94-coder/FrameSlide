import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Sizes of the resizable work areas. Saved per computer (localStorage), not in the project file. */
export interface LayoutPrefs {
  binWidth: number;
  inspectorWidth: number;
  timelineHeight: number;
  sceneZoom: number;
}

export const DEFAULT_LAYOUT: LayoutPrefs = {
  binWidth: 232,
  inspectorWidth: 320,
  timelineHeight: 300,
  sceneZoom: 1,
};

export const LAYOUT_LIMITS = {
  binWidth: [160, 520],
  inspectorWidth: [260, 560],
  timelineHeight: [170, 700],
  sceneZoom: [0.6, 1.8],
} as const satisfies Record<keyof LayoutPrefs, readonly [number, number]>;

export function clampLayout<K extends keyof LayoutPrefs>(key: K, value: number): number {
  const [lo, hi] = LAYOUT_LIMITS[key];
  if (!Number.isFinite(value)) return DEFAULT_LAYOUT[key];
  return Math.min(hi, Math.max(lo, value));
}

interface LayoutState extends LayoutPrefs {
  setLayout: <K extends keyof LayoutPrefs>(key: K, value: number) => void;
  resetLayout: () => void;
}

/** localStorage can throw (private mode, blocked storage): fall back to memory only. */
const safeStorage = createJSONStorage<Partial<LayoutPrefs>>(() => {
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

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      ...DEFAULT_LAYOUT,
      setLayout: (key, value) => set({ [key]: clampLayout(key, value) } as Partial<LayoutState>),
      resetLayout: () => set({ ...DEFAULT_LAYOUT }),
    }),
    {
      name: 'frameslide.layout.v1',
      storage: safeStorage,
      partialize: (s) => ({
        binWidth: s.binWidth,
        inspectorWidth: s.inspectorWidth,
        timelineHeight: s.timelineHeight,
        sceneZoom: s.sceneZoom,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<LayoutPrefs>;
        const next = { ...current };
        (Object.keys(DEFAULT_LAYOUT) as (keyof LayoutPrefs)[]).forEach((k) => {
          if (typeof p[k] === 'number') next[k] = clampLayout(k, p[k] as number);
        });
        return next;
      },
    }
  )
);
