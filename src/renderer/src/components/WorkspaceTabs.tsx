import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useContextMenu } from './ContextMenu';

interface Props {
  disabled: boolean;
  onNotice: (msg: string) => void;
}

/**
 * Horizontal workspace tab strip right below TopToolbar.
 * Each folder imported via "Nhập nhiều thư mục" gets its own independent tab; all tabs share one FPS.
 */
export function WorkspaceTabs({ disabled, onNotice }: Props) {
  const workspaces = useAppStore((s) => s.workspaces);
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId);
  const activeSlidesCount = useAppStore((s) => s.slides.length);
  const activeScenesCount = useAppStore((s) => s.scenes.length);
  const switchWorkspace = useAppStore((s) => s.switchWorkspace);
  const addWorkspace = useAppStore((s) => s.addWorkspace);
  const renameWorkspace = useAppStore((s) => s.renameWorkspace);
  const duplicateWorkspace = useAppStore((s) => s.duplicateWorkspace);
  const closeWorkspace = useAppStore((s) => s.closeWorkspace);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const { menu, openAt } = useContextMenu();

  const beginRename = (id: string, currentName: string) => {
    if (disabled) return;
    setEditingId(id);
    setDraftName(currentName);
  };

  const commitRename = () => {
    if (editingId) {
      renameWorkspace(editingId, draftName);
      setEditingId(null);
    }
  };

  const applyStyleToAllOthers = (sourceId?: string) => {
    const st = useAppStore.getState();
    const activeId = sourceId ?? st.activeWorkspaceId;
    const others = st.workspaces.filter((w) => w.id !== activeId).map((w) => w.id);
    const count = st.copyStyleToWorkspaces(others);
    if (count > 0) {
      onNotice(`Đã áp phong cách (Look, LUT, Motion, Nền, Kiểu chữ) sang ${count} dự án khác.`);
    }
  };

  return (
    <>
      <div className="flex h-11 shrink-0 items-center gap-1.5 overflow-x-auto border-b border-zinc-800 bg-[#121217] px-3">
        {workspaces.map((ws) => {
          const isActive = ws.id === activeWorkspaceId;
          const sceneCount = isActive ? activeScenesCount : ws.scenes.length;
          const slideCount = isActive ? activeSlidesCount : ws.slides.length;
          const isExported = Boolean(ws.exportedInSession);

          return (
            <div
              key={ws.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                if (!disabled && editingId !== ws.id) switchWorkspace(ws.id);
              }}
              onDoubleClick={() => beginRename(ws.id, ws.name)}
              onContextMenu={(e) => {
                if (disabled) return;
                openAt(e, [
                  { label: 'Đổi tên dự án', onClick: () => beginRename(ws.id, ws.name) },
                  { label: 'Nhân bản dự án', onClick: () => duplicateWorkspace(ws.id) },
                  {
                    label: 'Áp phong cách tab đang mở sang tất cả tab khác',
                    disabled: workspaces.length < 2,
                    onClick: () => {
                      if (!isActive) switchWorkspace(ws.id);
                      applyStyleToAllOthers(ws.id);
                    },
                  },
                  { separator: true, label: '' },
                  {
                    label: workspaces.length > 1 ? 'Đóng tab này' : 'Xóa trắng dự án',
                    danger: true,
                    onClick: () => closeWorkspace(ws.id),
                  },
                ]);
              }}
              title={`${ws.name} • ${sceneCount} scene • ${slideCount} ảnh (Nháy đúp để đổi tên, chuột phải để mở menu)`}
              className={`group flex h-8 max-w-[260px] shrink-0 cursor-pointer items-center gap-2 rounded px-3 text-sm transition ${
                isActive
                  ? 'border border-amber-500/70 bg-zinc-800 text-zinc-100'
                  : 'border border-zinc-800/80 bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
              } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
            >
              {isExported ? (
                <span className="shrink-0 text-xs font-bold text-emerald-400" title="Đã xuất video trong phiên này">
                  ✓
                </span>
              ) : (
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    sceneCount > 0 ? 'bg-emerald-400' : 'bg-zinc-600'
                  }`}
                />
              )}

              {editingId === ws.id ? (
                <input
                  type="text"
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-6 w-32 rounded border border-amber-400 bg-zinc-950 px-1.5 text-sm text-zinc-100 outline-none"
                />
              ) : (
                <span className="truncate font-medium">{ws.name}</span>
              )}

              <span className="shrink-0 font-mono text-xs text-zinc-400">
                ({sceneCount > 0 ? `${sceneCount}s` : slideCount})
              </span>

              {!disabled && (
                <button
                  type="button"
                  title={workspaces.length > 1 ? 'Đóng tab' : 'Làm trống tab'}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeWorkspace(ws.id);
                  }}
                  className="ml-0.5 hidden h-5 w-5 shrink-0 items-center justify-center rounded text-sm text-zinc-400 hover:bg-zinc-700 hover:text-white group-hover:flex"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          disabled={disabled}
          onClick={() => addWorkspace()}
          title="Thêm tab dự án trống mới"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-zinc-700 bg-zinc-900 text-title font-semibold text-zinc-200 hover:border-amber-400 hover:text-amber-300 disabled:opacity-40"
        >
          +
        </button>

        {workspaces.length > 1 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => applyStyleToAllOthers()}
            title="Chép Film Look, LUT, Motion Template, Nền và Kiểu chữ của tab đang mở sang tất cả các tab khác (giữ nguyên ảnh và tiêu đề riêng)"
            className="ml-auto h-8 shrink-0 rounded border border-zinc-700 bg-zinc-900 px-3 text-xs font-medium text-zinc-200 hover:border-amber-400 hover:text-amber-300 disabled:opacity-40"
          >
            Áp phong cách sang tất cả tab
          </button>
        )}
      </div>
      {menu}
    </>
  );
}
