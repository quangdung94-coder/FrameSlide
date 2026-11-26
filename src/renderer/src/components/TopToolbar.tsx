import type { PreviewQuality, SupportedFps } from '@shared/types';
import { useAppStore } from '../store/useAppStore';
import { useLayoutStore } from '../store/useLayoutStore';
import { useContextMenu } from './ContextMenu';

const FPS_OPTIONS: SupportedFps[] = [23.976, 24, 25, 30];
const QUALITY_OPTIONS: { value: PreviewQuality; label: string }[] = [
  { value: 'auto', label: 'Tự động' },
  { value: 'half', label: 'Nửa (540p)' },
  { value: 'full', label: 'Đầy đủ (1080p)' },
];

interface Props {
  /** Photos are being loaded (import buttons are disabled). */
  busy: boolean;
  isExporting: boolean;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onPickImages: () => void;
  onPickFolder: () => void;
  onPickMultiFolders: () => void;
  onLoadSamples: () => void;
  onShowShortcuts: () => void;
  onShowSettings: () => void;
  onShowExport: () => void;
}

/** Top bar in 3 groups: [File + undo] [Import ▾] ...... [FPS, preview, layout, ?] [EXPORT]. */
export function TopToolbar({
  busy,
  isExporting,
  onOpenProject,
  onSaveProject,
  onPickImages,
  onPickFolder,
  onPickMultiFolders,
  onLoadSamples,
  onShowShortcuts,
  onShowSettings,
  onShowExport,
}: Props) {
  const fps = useAppStore((s) => s.fps);
  const setFps = useAppStore((s) => s.setFps);
  const previewQuality = useAppStore((s) => s.previewQuality);
  const setPreviewQuality = useAppStore((s) => s.setPreviewQuality);
  const projectFilePath = useAppStore((s) => s.projectFilePath);
  const canUndo = useAppStore((s) => s.past.length > 0);
  const canRedo = useAppStore((s) => s.future.length > 0);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const resetLayout = useLayoutStore((s) => s.resetLayout);
  const { menu: topMenu, openAt: openTopMenu } = useContextMenu();

  return (
    <>
    <header className="flex items-center justify-between gap-3 border-b border-zinc-800 bg-[#16161b] px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <span className="mr-1 text-title font-bold tracking-wide text-amber-400">FRAMESLIDE</span>
        <div className="mx-1 h-6 w-px bg-zinc-700" />
        <button
          onClick={onOpenProject}
          disabled={!window.frameSlideAPI || isExporting}
          title="Mở dự án (.frameslide)"
          className="h-9 rounded border border-zinc-700 px-3.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
        >
          Mở
        </button>
        <button
          onClick={onSaveProject}
          disabled={!window.frameSlideAPI || isExporting}
          title={projectFilePath ?? 'Lưu dự án (Ctrl+S)'}
          className="h-9 rounded border border-zinc-700 px-3.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
        >
          Lưu
        </button>
        <button
          onClick={undo}
          disabled={!canUndo || isExporting}
          title="Hoàn tác (Ctrl+Z)"
          aria-label="Hoàn tác"
          className="h-9 w-9 rounded border border-zinc-700 text-title text-zinc-200 hover:bg-zinc-800 disabled:opacity-30"
        >
          ↶
        </button>
        <button
          onClick={redo}
          disabled={!canRedo || isExporting}
          title="Làm lại (Ctrl+Y)"
          aria-label="Làm lại"
          className="h-9 w-9 rounded border border-zinc-700 text-title text-zinc-200 hover:bg-zinc-800 disabled:opacity-30"
        >
          ↷
        </button>

        <div className="mx-1 h-6 w-px bg-zinc-700" />

        <button
          type="button"
          disabled={busy || isExporting}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            openTopMenu({ clientX: r.left, clientY: r.bottom + 4 }, [
              { label: 'Chọn ảnh…', onClick: onPickImages, disabled: !window.frameSlideAPI },
              { label: 'Chọn thư mục…', onClick: onPickFolder, disabled: !window.frameSlideAPI },
              {
                label: 'Nhập nhiều thư mục (mỗi thư mục 1 tab)…',
                onClick: onPickMultiFolders,
                disabled: !window.frameSlideAPI,
              },
              { separator: true, label: '' },
              { label: 'Ảnh mẫu', onClick: onLoadSamples },
            ]);
          }}
          className="h-9 rounded bg-amber-500 px-4 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
        >
          + Nhập ▾
        </button>
      </div>

      <div className="flex items-center gap-2.5 text-sm">
        <label className="flex items-center gap-1.5 text-zinc-400">
          FPS
          <select
            value={fps}
            disabled={isExporting}
            onChange={(e) => setFps(Number(e.target.value) as SupportedFps)}
            className="h-9 rounded border border-zinc-700 bg-zinc-900 px-2.5 text-sm text-zinc-100"
          >
            {FPS_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v} fps
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-zinc-400">
          Xem trước
          <select
            value={previewQuality}
            disabled={isExporting}
            onChange={(e) => setPreviewQuality(e.target.value as PreviewQuality)}
            className="h-9 rounded border border-zinc-700 bg-zinc-900 px-2.5 text-sm text-zinc-100"
          >
            {QUALITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={resetLayout}
          title="Đặt lại kích thước khay ảnh, timeline, bảng bên phải và zoom thẻ scene về mặc định"
          className="h-9 rounded border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200 hover:border-amber-400 hover:text-amber-300"
        >
          ⟲ Bố cục
        </button>

        <button
          type="button"
          onClick={onShowShortcuts}
          title="Bảng phím tắt dựng phim"
          className="h-9 w-9 rounded border border-zinc-700 bg-zinc-900 text-sm font-semibold text-zinc-200 hover:border-amber-400 hover:text-amber-300"
        >
          ?
        </button>

        <button
          type="button"
          onClick={onShowSettings}
          title="Cài đặt phần mềm: thư mục cache, cỡ proxy, mặc định dự án mới, tự lưu"
          aria-label="Cài đặt"
          className="flex h-9 w-9 items-center justify-center rounded border border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-amber-400 hover:text-amber-300"
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        <div className="mx-1 h-6 w-px bg-zinc-700" />

        <button
          type="button"
          onClick={onShowExport}
          title="Xuất video (Ctrl+E)"
          className={`h-9 rounded px-5 text-sm font-bold text-zinc-950 shadow ${
            isExporting ? 'animate-pulse bg-emerald-400' : 'bg-orange-500 hover:bg-orange-400'
          }`}
        >
          {isExporting ? 'Đang xuất…' : 'XUẤT ▸'}
        </button>
      </div>
    </header>
    {topMenu}
    </>
  );
}
