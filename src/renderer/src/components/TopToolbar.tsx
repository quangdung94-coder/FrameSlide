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
  onLoadSamples: () => void;
  onShowShortcuts: () => void;
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
  onLoadSamples,
  onShowShortcuts,
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
    <header className="flex items-center justify-between gap-3 border-b border-zinc-800 bg-[#16161b] px-3 py-2">
      <div className="flex items-center gap-1.5">
        <span className="mr-1 text-sm font-semibold tracking-wide text-amber-400">FRAMESLIDE</span>
        <div className="mx-1 h-5 w-px bg-zinc-700" />
        <button
          onClick={onOpenProject}
          disabled={!window.frameSlideAPI || isExporting}
          title="Mở dự án (.frameslide)"
          className="h-8 rounded border border-zinc-800 px-3 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
        >
          Mở
        </button>
        <button
          onClick={onSaveProject}
          disabled={!window.frameSlideAPI || isExporting}
          title={projectFilePath ?? 'Lưu dự án (Ctrl+S)'}
          className="h-8 rounded border border-zinc-800 px-3 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
        >
          Lưu
        </button>
        <button
          onClick={undo}
          disabled={!canUndo || isExporting}
          title="Hoàn tác (Ctrl+Z)"
          aria-label="Hoàn tác"
          className="h-8 w-8 rounded border border-zinc-800 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
        >
          ↶
        </button>
        <button
          onClick={redo}
          disabled={!canRedo || isExporting}
          title="Làm lại (Ctrl+Y)"
          aria-label="Làm lại"
          className="h-8 w-8 rounded border border-zinc-800 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
        >
          ↷
        </button>

        <div className="mx-1 h-5 w-px bg-zinc-700" />

        <button
          type="button"
          disabled={busy || isExporting}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            openTopMenu({ clientX: r.left, clientY: r.bottom + 4 }, [
              { label: 'Chọn ảnh…', onClick: onPickImages, disabled: !window.frameSlideAPI },
              { label: 'Chọn thư mục…', onClick: onPickFolder, disabled: !window.frameSlideAPI },
              { separator: true, label: '' },
              { label: 'Ảnh mẫu', onClick: onLoadSamples },
            ]);
          }}
          className="h-8 rounded bg-amber-500 px-3 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
        >
          + Nhập ▾
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <label className="flex items-center gap-1.5 text-zinc-400">
          FPS
          <select
            value={fps}
            disabled={isExporting}
            onChange={(e) => setFps(Number(e.target.value) as SupportedFps)}
            className="h-8 rounded border border-zinc-700 bg-zinc-900 px-2 text-zinc-100"
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
            className="h-8 rounded border border-zinc-700 bg-zinc-900 px-2 text-zinc-100"
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
          className="h-8 rounded border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-300 hover:border-amber-400 hover:text-amber-300"
        >
          ⟲ Bố cục
        </button>

        <button
          type="button"
          onClick={onShowShortcuts}
          title="Bảng phím tắt dựng phim"
          className="h-8 w-8 rounded border border-zinc-700 bg-zinc-900 text-xs font-semibold text-zinc-300 hover:border-amber-400 hover:text-amber-300"
        >
          ?
        </button>

        <div className="mx-1 h-5 w-px bg-zinc-700" />

        <button
          type="button"
          onClick={onShowExport}
          title="Xuất video (Ctrl+E)"
          className={`h-8 rounded px-4 text-xs font-bold text-zinc-950 shadow ${
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
