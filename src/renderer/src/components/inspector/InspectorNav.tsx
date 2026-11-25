import type { ReactNode } from 'react';
import type { SlideAsset } from '@shared/types';
import { useAppStore, type InspectorScope } from '../../store/useAppStore';

export type InspectorTab = 'template' | 'look' | 'text';

const PROJECT_TABS: [InspectorTab, string][] = [
  ['template', 'Template'],
  ['look', 'Look/LUT'],
  ['text', 'Chữ'],
];

interface Props {
  /** Index of the selected scene (-1 = none). */
  activeSceneIndex: number;
  photo: SlideAsset | null;
  photoLabel: string;
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
}

function Crumb({ scope, title, shrink, children }: { scope: InspectorScope; title?: string; shrink?: boolean; children: ReactNode }) {
  const active = useAppStore((s) => s.inspectorScope === scope);
  const setInspectorScope = useAppStore((s) => s.setInspectorScope);
  return (
    <button
      type="button"
      onClick={() => setInspectorScope(scope)}
      title={title}
      className={`h-7 rounded px-2 hover:bg-zinc-800 ${shrink ? 'min-w-0 truncate' : 'shrink-0'} ${
        active ? 'font-semibold text-amber-400' : 'text-zinc-300'
      }`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="text-zinc-600">›</span>;

/** Breadcrumb `Dự án › Scene 2 › Ảnh 1` (click to change what the panel edits) + project tabs. */
export function InspectorNav({ activeSceneIndex, photo, photoLabel, activeTab, onTabChange }: Props) {
  const inspectorScope = useAppStore((s) => s.inspectorScope);

  return (
    <>
      <nav
        aria-label="Đang chỉnh"
        className="flex h-9 shrink-0 items-center gap-1 overflow-hidden border-b border-zinc-800 bg-[#16161b] px-2 text-xs"
      >
        <Crumb scope="project">Dự án</Crumb>
        {activeSceneIndex >= 0 && (
          <>
            <Sep />
            <Crumb scope="scene">Scene {activeSceneIndex + 1}</Crumb>
          </>
        )}
        {activeSceneIndex >= 0 && photo && (
          <>
            <Sep />
            <Crumb scope="photo" title={photo.name} shrink>
              {photoLabel}
            </Crumb>
          </>
        )}
      </nav>
      {inspectorScope === 'project' && (
        <div className="grid grid-cols-3 border-b border-zinc-800 bg-[#16161b] text-xs font-medium">
          {PROJECT_TABS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`py-2 transition-colors ${
                activeTab === id
                  ? 'border-b-2 border-amber-400 bg-zinc-900/60 text-amber-400'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
